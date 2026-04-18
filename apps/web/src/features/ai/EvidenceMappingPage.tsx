import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Link2, Search, Sparkles, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  createEvidenceMappings,
  deleteEvidenceMapping,
  generateEvidenceRecommendations,
  getEvidenceMappingDetail,
  getEvidenceMappingWorkspace,
} from './api';
import type { EvidenceMappingDetail, EvidenceMappingTarget, EvidenceMappingType, EvidenceMappingWorkspace } from './types';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function badgeClass(status: string) {
  if (status === 'Ready' || status === 'Met') return 'badge-success';
  if (status === 'Missing') return 'badge-danger';
  return 'badge-neutral';
}

export function EvidenceMappingPage() {
  const { identity } = useEdgeIdentity();
  const [workspace, setWorkspace] = useState<EvidenceMappingWorkspace | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvidenceMappingDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'add' | 'ai'>('current');
  const [mappingType, setMappingType] = useState<EvidenceMappingType>('Security Plan');
  const [targetSearch, setTargetSearch] = useState('');
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(50);
  const [selectedRecommendationIds, setSelectedRecommendationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const next = await getEvidenceMappingWorkspace();
      setWorkspace(next);
      setSelectedArtifactId((current) => current ?? next.records[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Evidence Mapping.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(artifactId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getEvidenceMappingDetail(artifactId);
      setDetail(next);
      setSelectedTargetIds([]);
      setSelectedRecommendationIds([]);
      setThreshold(next.recommendations?.threshold ?? 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load evidence detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedArtifactId) {
      void loadDetail(selectedArtifactId);
    } else {
      setDetail(null);
    }
  }, [selectedArtifactId]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Evidence records',
        value: workspace?.readiness.evidenceRecords ?? 0,
        detail: 'Evidence artifacts available for mapping in the canonical Worker runtime.',
      },
      {
        label: 'Security plans',
        value: workspace?.readiness.targetSecurityPlans ?? 0,
        detail: 'Security-plan targets available for evidence linkage.',
      },
      {
        label: 'Components',
        value: workspace?.readiness.targetComponents ?? 0,
        detail: 'Component and solution records available for relationship mapping.',
      },
      {
        label: 'Controls',
        value: workspace?.readiness.targetControls ?? 0,
        detail: 'Applied control implementations available for direct mapping.',
      },
    ];
  }, [workspace]);

  const currentTargets = useMemo<EvidenceMappingTarget[]>(() => {
    if (!detail) return [];
    const list =
      mappingType === 'Security Plan'
        ? detail.targets.securityPlans
        : mappingType === 'Component'
          ? detail.targets.components
          : detail.targets.controls;
    const query = targetSearch.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter((target) => `${target.title} ${target.parentLabel} ${target.description}`.toLowerCase().includes(query));
  }, [detail, mappingType, targetSearch]);

  const filteredRecommendations = useMemo(() => {
    return (detail?.recommendations?.items ?? []).filter((item) => item.score >= threshold);
  }, [detail?.recommendations?.items, threshold]);

  async function handleCreateMappings(targetIds: string[], nextType: EvidenceMappingType) {
    if (!detail) return;
    try {
      setBusy('create-mappings');
      setError(null);
      const next = await createEvidenceMappings(detail.artifact.id, { mappingType: nextType, targetIds });
      setDetail(next);
      await loadWorkspace();
      setSelectedTargetIds([]);
      setNotice(`${targetIds.length} mapping(s) created for ${detail.artifact.title}.`);
      setActiveTab('current');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create evidence mappings.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteMapping(mappingId: string) {
    if (!detail) return;
    try {
      setBusy(`delete:${mappingId}`);
      setError(null);
      const next = await deleteEvidenceMapping(detail.artifact.id, mappingId);
      setDetail(next);
      await loadWorkspace();
      setNotice('Mapping removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete mapping.');
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateRecommendations() {
    if (!detail) return;
    try {
      setBusy('generate-recommendations');
      setError(null);
      const next = await generateEvidenceRecommendations(detail.artifact.id, threshold);
      setDetail(next);
      await loadWorkspace();
      setSelectedRecommendationIds([]);
      setNotice('RegML-style mapping recommendations generated from canonical target metadata.');
      setActiveTab('ai');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate mapping recommendations.');
    } finally {
      setBusy(null);
    }
  }

  if (loading || !workspace) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Evidence Mapping...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Evidence Mapping</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Link evidence documents to controls, plans, and components</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Open an evidence record, review existing mappings, add new relationships by target type, and apply recommendation-driven mappings from the canonical Cloudflare data plane.
          </p>
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Prerequisites</div>
          {([
            ['Evidence module enabled', workspace.readiness.evidenceModuleEnabled],
            ['Mapping permissions available', workspace.readiness.canMapEvidence],
            ['AI suggestion engine available', workspace.readiness.aiRecommendationsAvailable],
            ['Vector database deployed', workspace.readiness.vectorDatabaseDeployed],
            ['Evidence records exist', workspace.readiness.evidenceRecords > 0],
            ['Security plans available', workspace.readiness.targetSecurityPlans > 0],
            ['Components available', workspace.readiness.targetComponents > 0],
            ['Controls available', workspace.readiness.targetControls > 0],
          ] as Array<[string, boolean]>).map(([label, ready]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm">
              <span className="text-slate-300">{label}</span>
              <span className={ready ? 'badge-success' : 'badge-danger'}>{ready ? 'Ready' : 'Missing'}</span>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel-subtle">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{metric.value}</div>
            <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.76fr_1.24fr]">
        <section className="panel space-y-4">
          <div>
            <div className="eyebrow">Evidence Records</div>
            <div className="mt-2 text-lg font-semibold text-white">Current Mapping Context</div>
          </div>
          <div className="space-y-3">
            {workspace.records.map((record) => (
              <button
                key={record.id}
                className={`panel-subtle w-full text-left ${selectedArtifactId === record.id ? 'border-cyan-300/40 bg-cyan-400/[0.06]' : ''}`}
                onClick={() => setSelectedArtifactId(record.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{record.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{record.sourceName}</div>
                  </div>
                  <span className={badgeClass(record.status)}>{record.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-400">
                  <div>{record.mappingCount} current mapping(s)</div>
                  <div>{record.recommendationCount} recommendation run(s)</div>
                  <div>{formatDate(record.uploadedAt)}</div>
                </div>
              </button>
            ))}
            {workspace.records.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                No evidence artifacts are available for mapping yet.
              </div>
            )}
          </div>
        </section>

        <section className="panel space-y-4">
          {detailLoading && <div className="text-sm text-slate-400">Loading mapping detail...</div>}
          {!detailLoading && detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Mappings</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{detail.artifact.title}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    {detail.artifact.sourceName} · {detail.artifact.objectKey}
                  </div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="current">Current Mappings</TabsTrigger>
                  <TabsTrigger value="add">Add Mappings</TabsTrigger>
                  <TabsTrigger value="ai">AI Recommendations</TabsTrigger>
                </TabsList>

                <TabsContent value="current" className="mt-6 space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Mapping ID</th>
                          <th className="px-4 py-3">Mapped ID</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Title</th>
                          <th className="px-4 py-3">Parent</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.mappings.map((mapping) => (
                          <tr key={mapping.id} className="border-t border-white/5">
                            <td className="px-4 py-3 text-slate-300">{mapping.id}</td>
                            <td className="px-4 py-3 font-medium text-white">{mapping.mappedId}</td>
                            <td className="px-4 py-3 text-slate-400">{mapping.mappingType}</td>
                            <td className="px-4 py-3 text-slate-300">{mapping.mappingTitle}</td>
                            <td className="px-4 py-3 text-slate-400">{mapping.parentLabel ?? '—'}</td>
                            <td className="px-4 py-3">
                              <button className="button-secondary text-rose-200" onClick={() => void handleDeleteMapping(mapping.id)}>
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {detail.mappings.length === 0 && (
                          <tr>
                            <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>
                              No mappings exist for this evidence record yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="add" className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-[0.32fr_0.68fr]">
                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Mapping Type</span>
                        <select className="input" value={mappingType} onChange={(event) => setMappingType(event.target.value as EvidenceMappingType)}>
                          <option value="Security Plan">Security Plans</option>
                          <option value="Component">Components</option>
                          <option value="Control">Controls</option>
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Search targets</span>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <input className="input pl-10" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Search plans, components, or controls" />
                        </div>
                      </label>
                      <button className="button-primary" disabled={selectedTargetIds.length === 0 || busy !== null} onClick={() => void handleCreateMappings(selectedTargetIds, mappingType)}>
                        <Link2 className="h-4 w-4" />
                        Create Mappings
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Select</th>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Parent</th>
                            <th className="px-4 py-3">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentTargets.map((target) => {
                            const alreadyMapped = detail.mappings.some(
                              (mapping) => mapping.mappingType === target.mappingType && mapping.mappedId === target.id,
                            );
                            return (
                              <tr key={target.id} className="border-t border-white/5">
                                <td className="px-4 py-3">
                                  <input
                                    checked={selectedTargetIds.includes(target.id)}
                                    disabled={alreadyMapped}
                                    onChange={(event) =>
                                      setSelectedTargetIds((current) =>
                                        event.target.checked ? [...current, target.id] : current.filter((id) => id !== target.id),
                                      )
                                    }
                                    type="checkbox"
                                  />
                                </td>
                                <td className="px-4 py-3 font-medium text-white">
                                  {target.title}
                                  {alreadyMapped && <div className="mt-1 text-xs text-cyan-300">Already mapped</div>}
                                </td>
                                <td className="px-4 py-3 text-slate-400">{target.parentLabel}</td>
                                <td className="px-4 py-3 text-slate-300">{target.description}</td>
                              </tr>
                            );
                          })}
                          {currentTargets.length === 0 && (
                            <tr>
                              <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                                No mapping targets matched the current selection.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-[0.32fr_0.68fr]">
                    <div className="space-y-4">
                      <div className="panel-subtle">
                        <div className="text-sm font-medium text-white">Recommendation Controls</div>
                        <div className="mt-3 text-sm text-slate-300">Relevance threshold: {threshold}</div>
                        <input
                          className="mt-3 w-full accent-cyan-300"
                          max={100}
                          min={0}
                          onChange={(event) => setThreshold(Number(event.target.value))}
                          type="range"
                          value={threshold}
                        />
                        <button className="button-primary mt-4 w-full" disabled={busy !== null} onClick={() => void handleGenerateRecommendations()}>
                          <Sparkles className="h-4 w-4" />
                          Generate Recommendations
                        </button>
                        {detail.recommendations && (
                          <div className="mt-4 text-xs text-slate-500">
                            Last run {formatDate(detail.recommendations.createdAt)} · threshold {detail.recommendations.threshold}
                          </div>
                        )}
                      </div>
                      <button
                        className="button-secondary w-full"
                        disabled={selectedRecommendationIds.length === 0 || busy !== null}
                        onClick={() => {
                          const grouped = new Map<EvidenceMappingType, string[]>();
                          for (const item of detail.recommendations?.items ?? []) {
                            if (!selectedRecommendationIds.includes(item.id)) continue;
                            grouped.set(item.mappingType, [...(grouped.get(item.mappingType) ?? []), item.mappedId]);
                          }
                          void (async () => {
                            for (const [type, ids] of grouped.entries()) {
                              await handleCreateMappings(ids, type);
                            }
                            setSelectedRecommendationIds([]);
                          })();
                        }}
                      >
                        Apply Selected
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Select</th>
                            <th className="px-4 py-3">Target</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecommendations.map((recommendation) => (
                            <tr key={recommendation.id} className="border-t border-white/5">
                              <td className="px-4 py-3">
                                <input
                                  checked={selectedRecommendationIds.includes(recommendation.id)}
                                  onChange={(event) =>
                                    setSelectedRecommendationIds((current) =>
                                      event.target.checked
                                        ? [...current, recommendation.id]
                                        : current.filter((id) => id !== recommendation.id),
                                    )
                                  }
                                  type="checkbox"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-white">{recommendation.title}</div>
                                <div className="mt-1 text-xs text-slate-500">{recommendation.mappingType} · {recommendation.parentLabel}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={badgeClass(recommendation.score >= 70 ? 'Ready' : recommendation.score >= 50 ? 'Derived' : 'Missing')}>
                                  {recommendation.score}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-300">{recommendation.rationale}</td>
                            </tr>
                          ))}
                          {filteredRecommendations.length === 0 && (
                            <tr>
                              <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                                No recommendations matched the current threshold yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-400">
              Open an evidence record to review current mappings and recommendation workflows.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
