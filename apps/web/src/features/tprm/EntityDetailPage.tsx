import { useEffect, useState, type ReactNode } from 'react';
import { ClipboardCheck, Eye, FileText, Link as LinkIcon, Pencil, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { RegActionMenu, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  ThirdPartyAssessment,
  ThirdPartyContract,
  ThirdPartyEntityDetail,
  ThirdPartySolution,
} from './types';

const client = new ApiClient();

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

type EntityDetailSelection =
  | { kind: 'entity' }
  | { kind: 'solution'; item: ThirdPartySolution }
  | { kind: 'contract'; item: ThirdPartyContract }
  | { kind: 'assessment'; item: ThirdPartyAssessment };

type EditableEntityDetailSelection =
  | { kind: 'entity' }
  | { kind: 'solution'; item: ThirdPartySolution }
  | { kind: 'contract'; item: ThirdPartyContract };

type EditDraft = Record<string, string>;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatMoney(amount: number | null | undefined, currency = 'USD') {
  if (amount == null) {
    return 'n/a';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusTone(value: string | null | undefined): PillTone {
  const normalized = (value ?? '').toLowerCase();
  if (['active', 'approved', 'complete', 'completed', 'compliant', 'accepted'].includes(normalized)) {
    return 'success';
  }
  if (['draft', 'planned', 'pending', 'in_progress', 'partially_compliant'].includes(normalized)) {
    return 'warning';
  }
  if (['expired', 'terminated', 'failed', 'non_compliant', 'rejected'].includes(normalized)) {
    return 'danger';
  }
  return 'neutral';
}

function openReference(value: string | null | undefined) {
  if (!value) return;
  window.open(value, '_blank', 'noopener,noreferrer');
}

function nullableText(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function optionalInteger(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalAmount(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitReferences(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const displayValue = value === null || value === undefined || value === '' ? 'n/a' : value;

  return (
    <div className="border-b border-[#eee8f3] py-3 last:border-b-0">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6f6578]">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-[#241232]">{displayValue}</div>
    </div>
  );
}

function FormField({
  children,
  className = '',
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function EntityDetailPage() {
  const { identity } = useEdgeIdentity();
  const { entityId = '' } = useParams();
  const [detail, setDetail] = useState<ThirdPartyEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<EntityDetailSelection | null>(null);
  const [editItem, setEditItem] = useState<EditableEntityDetailSelection | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({});
  const [editSaving, setEditSaving] = useState(false);

  async function loadDetail({ silent = false }: { silent?: boolean } = {}) {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const response = await client.get<{ data: ThirdPartyEntityDetail }>(`/core/entities/${entityId}`);
      setDetail(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (entityId) {
      void loadDetail();
    }
  }, [entityId, identity.tenantId]);

  function setDraftField(field: string, value: string) {
    setEditDraft((draft) => ({ ...draft, [field]: value }));
  }

  function openEdit(selection: EditableEntityDetailSelection) {
    if (!detail) return;
    setError(null);
    setSuccessMessage(null);
    setEditItem(selection);

    if (selection.kind === 'entity') {
      const { entity } = detail;
      setEditDraft({
        country: entity.country ?? '',
        currency: entity.currency ?? '',
        description: entity.description ?? '',
        doraEntityHierarchy: entity.doraEntityHierarchy ?? '',
        doraEntityType: entity.doraEntityType ?? '',
        doraProviderPersonType: entity.doraProviderPersonType ?? '',
        mission: entity.mission ?? '',
        name: entity.name,
        refId: entity.refId ?? '',
        referenceLink: entity.referenceLink ?? '',
        relationship: entity.relationship ?? '',
      });
      return;
    }

    if (selection.kind === 'solution') {
      const { item } = selection;
      setEditDraft({
        assetRefs: item.assetRefs.join(', '),
        criticality: String(item.criticality),
        dataLocationProcessing: item.dataLocationProcessing ?? '',
        dataLocationStorage: item.dataLocationStorage ?? '',
        description: item.description ?? '',
        doraAlternativeProviders: item.doraAlternativeProviders ?? '',
        doraDataSensitiveness: item.doraDataSensitiveness ?? '',
        doraIctServiceType: item.doraIctServiceType ?? '',
        doraRelianceLevel: item.doraRelianceLevel ?? '',
        name: item.name,
        recipientEntityName: item.recipientEntityName ?? '',
        refId: item.refId ?? '',
        referenceLink: item.referenceLink ?? '',
        storageOfData: item.storageOfData ? 'true' : 'false',
      });
      return;
    }

    const { item } = selection;
    setEditDraft({
      annualExpense: item.annualExpense == null ? '' : String(item.annualExpense),
      currency: item.currency ?? '',
      description: item.description ?? '',
      doraContractualArrangement: item.doraContractualArrangement ?? '',
      endDate: item.endDate ?? '',
      governingLawCountry: item.governingLawCountry ?? '',
      isIntragroup: item.isIntragroup ? 'true' : 'false',
      name: item.name,
      noticePeriodEntity: item.noticePeriodEntity == null ? '' : String(item.noticePeriodEntity),
      noticePeriodProvider: item.noticePeriodProvider == null ? '' : String(item.noticePeriodProvider),
      refId: item.refId ?? '',
      startDate: item.startDate ?? '',
      status: item.status,
    });
  }

  async function saveEdit() {
    if (!detail || !editItem) return;
    const name = editDraft.name?.trim();
    if (!name) {
      setError('Name is required before saving this review.');
      return;
    }

    setEditSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (editItem.kind === 'entity') {
        await client.put(`/core/entities/${detail.entity.id}`, {
          country: nullableText(editDraft.country),
          currency: nullableText(editDraft.currency),
          description: nullableText(editDraft.description),
          doraEntityHierarchy: nullableText(editDraft.doraEntityHierarchy),
          doraEntityType: nullableText(editDraft.doraEntityType),
          doraProviderPersonType: nullableText(editDraft.doraProviderPersonType),
          mission: nullableText(editDraft.mission),
          name,
          parentEntityId: detail.entity.parentEntityId,
          refId: nullableText(editDraft.refId),
          referenceLink: nullableText(editDraft.referenceLink),
          relationship: nullableText(editDraft.relationship),
        });
        setSuccessMessage('Entity review updates saved.');
      } else if (editItem.kind === 'solution') {
        await client.put(`/core/solutions/${editItem.item.id}`, {
          assetRefs: splitReferences(editDraft.assetRefs),
          criticality: optionalInteger(editDraft.criticality) ?? 0,
          dataLocationProcessing: nullableText(editDraft.dataLocationProcessing),
          dataLocationStorage: nullableText(editDraft.dataLocationStorage),
          description: nullableText(editDraft.description),
          doraAlternativeProviders: nullableText(editDraft.doraAlternativeProviders),
          doraDataSensitiveness: nullableText(editDraft.doraDataSensitiveness),
          doraIctServiceType: nullableText(editDraft.doraIctServiceType),
          doraRelianceLevel: nullableText(editDraft.doraRelianceLevel),
          folderId: editItem.item.folderId,
          name,
          providerEntityId: editItem.item.providerEntityId,
          recipientEntityName: nullableText(editDraft.recipientEntityName),
          refId: nullableText(editDraft.refId),
          referenceLink: nullableText(editDraft.referenceLink),
          storageOfData: editDraft.storageOfData === 'true',
        });
        setSuccessMessage('Solution review updates saved.');
      } else {
        await client.put(`/core/contracts/${editItem.item.id}`, {
          annualExpense: optionalAmount(editDraft.annualExpense),
          beneficiaryEntityId: editItem.item.beneficiaryEntityId,
          currency: nullableText(editDraft.currency),
          description: nullableText(editDraft.description),
          doraContractualArrangement: nullableText(editDraft.doraContractualArrangement),
          endDate: nullableText(editDraft.endDate),
          folderId: editItem.item.folderId,
          governingLawCountry: nullableText(editDraft.governingLawCountry),
          isIntragroup: editDraft.isIntragroup === 'true',
          name,
          noticePeriodEntity: optionalInteger(editDraft.noticePeriodEntity),
          noticePeriodProvider: optionalInteger(editDraft.noticePeriodProvider),
          providerEntityId: editItem.item.providerEntityId,
          refId: nullableText(editDraft.refId),
          solutions: editItem.item.solutions,
          startDate: nullableText(editDraft.startDate),
          status: nullableText(editDraft.status),
        });
        setSuccessMessage('Contract review updates saved.');
      }
      setEditItem(null);
      setEditDraft({});
      await loadDetail({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save review updates.');
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading entity detail...</div>;
  }

  if (!detail) {
    return <div className="notice-error">{error ?? 'Entity detail is unavailable.'}</div>;
  }

  const { entity, solutions, contracts, assessments } = detail;
  const selectedReference =
    selectedItem?.kind === 'entity'
      ? entity.referenceLink
      : selectedItem?.kind === 'solution'
        ? selectedItem.item.referenceLink
        : null;
  const selectedTitle =
    selectedItem?.kind === 'entity' ? entity.name : selectedItem ? selectedItem.item.name : 'Third-party detail';
  const selectedDescription =
    selectedItem?.kind === 'entity'
      ? 'Review third-party relationship metadata, defaults, and DORA attributes.'
      : selectedItem?.kind === 'solution'
        ? 'Review service criticality, data handling, assets, and substitutability context.'
        : selectedItem?.kind === 'contract'
          ? 'Review contractual arrangement, economics, linked services, and notice periods.'
          : selectedItem?.kind === 'assessment'
            ? 'Review vendor assessment scope, score drivers, linked review, and next-review timing.'
            : undefined;
  const editTitle =
    editItem?.kind === 'entity' ? `Review ${entity.name}` : editItem ? `Review ${editItem.item.name}` : 'Review third-party record';
  const editDescription =
    editItem?.kind === 'entity'
      ? 'Update provider metadata, DORA classification, and reference context without changing route or data model contracts.'
      : editItem?.kind === 'solution'
        ? 'Update service context, data handling, and asset references using the existing solution endpoint.'
        : editItem?.kind === 'contract'
          ? 'Update contract status, economics, and notice terms using the existing contract endpoint.'
          : undefined;

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/third-party">
          Back to third-party workspace
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Entity</div>
            <h1 className="mt-2 break-words text-3xl font-semibold text-[#241232]">{entity.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RegStatusPill tone={entity.isActive ? 'success' : 'neutral'}>
              {entity.isActive ? 'Active' : 'Inactive'}
            </RegStatusPill>
            <RegActionMenu
              actions={[
                {
                  icon: Eye,
                  label: 'Inspect entity',
                  onSelect: () => setSelectedItem({ kind: 'entity' }),
                },
                {
                  icon: Pencil,
                  label: 'Review and update entity',
                  onSelect: () => openEdit({ kind: 'entity' }),
                },
                {
                  disabled: !entity.referenceLink,
                  icon: LinkIcon,
                  label: 'Open reference',
                  onSelect: () => openReference(entity.referenceLink),
                },
              ]}
              label={`Open actions for ${entity.name}`}
            />
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#4f435c]">
          {entity.description || 'No entity description provided for this third-party record.'}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Default criticality</div>
            <div className="metric-value">{entity.defaultCriticality}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Solutions</div>
            <div className="metric-value">{solutions.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Contracts</div>
            <div className="metric-value">{contracts.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Assessments</div>
            <div className="metric-value">{assessments.length}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-[#4f435c] sm:grid-cols-2 2xl:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Relationship</div>
            <div className="mt-2 font-medium text-[#241232]">{entity.relationship ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Country / Currency</div>
            <div className="mt-2 font-medium text-[#241232]">
              {entity.country ?? 'n/a'} / {entity.currency ?? 'n/a'}
            </div>
          </div>
          <div className="panel-subtle">
            <div className="label">Parent entity</div>
            <div className="mt-2 font-medium text-[#241232]">{entity.parentEntityName ?? 'None'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Reference</div>
            <div className="mt-2 font-medium text-[#241232]">{entity.refId ?? 'n/a'}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {successMessage && <div className="notice-success">{successMessage}</div>}

      <section className="grid min-w-0 gap-6 2xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Solutions</div>
          <div className="mt-4 space-y-3">
            {solutions.map((solution) => (
              <div className="panel-subtle" key={solution.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{solution.name}</div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RegStatusPill tone="purple">Criticality {solution.criticality}</RegStatusPill>
                    <RegActionMenu
                      actions={[
                        {
                          icon: ShieldCheck,
                          label: 'Inspect solution',
                          onSelect: () => setSelectedItem({ kind: 'solution', item: solution }),
                        },
                        {
                          icon: Pencil,
                          label: 'Review and update solution',
                          onSelect: () => openEdit({ kind: 'solution', item: solution }),
                        },
                        {
                          disabled: !solution.referenceLink,
                          icon: LinkIcon,
                          label: 'Open reference',
                          onSelect: () => openReference(solution.referenceLink),
                        },
                      ]}
                      label={`Open actions for ${solution.name}`}
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-[#6f6578]">
                  {solution.recipientEntityName ?? 'No recipient'} · {solution.doraIctServiceType ?? 'n/a'}
                </div>
                <div className="mt-2 text-xs text-[#62576a]">
                  Assets: {solution.assetRefs.join(', ') || 'None listed'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Contracts</div>
          <div className="mt-4 space-y-3">
            {contracts.map((contract) => (
              <div className="panel-subtle" key={contract.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{contract.name}</div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RegStatusPill className="capitalize" tone={statusTone(contract.status)}>
                      {contract.status}
                    </RegStatusPill>
                    <RegActionMenu
                      actions={[
                        {
                          icon: FileText,
                          label: 'Inspect contract',
                          onSelect: () => setSelectedItem({ kind: 'contract', item: contract }),
                        },
                        {
                          icon: Pencil,
                          label: 'Review and update contract',
                          onSelect: () => openEdit({ kind: 'contract', item: contract }),
                        },
                      ]}
                      label={`Open actions for ${contract.name}`}
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-[#6f6578]">
                  {formatMoney(contract.annualExpense, contract.currency ?? 'USD')} · ends{' '}
                  {formatDate(contract.endDate)}
                </div>
                <div className="mt-2 text-xs text-[#62576a]">
                  Solutions: {contract.solutions.map((solution) => solution.name).join(', ') || 'None'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="eyebrow">Assessment Coverage</div>
        <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-2">
          {assessments.map((assessment) => (
            <div className="panel-subtle" key={assessment.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{assessment.name}</div>
                <div className="flex shrink-0 items-center gap-2">
                  <RegStatusPill className="capitalize" tone={statusTone(assessment.conclusion ?? assessment.status)}>
                    {(assessment.conclusion ?? assessment.status).replace(/_/g, ' ')}
                  </RegStatusPill>
                  <RegActionMenu
                    actions={[
                      {
                        icon: ClipboardCheck,
                        label: 'Inspect assessment',
                        onSelect: () => setSelectedItem({ kind: 'assessment', item: assessment }),
                      },
                    ]}
                    label={`Open actions for ${assessment.name}`}
                  />
                </div>
              </div>
              <div className="mt-2 text-sm text-[#6f6578]">
                {assessment.perimeterName ?? 'No perimeter'} · linked review{' '}
                {assessment.complianceAssessmentName ?? 'none'}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Dependency</div>
                  <div className="metric-value">{assessment.dependency}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Penetration</div>
                  <div className="metric-value">{assessment.penetration}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Maturity</div>
                  <div className="metric-value">{assessment.maturity}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Trust</div>
                  <div className="metric-value">{assessment.trust}</div>
                </div>
              </div>
              {assessment.notes && <p className="mt-3 text-sm leading-6 text-[#4f435c]">{assessment.notes}</p>}
            </div>
          ))}
        </div>
      </section>

      <RegRightDrawer
        description={selectedDescription}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setSelectedItem(null)} type="button">
              Close
            </button>
            <button
              className="button-primary"
              disabled={!selectedReference}
              onClick={() => openReference(selectedReference)}
              type="button"
            >
              Open reference
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        open={selectedItem !== null}
        title={selectedTitle}
      >
        {selectedItem?.kind === 'entity' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RegStatusPill tone={entity.isActive ? 'success' : 'neutral'}>
                {entity.isActive ? 'Active' : 'Inactive'}
              </RegStatusPill>
              <RegStatusPill tone="purple">Criticality {entity.defaultCriticality}</RegStatusPill>
              {entity.doraEntityType ? <RegStatusPill tone="info">{entity.doraEntityType}</RegStatusPill> : null}
            </div>
            <p className="text-sm leading-6 text-[#4f435c]">
              {entity.description || 'No entity description provided for this third-party record.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Dependency</div>
                <div className="metric-value">{entity.defaultDependency}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Penetration</div>
                <div className="metric-value">{entity.defaultPenetration}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Maturity</div>
                <div className="metric-value">{entity.defaultMaturity}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Trust</div>
                <div className="metric-value">{entity.defaultTrust}</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#ded8e4] bg-white px-4">
              <DetailRow label="Relationship" value={entity.relationship} />
              <DetailRow label="Country" value={entity.country} />
              <DetailRow label="Currency" value={entity.currency} />
              <DetailRow label="Parent entity" value={entity.parentEntityName ?? 'None'} />
              <DetailRow label="Reference ID" value={entity.refId} />
              <DetailRow label="Mission" value={entity.mission} />
              <DetailRow label="DORA hierarchy" value={entity.doraEntityHierarchy} />
              <DetailRow label="Provider person type" value={entity.doraProviderPersonType} />
              <DetailRow label="Created" value={formatDate(entity.createdAt)} />
              <DetailRow label="Updated" value={formatDate(entity.updatedAt)} />
            </div>
          </div>
        ) : null}

        {selectedItem?.kind === 'solution' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RegStatusPill tone={selectedItem.item.isActive ? 'success' : 'neutral'}>
                {selectedItem.item.isActive ? 'Active' : 'Inactive'}
              </RegStatusPill>
              <RegStatusPill tone="purple">Criticality {selectedItem.item.criticality}</RegStatusPill>
              {selectedItem.item.doraIctServiceType ? (
                <RegStatusPill tone="info">{selectedItem.item.doraIctServiceType}</RegStatusPill>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-[#4f435c]">
              {selectedItem.item.description || 'No solution description provided.'}
            </p>
            <div className="rounded-lg border border-[#ded8e4] bg-white px-4">
              <DetailRow label="Provider" value={selectedItem.item.providerEntityName} />
              <DetailRow label="Recipient" value={selectedItem.item.recipientEntityName} />
              <DetailRow label="Reference ID" value={selectedItem.item.refId} />
              <DetailRow label="Stores data" value={selectedItem.item.storageOfData ? 'Yes' : 'No'} />
              <DetailRow label="Data storage location" value={selectedItem.item.dataLocationStorage} />
              <DetailRow label="Data processing location" value={selectedItem.item.dataLocationProcessing} />
              <DetailRow label="Data sensitivity" value={selectedItem.item.doraDataSensitiveness} />
              <DetailRow label="Reliance level" value={selectedItem.item.doraRelianceLevel} />
              <DetailRow label="Substitutability" value={selectedItem.item.doraSubstitutability} />
              <DetailRow label="Exit plan" value={selectedItem.item.doraHasExitPlan} />
              <DetailRow label="Reintegration possibility" value={selectedItem.item.doraReintegrationPossibility} />
              <DetailRow label="Discontinuing impact" value={selectedItem.item.doraDiscontinuingImpact} />
              <DetailRow label="Alternative providers" value={selectedItem.item.doraAlternativeProviders} />
            </div>
            <div>
              <div className="label">Asset references</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedItem.item.assetRefs.length > 0 ? (
                  selectedItem.item.assetRefs.map((assetRef) => (
                    <span className="status-pill-neutral" key={assetRef}>
                      {assetRef}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#6f6578]">No assets linked.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {selectedItem?.kind === 'contract' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RegStatusPill className="capitalize" tone={statusTone(selectedItem.item.status)}>
                {selectedItem.item.status}
              </RegStatusPill>
              {selectedItem.item.isIntragroup ? <RegStatusPill tone="info">Intragroup</RegStatusPill> : null}
              {selectedItem.item.doraExclude ? <RegStatusPill tone="warning">DORA excluded</RegStatusPill> : null}
            </div>
            <p className="text-sm leading-6 text-[#4f435c]">
              {selectedItem.item.description || 'No contract description provided.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Annual expense</div>
                <div className="metric-value">{formatMoney(selectedItem.item.annualExpense, selectedItem.item.currency ?? 'USD')}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Ends</div>
                <div className="metric-value">{formatDate(selectedItem.item.endDate)}</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#ded8e4] bg-white px-4">
              <DetailRow label="Provider" value={selectedItem.item.providerEntityName} />
              <DetailRow label="Beneficiary" value={selectedItem.item.beneficiaryEntityName} />
              <DetailRow label="Reference ID" value={selectedItem.item.refId} />
              <DetailRow label="Start date" value={formatDate(selectedItem.item.startDate)} />
              <DetailRow label="Currency" value={selectedItem.item.currency} />
              <DetailRow label="Contractual arrangement" value={selectedItem.item.doraContractualArrangement} />
              <DetailRow label="Governing law country" value={selectedItem.item.governingLawCountry} />
              <DetailRow label="Entity notice period" value={selectedItem.item.noticePeriodEntity} />
              <DetailRow label="Provider notice period" value={selectedItem.item.noticePeriodProvider} />
              <DetailRow label="Created" value={formatDate(selectedItem.item.createdAt)} />
              <DetailRow label="Updated" value={formatDate(selectedItem.item.updatedAt)} />
            </div>
            <div>
              <div className="label">Linked solutions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedItem.item.solutions.length > 0 ? (
                  selectedItem.item.solutions.map((solution) => (
                    <span className="status-pill-neutral" key={solution.id}>
                      {solution.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#6f6578]">No linked solution.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {selectedItem?.kind === 'assessment' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RegStatusPill className="capitalize" tone={statusTone(selectedItem.item.status)}>
                {selectedItem.item.status.replace(/_/g, ' ')}
              </RegStatusPill>
              {selectedItem.item.conclusion ? (
                <RegStatusPill className="capitalize" tone={statusTone(selectedItem.item.conclusion)}>
                  {selectedItem.item.conclusion.replace(/_/g, ' ')}
                </RegStatusPill>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-[#4f435c]">{selectedItem.item.notes || 'No assessment notes recorded.'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Criticality</div>
                <div className="metric-value">{selectedItem.item.criticality}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Next review</div>
                <div className="metric-value">{formatDate(selectedItem.item.nextReviewOn)}</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="metric-card">
                <div className="metric-label">Dependency</div>
                <div className="metric-value">{selectedItem.item.dependency}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Penetration</div>
                <div className="metric-value">{selectedItem.item.penetration}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Maturity</div>
                <div className="metric-value">{selectedItem.item.maturity}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Trust</div>
                <div className="metric-value">{selectedItem.item.trust}</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#ded8e4] bg-white px-4">
              <DetailRow label="Entity" value={selectedItem.item.entityName} />
              <DetailRow label="Perimeter" value={selectedItem.item.perimeterName} />
              <DetailRow label="Linked compliance review" value={selectedItem.item.complianceAssessmentName} />
              <DetailRow label="Reference ID" value={selectedItem.item.refId} />
              <DetailRow label="Created" value={formatDate(selectedItem.item.createdAt)} />
              <DetailRow label="Updated" value={formatDate(selectedItem.item.updatedAt)} />
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description={editDescription}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="button-secondary"
              disabled={editSaving}
              onClick={() => {
                setEditItem(null);
                setEditDraft({});
              }}
              type="button"
            >
              Cancel
            </button>
            <button className="button-primary" disabled={editSaving} onClick={() => void saveEdit()} type="button">
              {editSaving ? 'Saving...' : 'Save review'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditItem(null);
            setEditDraft({});
          }
        }}
        open={editItem !== null}
        title={editTitle}
      >
        {editItem?.kind === 'entity' ? (
          <div className="space-y-5">
            <FormField label="Name">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('name', event.target.value)}
                value={editDraft.name ?? ''}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Relationship">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('relationship', event.target.value)}
                  value={editDraft.relationship ?? ''}
                />
              </FormField>
              <FormField label="Reference ID">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('refId', event.target.value)}
                  value={editDraft.refId ?? ''}
                />
              </FormField>
              <FormField label="Country">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('country', event.target.value)}
                  value={editDraft.country ?? ''}
                />
              </FormField>
              <FormField label="Currency">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('currency', event.target.value)}
                  value={editDraft.currency ?? ''}
                />
              </FormField>
            </div>
            <FormField label="Reference link">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('referenceLink', event.target.value)}
                value={editDraft.referenceLink ?? ''}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="DORA entity type">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('doraEntityType', event.target.value)}
                  value={editDraft.doraEntityType ?? ''}
                />
              </FormField>
              <FormField label="DORA hierarchy">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('doraEntityHierarchy', event.target.value)}
                  value={editDraft.doraEntityHierarchy ?? ''}
                />
              </FormField>
            </div>
            <FormField label="Provider person type">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('doraProviderPersonType', event.target.value)}
                value={editDraft.doraProviderPersonType ?? ''}
              />
            </FormField>
            <FormField label="Mission">
              <textarea
                className="input min-h-24 w-full"
                onChange={(event) => setDraftField('mission', event.target.value)}
                value={editDraft.mission ?? ''}
              />
            </FormField>
            <FormField label="Description">
              <textarea
                className="input min-h-28 w-full"
                onChange={(event) => setDraftField('description', event.target.value)}
                value={editDraft.description ?? ''}
              />
            </FormField>
          </div>
        ) : null}

        {editItem?.kind === 'solution' ? (
          <div className="space-y-5">
            <FormField label="Name">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('name', event.target.value)}
                value={editDraft.name ?? ''}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Recipient">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('recipientEntityName', event.target.value)}
                  value={editDraft.recipientEntityName ?? ''}
                />
              </FormField>
              <FormField label="Reference ID">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('refId', event.target.value)}
                  value={editDraft.refId ?? ''}
                />
              </FormField>
              <FormField label="Criticality">
                <input
                  className="input w-full"
                  min="0"
                  onChange={(event) => setDraftField('criticality', event.target.value)}
                  type="number"
                  value={editDraft.criticality ?? ''}
                />
              </FormField>
              <FormField label="Stores data">
                <select
                  className="input w-full"
                  onChange={(event) => setDraftField('storageOfData', event.target.value)}
                  value={editDraft.storageOfData ?? 'false'}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </FormField>
            </div>
            <FormField label="Reference link">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('referenceLink', event.target.value)}
                value={editDraft.referenceLink ?? ''}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="ICT service type">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('doraIctServiceType', event.target.value)}
                  value={editDraft.doraIctServiceType ?? ''}
                />
              </FormField>
              <FormField label="Data sensitivity">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('doraDataSensitiveness', event.target.value)}
                  value={editDraft.doraDataSensitiveness ?? ''}
                />
              </FormField>
              <FormField label="Data storage location">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('dataLocationStorage', event.target.value)}
                  value={editDraft.dataLocationStorage ?? ''}
                />
              </FormField>
              <FormField label="Data processing location">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('dataLocationProcessing', event.target.value)}
                  value={editDraft.dataLocationProcessing ?? ''}
                />
              </FormField>
            </div>
            <FormField label="Reliance level">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('doraRelianceLevel', event.target.value)}
                value={editDraft.doraRelianceLevel ?? ''}
              />
            </FormField>
            <FormField label="Asset references">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('assetRefs', event.target.value)}
                value={editDraft.assetRefs ?? ''}
              />
            </FormField>
            <FormField label="Alternative providers">
              <textarea
                className="input min-h-24 w-full"
                onChange={(event) => setDraftField('doraAlternativeProviders', event.target.value)}
                value={editDraft.doraAlternativeProviders ?? ''}
              />
            </FormField>
            <FormField label="Description">
              <textarea
                className="input min-h-28 w-full"
                onChange={(event) => setDraftField('description', event.target.value)}
                value={editDraft.description ?? ''}
              />
            </FormField>
          </div>
        ) : null}

        {editItem?.kind === 'contract' ? (
          <div className="space-y-5">
            <FormField label="Name">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('name', event.target.value)}
                value={editDraft.name ?? ''}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Status">
                <select
                  className="input w-full"
                  onChange={(event) => setDraftField('status', event.target.value)}
                  value={editDraft.status ?? 'draft'}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </FormField>
              <FormField label="Reference ID">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('refId', event.target.value)}
                  value={editDraft.refId ?? ''}
                />
              </FormField>
              <FormField label="Start date">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('startDate', event.target.value)}
                  type="date"
                  value={editDraft.startDate ?? ''}
                />
              </FormField>
              <FormField label="End date">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('endDate', event.target.value)}
                  type="date"
                  value={editDraft.endDate ?? ''}
                />
              </FormField>
              <FormField label="Currency">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('currency', event.target.value)}
                  value={editDraft.currency ?? ''}
                />
              </FormField>
              <FormField label="Annual expense">
                <input
                  className="input w-full"
                  min="0"
                  onChange={(event) => setDraftField('annualExpense', event.target.value)}
                  type="number"
                  value={editDraft.annualExpense ?? ''}
                />
              </FormField>
              <FormField label="Intragroup">
                <select
                  className="input w-full"
                  onChange={(event) => setDraftField('isIntragroup', event.target.value)}
                  value={editDraft.isIntragroup ?? 'false'}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </FormField>
              <FormField label="Governing law country">
                <input
                  className="input w-full"
                  onChange={(event) => setDraftField('governingLawCountry', event.target.value)}
                  value={editDraft.governingLawCountry ?? ''}
                />
              </FormField>
            </div>
            <FormField label="Contractual arrangement">
              <input
                className="input w-full"
                onChange={(event) => setDraftField('doraContractualArrangement', event.target.value)}
                value={editDraft.doraContractualArrangement ?? ''}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Entity notice period">
                <input
                  className="input w-full"
                  min="0"
                  onChange={(event) => setDraftField('noticePeriodEntity', event.target.value)}
                  type="number"
                  value={editDraft.noticePeriodEntity ?? ''}
                />
              </FormField>
              <FormField label="Provider notice period">
                <input
                  className="input w-full"
                  min="0"
                  onChange={(event) => setDraftField('noticePeriodProvider', event.target.value)}
                  type="number"
                  value={editDraft.noticePeriodProvider ?? ''}
                />
              </FormField>
            </div>
            <FormField label="Description">
              <textarea
                className="input min-h-28 w-full"
                onChange={(event) => setDraftField('description', event.target.value)}
                value={editDraft.description ?? ''}
              />
            </FormField>
          </div>
        ) : null}
      </RegRightDrawer>
    </div>
  );
}
