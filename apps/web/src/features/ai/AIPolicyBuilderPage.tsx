import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Plus, Save, ShieldCheck, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  clearPolicyBuilderQueue,
  createPolicyBuilderSession,
  finishPolicyBuilderSession,
  getPolicyBuilderSession,
  getPolicyBuilderWorkspace,
  queuePolicyControl,
  queuePolicyProfile,
  updatePolicyBuilderSession,
} from './api';
import type { PolicyBuilderSessionDetail, PolicyBuilderWorkspace, PolicyCatalogue, PolicyControl, PolicyProfile } from './types';

type WizardStep = 'profiles' | 'controls' | 'review';
type BuilderSurface = 'ai-builder' | 'security-profiles';
type LocalPolicyProfile = PolicyProfile & {
  sourceKind: 'imported' | 'manual';
  createdAt: string;
  fileName: string;
  controlMappings: Array<{ catalogueName: string; controlId: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function badgeClass(status: string) {
  if (status === 'Finished' || status === 'Complete') {
    return 'badge-success';
  }
  if (status === 'Attention') {
    return 'badge-danger';
  }
  return 'badge-neutral';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function downloadProfile(profile: PolicyProfile) {
  const payload = {
    label: profile.label,
    description: profile.description,
    catalogues: profile.catalogues,
    controls: profile.controls,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(profile.label || 'security-profile')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function normalizeCatalogueName(value: string) {
  return value.trim().toLowerCase();
}

function parseImportedProfile(text: string, fileName: string): LocalPolicyProfile {
  const payload = JSON.parse(text) as Record<string, unknown>;
  const label =
    typeof payload.label === 'string' && payload.label.trim()
      ? payload.label.trim()
      : fileName.replace(/\.json$/i, '') || 'Imported Security Profile';
  const description =
    typeof payload.description === 'string' && payload.description.trim()
      ? payload.description.trim()
      : 'Imported security profile JSON for baseline-driven security-plan and policy work.';
  const catalogues = Array.isArray(payload.catalogues)
    ? payload.catalogues.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const controlMappings: Array<{ catalogueName: string; controlId: string }> = [];
  const controls = Array.isArray(payload.controls)
    ? payload.controls
        .map((value) => {
          if (!value || typeof value !== 'object') {
            return null;
          }
          const record = value as Record<string, unknown>;
          const controlId =
            typeof record.controlId === 'string' && record.controlId.trim()
              ? record.controlId.trim()
              : typeof record.ref === 'string' && record.ref.trim()
                ? record.ref.trim()
                : '';
          if (!controlId) {
            return null;
          }
          const preferredCatalogueName =
            typeof record.catalogueName === 'string' && record.catalogueName.trim()
              ? record.catalogueName.trim()
              : typeof record.catalogue === 'string' && record.catalogue.trim()
                ? record.catalogue.trim()
                : catalogues[0] ?? '';
          if (preferredCatalogueName) {
            controlMappings.push({ catalogueName: preferredCatalogueName, controlId });
          }
          return {
            controlId,
            title:
              typeof record.title === 'string' && record.title.trim()
                ? record.title.trim()
                : controlId,
            family:
              typeof record.family === 'string' && record.family.trim()
                ? record.family.trim()
                : controlId.split('-')[0] || 'Imported',
            description:
              typeof record.description === 'string' && record.description.trim()
                ? record.description.trim()
                : 'Imported from profile JSON.',
          } satisfies PolicyControl;
        })
        .filter((value): value is PolicyControl => value !== null)
    : [];

  if (controls.length === 0) {
    throw new Error('Imported profile JSON must include a non-empty controls array.');
  }

  return {
    id: `imported-${slugify(label) || 'profile'}-${Date.now()}`,
    sourceKind: 'imported',
    label,
    description,
    catalogues,
    controls,
    createdAt: new Date().toISOString(),
    fileName,
    controlMappings,
  };
}

function resolveLocalProfileControls(profile: LocalPolicyProfile, catalogues: PolicyCatalogue[]) {
  const catalogueLookup = new Map(catalogues.map((catalogue) => [normalizeCatalogueName(catalogue.name), catalogue]));
  const preferredCatalogues = new Set(profile.catalogues.map((value) => value.trim().toLowerCase()));
  const matches: Array<{ catalogName: string; controlId: string }> = [];
  const missing: string[] = [];
  const missingCatalogues: string[] = [];
  const seen = new Set<string>();

  if (profile.controlMappings.length > 0) {
    for (const mapping of profile.controlMappings) {
      const catalogue = catalogueLookup.get(normalizeCatalogueName(mapping.catalogueName));
      if (!catalogue) {
        missingCatalogues.push(mapping.catalogueName);
        missing.push(mapping.controlId);
        continue;
      }
      const control = catalogue.controls.find((candidate) => candidate.controlId === mapping.controlId);
      if (!control) {
        missing.push(mapping.controlId);
        continue;
      }
      const dedupeKey = `${catalogue.name}::${control.controlId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      matches.push({ catalogName: catalogue.name, controlId: control.controlId });
    }
  } else {
    for (const control of profile.controls) {
      const preferredMatch = catalogues.find(
        (catalogue) =>
          preferredCatalogues.has(catalogue.name.trim().toLowerCase()) &&
          catalogue.controls.some((candidate) => candidate.controlId === control.controlId),
      );
      const fallbackMatch =
        preferredMatch ??
        catalogues.find((catalogue) => catalogue.controls.some((candidate) => candidate.controlId === control.controlId));

      if (!fallbackMatch) {
        missing.push(control.controlId);
        continue;
      }

      const dedupeKey = `${fallbackMatch.name}::${control.controlId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      matches.push({ catalogName: fallbackMatch.name, controlId: control.controlId });
    }
  }

  return { matches, missing, missingCatalogues: Array.from(new Set(missingCatalogues)) };
}

type AIPolicyBuilderPageProps = {
  surface?: BuilderSurface;
};

export function AIPolicyBuilderPage({ surface = 'ai-builder' }: AIPolicyBuilderPageProps) {
  const { identity } = useEdgeIdentity();
  const [workspace, setWorkspace] = useState<PolicyBuilderWorkspace | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PolicyBuilderSessionDetail | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStep>('profiles');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedCatalogueName, setSelectedCatalogueName] = useState('');
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedFamilyName, setSelectedFamilyName] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState<LocalPolicyProfile[]>([]);
  const [manualProfileLabel, setManualProfileLabel] = useState('');
  const [manualProfileDescription, setManualProfileDescription] = useState('');
  const [manualDraftControls, setManualDraftControls] = useState<Array<{ catalogueName: string; control: PolicyControl }>>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const isSecurityProfilesSurface = surface === 'security-profiles';

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const next = await getPolicyBuilderWorkspace();
      setWorkspace(next);
      setSelectedSessionId((current) => current ?? next.sessions[0]?.id ?? null);
      if (!selectedProfileId) {
        setSelectedProfileId(next.profiles[0]?.id ?? '');
      }
      if (!selectedCatalogueName) {
        setSelectedCatalogueName(next.catalogues[0]?.name ?? '');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isSecurityProfilesSurface
            ? 'Unable to load Security Profiles.'
            : 'Unable to load AI Policy Builder.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(sessionId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getPolicyBuilderSession(sessionId);
      setDetail(next);
      setTitleDraft(next.session.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load builder session.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedSessionId) {
      void loadDetail(selectedSessionId);
    } else {
      setDetail(null);
    }
  }, [selectedSessionId]);

  const selectedCatalogue = useMemo(
    () => workspace?.catalogues.find((catalogue) => catalogue.name === selectedCatalogueName) ?? workspace?.catalogues[0] ?? null,
    [selectedCatalogueName, workspace],
  );

  useEffect(() => {
    setSelectedControlId(selectedCatalogue?.controls[0]?.controlId ?? '');
  }, [selectedCatalogue?.name]);

  const selectedCatalogueFamilies = useMemo(() => {
    const grouped = new Map<string, PolicyControl[]>();
    for (const control of selectedCatalogue?.controls ?? []) {
      const family = control.family?.trim() || 'Uncategorized';
      const current = grouped.get(family) ?? [];
      current.push(control);
      grouped.set(family, current);
    }
    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, controls]) => ({ family, controls }));
  }, [selectedCatalogue]);

  useEffect(() => {
    setSelectedFamilyName((current) =>
      current && selectedCatalogueFamilies.some((entry) => entry.family === current)
        ? current
        : selectedCatalogueFamilies[0]?.family ?? '',
    );
  }, [selectedCatalogueFamilies]);

  const availableProfiles = useMemo(
    () => [...localProfiles, ...(workspace?.profiles ?? [])],
    [localProfiles, workspace?.profiles],
  );

  const metrics = useMemo(() => {
    return [
      {
        label: 'Profiles',
        value: availableProfiles.length,
        detail: isSecurityProfilesSurface
          ? 'Tenant baselines available for security-plan or policy work.'
          : 'Configured security profiles with mapped controls.',
      },
      {
        label: 'Catalogues',
        value: workspace?.catalogues.length ?? 0,
        detail: 'Loaded security control catalogues available for manual selection.',
      },
      {
        label: 'Queued controls',
        value: detail?.queue.length ?? 0,
        detail: 'Candidate requirements currently waiting in the builder queue.',
      },
      {
        label: 'Created requirements',
        value: detail?.createdRequirements.length ?? 0,
        detail: 'Generated requirement records for this policy context.',
      },
    ];
  }, [
    availableProfiles.length,
    detail?.createdRequirements.length,
    detail?.queue.length,
    isSecurityProfilesSurface,
    workspace?.catalogues.length,
  ]);

  async function refreshCurrentSession() {
    if (!selectedSessionId) {
      return;
    }
    await loadDetail(selectedSessionId);
    await loadWorkspace();
  }

  async function handleCreateSession() {
    try {
      setBusy('create-session');
      setError(null);
      setNotice(null);
      const created = await createPolicyBuilderSession({
        title: isSecurityProfilesSurface
          ? `Security Profile Session ${workspace ? workspace.sessions.length + 1 : 1}`
          : `Policy Builder ${workspace ? workspace.sessions.length + 1 : 1}`,
      });
      await loadWorkspace();
      setSelectedSessionId(created.session.id);
      setActiveStep('profiles');
      setNotice(
        isSecurityProfilesSurface
          ? 'New security profile activation session created in the canonical Worker runtime.'
          : 'New AI policy-builder session created in the canonical Worker runtime.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create builder session.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveSession() {
    if (!selectedSessionId) {
      return;
    }
    try {
      setBusy('save-session');
      setError(null);
      setNotice(null);
      await updatePolicyBuilderSession(selectedSessionId, { title: titleDraft });
      await refreshCurrentSession();
      setNotice('Policy-builder context saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save builder session.');
    } finally {
      setBusy(null);
    }
  }

  function addControlsToManualDraft(catalogueName: string, controls: PolicyControl[]) {
    if (controls.length === 0) {
      return;
    }

    setManualDraftControls((current) => {
      const next = [...current];
      const seen = new Set(current.map((entry) => `${entry.catalogueName}::${entry.control.controlId}`));
      for (const control of controls) {
        const key = `${catalogueName}::${control.controlId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        next.push({ catalogueName, control });
      }
      return next;
    });
  }

  function handleAddSelectedControlToDraft() {
    if (!selectedCatalogue || !selectedControlId) {
      return;
    }
    const selectedControl = selectedCatalogue.controls.find((control) => control.controlId === selectedControlId);
    if (!selectedControl) {
      return;
    }
    addControlsToManualDraft(selectedCatalogue.name, [selectedControl]);
    setImportError(null);
    setNotice(`${selectedControl.controlId} added to the manual security profile draft.`);
  }

  function handleAddFamilyToDraft() {
    if (!selectedCatalogue || !selectedFamilyName) {
      return;
    }
    const familyControls = selectedCatalogueFamilies.find((entry) => entry.family === selectedFamilyName)?.controls ?? [];
    if (familyControls.length === 0) {
      return;
    }
    addControlsToManualDraft(selectedCatalogue.name, familyControls);
    setImportError(null);
    setNotice(`${selectedFamilyName} controls added to the manual security profile draft.`);
  }

  function handleRemoveDraftControl(catalogueName: string, controlId: string) {
    setManualDraftControls((current) =>
      current.filter((entry) => !(entry.catalogueName === catalogueName && entry.control.controlId === controlId)),
    );
  }

  function handleClearManualDraft() {
    setManualDraftControls([]);
    setManualProfileLabel('');
    setManualProfileDescription('');
    setImportError(null);
    setNotice('Manual security profile draft cleared.');
  }

  function handleSaveManualProfile() {
    if (!manualProfileLabel.trim()) {
      setImportError('Manual profiles need a title before they can be saved.');
      return;
    }
    if (manualDraftControls.length === 0) {
      setImportError('Manual profiles need at least one selected control before they can be saved.');
      return;
    }

    const nextProfile: LocalPolicyProfile = {
      id: `manual-${slugify(manualProfileLabel) || 'profile'}-${Date.now()}`,
      sourceKind: 'manual',
      label: manualProfileLabel.trim(),
      description:
        manualProfileDescription.trim() ||
        'Manually curated security profile built from tenant-loaded control catalogues.',
      catalogues: Array.from(new Set(manualDraftControls.map((entry) => entry.catalogueName))),
      controls: manualDraftControls.map((entry) => entry.control),
      createdAt: new Date().toISOString(),
      fileName: `${slugify(manualProfileLabel) || 'manual-security-profile'}.json`,
      controlMappings: manualDraftControls.map((entry) => ({
        catalogueName: entry.catalogueName,
        controlId: entry.control.controlId,
      })),
    };

    setLocalProfiles((current) => [nextProfile, ...current]);
    setSelectedProfileId(nextProfile.id);
    setManualDraftControls([]);
    setManualProfileLabel('');
    setManualProfileDescription('');
    setImportError(null);
    setNotice(`${nextProfile.label} saved as a workspace security profile draft.`);
  }

  async function handleQueueProfile() {
    if (!workspace || !selectedSessionId || !selectedProfileId) {
      return;
    }
    try {
      setBusy('queue-profile');
      setError(null);
      setNotice(null);
      if (currentLocalProfile) {
        const resolution = resolveLocalProfileControls(currentLocalProfile, workspace.catalogues);
        if (currentLocalProfile.sourceKind === 'imported' && resolution.missingCatalogues.length > 0) {
          throw new Error(
            `Unable to activate ${currentLocalProfile.label} because the following catalogues are not loaded in this tenant: ${resolution.missingCatalogues.join(', ')}.`,
          );
        }
        if (resolution.matches.length === 0) {
          throw new Error('No controls from the selected local profile matched the loaded tenant catalogues.');
        }

        let latestDetail = detail;
        let addedCount = 0;
        let duplicateCount = 0;

        for (const match of resolution.matches) {
          try {
            const response = await queuePolicyControl(selectedSessionId, match);
            latestDetail = response.detail;
            addedCount += 1;
          } catch (err) {
            const message = err instanceof Error ? err.message.toLowerCase() : '';
            if (message.includes('duplicate')) {
              duplicateCount += 1;
              continue;
            }
            throw err;
          }
        }

        const nextDetail = latestDetail ?? (await getPolicyBuilderSession(selectedSessionId));
        setDetail(nextDetail);
        await loadWorkspace();
        setActiveStep('controls');
        setNotice(
          `${addedCount} control(s) from ${currentLocalProfile.label} queued.` +
            (duplicateCount > 0 ? ` ${duplicateCount} duplicate control(s) skipped.` : '') +
            (resolution.missing.length > 0
              ? ` ${resolution.missing.length} control(s) could not be matched to loaded catalogues.`
              : ''),
        );
      } else {
        const response = await queuePolicyProfile(selectedSessionId, selectedProfileId);
        setDetail(response.detail);
        await loadWorkspace();
        setActiveStep('controls');
        setNotice(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue profile controls.');
    } finally {
      setBusy(null);
    }
  }

  async function handleImportProfileFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }

    try {
      setImportError(null);
      setError(null);
      setNotice(null);
      const next = parseImportedProfile(await file.text(), file.name);
      setLocalProfiles((current) => [next, ...current]);
      setSelectedProfileId(next.id);
      setNotice(
        `Imported ${next.label} from ${file.name}. Controls from this file can be queued when matching tenant catalogues are loaded.`,
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to import the selected profile JSON.');
    }
  }

  function handleRemoveLocalProfile(profileId: string) {
    const nextProfileId =
      selectedProfileId === profileId ? workspace?.profiles[0]?.id ?? localProfiles.find((profile) => profile.id !== profileId)?.id ?? '' : selectedProfileId;
    setLocalProfiles((current) => current.filter((profile) => profile.id !== profileId));
    setImportError(null);
    setSelectedProfileId(nextProfileId);
  }

  function handleExportCurrentProfile() {
    if (!currentProfile) {
      return;
    }
    setImportError(null);
    setNotice(`Exported ${currentProfile.label} as JSON.`);
    downloadProfile(currentProfile);
  }

  async function handleQueueControl() {
    if (!selectedSessionId || !selectedCatalogueName || !selectedControlId) {
      return;
    }
    try {
      setBusy('queue-control');
      setError(null);
      setNotice(null);
      const response = await queuePolicyControl(selectedSessionId, {
        catalogName: selectedCatalogueName,
        controlId: selectedControlId,
      });
      setDetail(response.detail);
      await loadWorkspace();
      setActiveStep('review');
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue control.');
    } finally {
      setBusy(null);
    }
  }

  async function handleClearQueue() {
    if (!selectedSessionId) {
      return;
    }
    try {
      setBusy('clear-queue');
      setError(null);
      setNotice(null);
      const next = await clearPolicyBuilderQueue(selectedSessionId);
      setDetail(next);
      await loadWorkspace();
      setActiveStep('profiles');
      setNotice('Queued controls cleared from this policy-builder session.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear queued controls.');
    } finally {
      setBusy(null);
    }
  }

  async function handleFinish() {
    if (!selectedSessionId) {
      return;
    }
    try {
      setBusy('finish');
      setError(null);
      setNotice(null);
      const response = await finishPolicyBuilderSession(selectedSessionId);
      setDetail(response.detail);
      await loadWorkspace();
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish policy builder.');
    } finally {
      setBusy(null);
    }
  }

  if (loading || !workspace) {
    return (
      <div className="panel p-6 text-sm text-slate-300">
        Loading {isSecurityProfilesSurface ? 'Security Profiles' : 'AI Policy Builder'}...
      </div>
    );
  }

  const currentLocalProfile = localProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const currentProfile = availableProfiles.find((profile) => profile.id === selectedProfileId) ?? availableProfiles[0] ?? null;
  const previewControls = currentProfile?.controls.slice(0, 24) ?? [];
  const queuePreview = detail?.queue.slice(0, 50) ?? [];
  const createdRequirementsPreview = detail?.createdRequirements.slice(0, 24) ?? [];
  const selectedFamilyControls =
    selectedCatalogueFamilies.find((entry) => entry.family === selectedFamilyName)?.controls ?? [];
  const manualDraftCatalogues = Array.from(new Set(manualDraftControls.map((entry) => entry.catalogueName)));
  const manualDraftFamilies = Array.from(new Set(manualDraftControls.map((entry) => entry.control.family || 'Uncategorized')));

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">{isSecurityProfilesSurface ? 'Security Profiles' : 'AI Policy Builder'}</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {isSecurityProfilesSurface
              ? 'Build reusable security baselines from loaded catalogues and imported profile JSON'
              : 'Standardize policy requirements from profiles and control catalogues'}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {isSecurityProfilesSurface
              ? 'Use loaded control catalogues as baseline sources, import compatible profile JSON when the parent catalogues already exist, and activate the resulting control set through tenant-backed builder sessions.'
              : 'Launch the builder from a policy context, queue mapped controls from security profiles or manual catalogue picks, then batch-create standardized requirements that stay editable after generation.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="badge-neutral">{isSecurityProfilesSurface ? 'Baseline workspace' : 'Policy wizard'}</span>
            <span className="badge-neutral">D1-backed queue</span>
            <span className="badge-neutral">{isSecurityProfilesSurface ? 'JSON import/export' : 'Control deduplication'}</span>
          </div>
          {isSecurityProfilesSurface ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="button-secondary" to="/catalogues">
                Open catalogues
              </Link>
              <Link className="button-secondary" to="/security-plans">
                Open security plans
              </Link>
            </div>
          ) : null}
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            {isSecurityProfilesSurface ? 'Baseline Context' : 'Policy Context'}
          </div>
          <div className="text-lg font-semibold text-white">{workspace.policyContext.name}</div>
          <div className="text-sm text-slate-300">Owner: {workspace.policyContext.owner}</div>
          <div className="text-sm text-slate-300">Location: {workspace.policyContext.location}</div>
          <div className="grid gap-2 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <span>Profiles configured</span>
              <span className={workspace.policyContext.readiness.profilesConfigured ? 'badge-success' : 'badge-danger'}>
                {workspace.policyContext.readiness.profilesConfigured ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <span>Control catalogues loaded</span>
              <span className={workspace.policyContext.readiness.controlCataloguesLoaded ? 'badge-success' : 'badge-danger'}>
                {workspace.policyContext.readiness.controlCataloguesLoaded ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <span>Existing requirements</span>
              <span className="badge-neutral">{workspace.policyContext.readiness.existingRequirementCount}</span>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {importError && <div className="notice-warning">{importError}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      {isSecurityProfilesSurface ? (
        <section className="panel-subtle grid gap-4 md:grid-cols-3">
          <div>
            <div className="label">Manual creation</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              Build baseline sessions directly from tenant catalogues, then combine controls across multiple frameworks in the queue when one catalogue is not enough.
            </div>
          </div>
          <div>
            <div className="label">Automated import</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              Import compatible profile JSON, preview the baseline, and queue any controls that match catalogues already loaded in this tenant.
            </div>
          </div>
          <div>
            <div className="label">Security-plan activation</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              Activation sessions feed downstream requirement and security-plan preparation work without creating a second hidden baseline store.
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel-subtle">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{metric.value}</div>
            <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Sessions</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {isSecurityProfilesSurface ? 'Profile Activation Sessions' : 'Policy Builder Sessions'}
              </div>
            </div>
            <button className="button-primary" onClick={() => void handleCreateSession()} disabled={busy !== null}>
              <Plus className="h-4 w-4" />
              {isSecurityProfilesSurface ? 'New activation session' : 'New session'}
            </button>
          </div>
          <div className="space-y-3">
            {workspace.sessions.map((session) => (
              <button
                key={session.id}
                className={`panel-subtle w-full text-left transition ${selectedSessionId === session.id ? 'border-cyan-300/40 bg-cyan-400/[0.06]' : ''}`}
                onClick={() => setSelectedSessionId(session.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{session.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{session.policyLocation}</div>
                  </div>
                  <span className={badgeClass(session.status)}>{session.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{session.queuedControls} queued</span>
                  <span>Owner: {session.owner}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">Saved {formatDate(session.lastSavedAt)}</div>
              </button>
            ))}
            {workspace.sessions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                {isSecurityProfilesSurface
                  ? 'No profile activation sessions yet. Create one to turn a baseline into queue-ready controls.'
                  : 'No builder sessions yet. Create one to start generating policy requirements.'}
              </div>
            )}
          </div>
        </section>

        <section className="panel space-y-6">
          {detailLoading && (
            <div className="text-sm text-slate-400">
              Loading {isSecurityProfilesSurface ? 'profile activation' : 'builder'} session...
            </div>
          )}
          {!detailLoading && detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">{isSecurityProfilesSurface ? 'Activation Flow' : 'Wizard'}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{detail.session.title}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    Owner: {detail.session.owner} · Policy location: {detail.session.policyLocation}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" disabled={busy !== null} onClick={() => void handleSaveSession()}>
                    <Save className="h-4 w-4" />
                    Save context
                  </button>
                  <button className="button-secondary" disabled={busy !== null} onClick={() => void refreshCurrentSession()}>
                    Refresh
                  </button>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Session title</span>
                <input
                  className="input"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder={isSecurityProfilesSurface ? 'Security Profile Session' : 'Policy Builder Session'}
                />
              </label>

              <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as WizardStep)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profiles">1. Select Profile</TabsTrigger>
                  <TabsTrigger value="controls">2. Select Controls</TabsTrigger>
                  <TabsTrigger value="review">3. Review & Finish</TabsTrigger>
                </TabsList>

                <TabsContent value="profiles" className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Security Profile</span>
                        <select className="input" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                          {availableProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isSecurityProfilesSurface ? (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white">Import or export profile JSON</div>
                              <div className="mt-1 text-xs leading-5 text-slate-400">
                                Imported profiles stay in this workspace session and queue successfully only when matching catalogues already exist in the tenant.
                              </div>
                            </div>
                            {currentLocalProfile ? (
                              <button className="button-secondary" type="button" onClick={() => handleRemoveLocalProfile(currentLocalProfile.id)}>
                                <X className="h-4 w-4" />
                                Remove local profile
                              </button>
                            ) : null}
                          </div>
                          <label className="block space-y-2">
                            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Import profile file</span>
                            <input
                              className="input"
                              type="file"
                              accept="application/json,.json"
                              onChange={(event) => void handleImportProfileFile(event)}
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="button-secondary"
                              type="button"
                              onClick={handleExportCurrentProfile}
                              disabled={!currentProfile}
                            >
                              <Download className="h-4 w-4" />
                              Export selected profile
                            </button>
                            <Link className="button-secondary" to="/catalogues">
                              <Upload className="h-4 w-4" />
                              Load catalogues
                            </Link>
                          </div>
                        </div>
                      ) : null}
                      {isSecurityProfilesSurface ? (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <div>
                            <div className="text-sm font-medium text-white">Manual profile creation</div>
                            <div className="mt-1 text-xs leading-5 text-slate-400">
                              Build a reusable baseline by selecting controls from one catalogue family at a time, then save the draft as a local security profile.
                            </div>
                          </div>
                          <label className="block space-y-2">
                            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Draft profile title</span>
                            <input
                              className="input"
                              value={manualProfileLabel}
                              onChange={(event) => setManualProfileLabel(event.target.value)}
                              placeholder="FedRAMP Moderate Shared Services Profile"
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Draft description</span>
                            <textarea
                              className="input min-h-24"
                              value={manualProfileDescription}
                              onChange={(event) => setManualProfileDescription(event.target.value)}
                              placeholder="Document the baseline purpose, affected systems, or intended security-plan automation context."
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Catalogue family</span>
                            <select className="input" value={selectedFamilyName} onChange={(event) => setSelectedFamilyName(event.target.value)}>
                              {selectedCatalogueFamilies.map((entry) => (
                                <option key={entry.family} value={entry.family}>
                                  {entry.family} ({entry.controls.length})
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              className="button-secondary"
                              type="button"
                              onClick={handleAddFamilyToDraft}
                              disabled={!selectedFamilyName || selectedFamilyControls.length === 0}
                            >
                              Add family to draft
                            </button>
                            <button
                              className="button-secondary"
                              type="button"
                              onClick={handleAddSelectedControlToDraft}
                              disabled={!selectedControlId}
                            >
                              Add selected control
                            </button>
                          </div>
                          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                            <div className="panel-subtle">
                              <div className="label">Draft controls</div>
                              <div className="mt-2 text-white">{manualDraftControls.length}</div>
                            </div>
                            <div className="panel-subtle">
                              <div className="label">Catalogues used</div>
                              <div className="mt-2 text-white">{manualDraftCatalogues.length}</div>
                            </div>
                            <div className="panel-subtle">
                              <div className="label">Families covered</div>
                              <div className="mt-2 text-white">{manualDraftFamilies.length}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="button-primary"
                              type="button"
                              onClick={handleSaveManualProfile}
                              disabled={!manualProfileLabel.trim() || manualDraftControls.length === 0}
                            >
                              Save draft profile
                            </button>
                            <button
                              className="button-secondary"
                              type="button"
                              onClick={handleClearManualDraft}
                              disabled={manualDraftControls.length === 0 && !manualProfileLabel.trim() && !manualProfileDescription.trim()}
                            >
                              Clear draft
                            </button>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Draft preview</div>
                            <div className="mt-3 space-y-2 text-sm">
                              {manualDraftControls.slice(0, 8).map((entry) => (
                                <div
                                  key={`${entry.catalogueName}::${entry.control.controlId}`}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 px-3 py-2"
                                >
                                  <div>
                                    <div className="font-medium text-white">{entry.control.controlId}</div>
                                    <div className="text-xs text-slate-400">
                                      {entry.catalogueName} · {entry.control.family}
                                    </div>
                                  </div>
                                  <button
                                    className="button-secondary"
                                    type="button"
                                    onClick={() => handleRemoveDraftControl(entry.catalogueName, entry.control.controlId)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              {manualDraftControls.length > 8 ? (
                                <div className="text-xs text-slate-500">
                                  Showing the first 8 controls in the draft preview.
                                </div>
                              ) : null}
                              {manualDraftControls.length === 0 ? (
                                <div className="text-sm text-slate-400">
                                  Add a family or a specific control to start building a manual security profile.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <button
                        className="button-primary w-full"
                        onClick={() => void handleQueueProfile()}
                        disabled={busy !== null || !selectedSessionId || !selectedProfileId}
                      >
                        <Sparkles className="h-4 w-4" />
                        {isSecurityProfilesSurface ? 'Queue baseline controls' : 'Queue profile controls'}
                      </button>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                        {isSecurityProfilesSurface
                          ? 'Selecting a profile queues its mapped controls, skips duplicates already present in the policy context, and keeps the baseline queue available across the remaining activation steps.'
                          : 'Selecting a profile queues all mapped controls, skips duplicates already in the policy context, and preserves the queue across wizard steps.'}
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-white">
                          <ShieldCheck className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">{currentProfile?.label ?? 'No profile selected'}</span>
                        </div>
                        <span className="badge-neutral">{currentProfile?.controls.length ?? 0} controls</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{currentProfile?.description}</div>
                      {currentLocalProfile ? (
                        <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs leading-5 text-cyan-100">
                          {currentLocalProfile.sourceKind === 'imported'
                            ? `Imported from ${currentLocalProfile.fileName} on ${formatDate(currentLocalProfile.createdAt)}.`
                            : `Manually drafted in this workspace on ${formatDate(currentLocalProfile.createdAt)}.`}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(currentProfile?.catalogues ?? []).map((catalogue) => (
                          <span key={catalogue} className="badge-neutral">
                            {catalogue}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                        <div className="panel-subtle">
                          <div className="label">Catalogues</div>
                          <div className="mt-2 text-white">{currentProfile?.catalogues.length ?? 0}</div>
                        </div>
                        <div className="panel-subtle">
                          <div className="label">Families</div>
                          <div className="mt-2 text-white">
                            {currentProfile ? new Set(currentProfile.controls.map((control) => control.family || 'Uncategorized')).size : 0}
                          </div>
                        </div>
                        <div className="panel-subtle">
                          <div className="label">Source</div>
                          <div className="mt-2 text-white">
                            {currentLocalProfile ? (currentLocalProfile.sourceKind === 'imported' ? 'Imported JSON' : 'Manual Draft') : 'Tenant Derived'}
                          </div>
                        </div>
                      </div>
                      {(currentProfile?.controls.length ?? 0) > previewControls.length ? (
                        <div className="mt-4 text-xs text-slate-500">
                          Showing the first {previewControls.length} controls in this profile preview.
                        </div>
                      ) : null}
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Control</th>
                              <th className="px-4 py-3">Title</th>
                              <th className="px-4 py-3">Family</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewControls.map((control) => (
                              <tr key={control.controlId} className="border-t border-white/5">
                                <td className="px-4 py-3 font-medium text-white">{control.controlId}</td>
                                <td className="px-4 py-3 text-slate-300">{control.title}</td>
                                <td className="px-4 py-3 text-slate-400">{control.family}</td>
                              </tr>
                            ))}
                            {(currentProfile?.controls.length ?? 0) === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-slate-400" colSpan={3}>
                                  No controls available for this profile.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="controls" className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Catalogue</span>
                        <select className="input" value={selectedCatalogueName} onChange={(event) => setSelectedCatalogueName(event.target.value)}>
                          {workspace.catalogues.map((catalogue) => (
                            <option key={catalogue.name} value={catalogue.name}>
                              {catalogue.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Security Control</span>
                        <select className="input" value={selectedControlId} onChange={(event) => setSelectedControlId(event.target.value)}>
                          {(selectedCatalogue?.controls ?? []).map((control) => (
                            <option key={control.controlId} value={control.controlId}>
                              {control.controlId} · {control.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button-primary w-full"
                        onClick={() => void handleQueueControl()}
                        disabled={busy !== null || !selectedSessionId || !selectedControlId}
                      >
                        <Wand2 className="h-4 w-4" />
                        Add control to queue
                      </button>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                        Duplicate controls are rejected clearly and the queue continues to accumulate across multiple catalogues.
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-white">
                          <ClipboardList className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">Current queue</span>
                        </div>
                        <span className="badge-neutral">{detail.queue.length} queued</span>
                      </div>
                      {detail.queue.length > queuePreview.length ? (
                        <div className="mt-4 text-xs text-slate-500">
                          Showing the first {queuePreview.length} queued controls in this session preview.
                        </div>
                      ) : null}
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Source</th>
                              <th className="px-4 py-3">Control</th>
                              <th className="px-4 py-3">Title</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queuePreview.map((item) => (
                              <tr key={item.id} className="border-t border-white/5">
                                <td className="px-4 py-3 text-slate-300">{item.sourceName}</td>
                                <td className="px-4 py-3 font-medium text-white">{item.controlId}</td>
                                <td className="px-4 py-3 text-slate-400">{item.title}</td>
                              </tr>
                            ))}
                            {detail.queue.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-slate-400" colSpan={3}>
                                  No controls have been added to the queue yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="review" className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="space-y-3">
                      <div className="panel-subtle">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-white">
                            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                            <span className="font-semibold">Queue summary</span>
                          </div>
                          <span className="badge-neutral">{detail.queue.length} queued</span>
                        </div>
                        <div className="mt-4 space-y-2">
                          {detail.queueSummary.map((item) => (
                            <div key={item.sourceName} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm">
                              <span className="text-slate-300">{item.sourceName}</span>
                              <span className="badge-neutral">{item.count}</span>
                            </div>
                          ))}
                          {detail.queueSummary.length === 0 && (
                            <div className="text-sm text-slate-400">No queued controls to summarize yet.</div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="button-secondary" onClick={() => void handleClearQueue()} disabled={busy !== null || detail.queue.length === 0}>
                            Clear all controls
                          </button>
                          <button className="button-primary" onClick={() => void handleFinish()} disabled={busy !== null || detail.queue.length === 0}>
                            Finish and create requirements
                          </button>
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Pipeline</div>
                        <div className="mt-4 space-y-3">
                          {detail.pipeline.map((step) => (
                            <div key={step.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium text-white">{step.title}</div>
                                <span className={badgeClass(step.status)}>{step.status}</span>
                              </div>
                              <div className="mt-2 text-sm text-slate-300">{step.helper}</div>
                              <div className="mt-3 text-xs text-slate-500">{step.metric}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="panel-subtle overflow-hidden">
                        <div className="flex items-center gap-2 text-white">
                          <ClipboardList className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">Preview controls</span>
                        </div>
                        {detail.queue.length > queuePreview.length ? (
                          <div className="mt-4 text-xs text-slate-500">
                            Showing the first {queuePreview.length} controls in the final review preview.
                          </div>
                        ) : null}
                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Control ID</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Family</th>
                              </tr>
                            </thead>
                            <tbody>
                              {queuePreview.map((item) => (
                                <tr key={item.id} className="border-t border-white/5">
                                  <td className="px-4 py-3 font-medium text-white">{item.controlId}</td>
                                  <td className="px-4 py-3 text-slate-300">{item.title}</td>
                                  <td className="px-4 py-3 text-slate-400">{item.family}</td>
                                </tr>
                              ))}
                              {detail.queue.length === 0 && (
                                <tr>
                                  <td className="px-4 py-6 text-slate-400" colSpan={3}>
                                    No controls queued yet. Add profiles or manual controls before finishing.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="flex items-center gap-2 text-white">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">Created requirements</span>
                        </div>
                        {detail.createdRequirements.length > createdRequirementsPreview.length ? (
                          <div className="mt-4 text-xs text-slate-500">
                            Showing the first {createdRequirementsPreview.length} created requirements in this session preview.
                          </div>
                        ) : null}
                        <div className="mt-4 space-y-3">
                          {createdRequirementsPreview.map((item) => (
                            <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-white">{item.title}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.sourceControlId} · {item.sourceName}
                                  </div>
                                </div>
                                <span className="badge-success">{item.status}</span>
                              </div>
                              <div className="mt-2 text-sm text-slate-300">{item.description}</div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                                <span>Assignee: {item.assignee ?? 'Current user'}</span>
                                <span>Created {formatDate(item.createdAt)}</span>
                              </div>
                            </article>
                          ))}
                          {detail.createdRequirements.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">
                              Created requirements will appear here after you finish the wizard and can then be attested, edited, or deleted.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-400">
              {isSecurityProfilesSurface
                ? 'Select a profile activation session or create one to start building a reusable baseline queue.'
                : 'Select a builder session or create one to start queuing policy requirements.'}
            </div>
          )}
        </section>
      </section>

      <section className="panel-subtle grid gap-4 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-300" />
          <div>
            <div className="font-medium text-white">Profile prerequisites</div>
            <div className="mt-2 text-sm text-slate-400">
              {isSecurityProfilesSurface
                ? 'Loaded catalogues are the source of truth for manual baseline creation, and imported profile JSON only activates cleanly when those parent catalogues already exist in the tenant.'
                : 'Security profiles and control catalogues must be loaded before the builder can queue mapped requirements.'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
          <div>
            <div className="font-medium text-white">Duplicate protection</div>
            <div className="mt-2 text-sm text-slate-400">
              {isSecurityProfilesSurface
                ? 'Controls already present in the same activation context are skipped or rejected clearly so baseline-driven sessions stay reproducible and audit-friendly.'
                : 'Controls already present in the same policy context are skipped or rejected clearly to keep requirement sets clean.'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
          <div>
            <div className="font-medium text-white">{isSecurityProfilesSurface ? 'After activation' : 'After completion'}</div>
            <div className="mt-2 text-sm text-slate-400">
              {isSecurityProfilesSurface
                ? 'Activated baseline sessions continue into requirement generation and security-plan preparation without hiding the resulting control set behind an internal-only page.'
                : 'Finished requirements remain editable after generation and are intended to flow into score-card and attestation workflows.'}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
