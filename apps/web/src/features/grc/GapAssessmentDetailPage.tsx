import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createEvidencePackage, createReportBundle, generateExecutiveReport, getGapAssessment, waitForGrcJob } from './api';
import type { GapAssessmentDetail, GapAssessmentRow } from './types';

export function GapAssessmentDetailPage() {
  const navigate = useNavigate();
  const { assessmentId = '' } = useParams();
  const [detail, setDetail] = useState<GapAssessmentDetail | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingReport, setCreatingReport] = useState(false);
  const [creatingEvidencePackage, setCreatingEvidencePackage] = useState(false);
  const [generatingSnapshotKind, setGeneratingSnapshotKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await getGapAssessment(assessmentId);
        if (!cancelled) {
          setDetail(response);
          setSelectedRowId((current) => current ?? response.rows[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the gap assessment.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  const selectedRow = useMemo<GapAssessmentRow | null>(
    () => detail?.rows.find((row) => row.id === selectedRowId) ?? null,
    [detail, selectedRowId],
  );

  async function handleCreateReport() {
    try {
      setCreatingReport(true);
      setError(null);
      const queued = await createReportBundle(assessmentId);
      const job = await waitForGrcJob(queued.jobId);
      const bundleId = typeof job.result.reportBundleId === 'string' ? job.result.reportBundleId : null;
      if (!bundleId) {
        throw new Error('Report bundle job completed without a bundle id.');
      }
      navigate(`/report-bundles/${bundleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the report bundle.');
    } finally {
      setCreatingReport(false);
    }
  }

  async function handleCreateEvidencePackage() {
    try {
      setCreatingEvidencePackage(true);
      setError(null);
      const queued = await createEvidencePackage(assessmentId);
      await waitForGrcJob(queued.jobId);
      const refreshed = await getGapAssessment(assessmentId);
      setDetail(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the evidence package.');
    } finally {
      setCreatingEvidencePackage(false);
    }
  }

  async function handleGenerateSnapshot(reportKind: 'exec-summary' | 'board-brief' | 'program-health' | 'automation-coverage') {
    try {
      setGeneratingSnapshotKind(reportKind);
      setError(null);
      const queued = await generateExecutiveReport(reportKind, {
        assessmentId,
        audience: reportKind === 'board-brief' ? 'board' : 'ciso',
      });
      await waitForGrcJob(queued.jobId);
      const refreshed = await getGapAssessment(assessmentId);
      setDetail(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate the report snapshot.');
    } finally {
      setGeneratingSnapshotKind(null);
    }
  }

  if (loading) {
    return <section className="panel p-6 text-sm text-slate-300">Loading gap assessment...</section>;
  }

  if (!detail) {
    return <section className="panel p-6 text-sm text-slate-300">Gap assessment detail is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-300 transition hover:text-cyan-200" to="/gap-assessments">
          ← Back to Gap Assessments
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Gap Assessment</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{detail.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              This assessment expands normalized findings through SCF crosswalks into target framework obligations and
              packages the results into reusable reporting artifacts.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="button-secondary" disabled={creatingEvidencePackage} onClick={() => void handleCreateEvidencePackage()} type="button">
              {creatingEvidencePackage ? 'Packaging evidence…' : 'Create evidence package'}
            </button>
            <button className="button-primary" disabled={creatingReport} onClick={() => void handleCreateReport()} type="button">
              {creatingReport ? 'Building bundle…' : 'Create report bundle'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <div className="panel-subtle">
            <div className="label">Frameworks</div>
            <div className="mt-2 text-sm font-semibold text-white">{detail.frameworks.join(' · ')}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Sources</div>
            <div className="mt-2 text-sm font-semibold text-white">{detail.summary.sourceCount}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Findings</div>
            <div className="mt-2 text-2xl font-semibold text-white">{detail.findingsCount}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Gap rows</div>
            <div className="mt-2 text-2xl font-semibold text-white">{detail.gapCount}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">AI narrative</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {detail.summary.aiNarrativeAvailable ? 'Available' : 'Pending'}
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="panel space-y-3">
          <div className="eyebrow">Gap rows</div>
          {detail.rows.map((row) => {
            const active = row.id === selectedRowId;
            return (
              <button
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-cyan-300/30 bg-cyan-400/[0.06] text-white'
                    : 'border-white/10 bg-slate-950/20 text-slate-300 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                }`}
                key={row.id}
                onClick={() => setSelectedRowId(row.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{row.sourceFramework}</div>
                    <div className="mt-2 text-base font-semibold">{row.scfControlId}</div>
                  </div>
                  <span className={row.status === 'fail' ? 'badge-warning' : 'badge-neutral'}>{row.status}</span>
                </div>
                <div className="mt-3 text-sm text-slate-300">{row.title}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{row.severity}</span>
                  <span>{row.relatedFindingIds.length} findings</span>
                  <span>{row.mappedTargets.length} targets</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="panel">
            <div className="eyebrow">Selected gap</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">{selectedRow?.title ?? 'Select a gap row'}</h2>

            {selectedRow ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="panel-subtle">
                    <div className="label">SCF control</div>
                    <div className="mt-2 text-sm font-semibold text-white">{selectedRow.scfControlId}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Status</div>
                    <div className="mt-2 text-sm font-semibold text-white">{selectedRow.status}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Severity</div>
                    <div className="mt-2 text-sm font-semibold text-white">{selectedRow.severity}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Evidence refs</div>
                    <div className="mt-2 text-sm font-semibold text-white">{selectedRow.evidenceRefs.length}</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="eyebrow">Description</div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">
                    {selectedRow.description || 'No SCF description was attached to this control expansion.'}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="eyebrow">Mapped target controls</div>
                  <div className="mt-4 grid gap-3">
                    {selectedRow.mappedTargets.map((target) => (
                      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4" key={`${selectedRow.id}-${target.frameworkId}`}>
                        <div className="text-sm font-semibold text-white">{target.frameworkName}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {target.controlIds.map((controlId) => (
                            <span className="badge-neutral" key={controlId}>
                              {controlId}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                Select a gap row from the left to inspect mapped control obligations and remediation context.
              </div>
            )}
          </div>

          <div className="panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Report bundles</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Assessment outputs</h2>
              </div>
              <Link className="button-secondary" to={`/report-bundles?assessmentId=${encodeURIComponent(detail.id)}`}>
                View bundle index
              </Link>
            </div>
            <div className="mt-6 grid gap-4">
              {detail.reportBundles.length > 0 ? (
                detail.reportBundles.map((bundle) => (
                  <Link
                    className="rounded-3xl border border-white/10 bg-slate-950/30 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                    key={bundle.id}
                    to={`/report-bundles/${bundle.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">{bundle.reportFamily}</div>
                        <div className="mt-2 text-xl font-semibold text-white">{bundle.title}</div>
                      </div>
                      <span className="badge-neutral">{bundle.status}</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      {bundle.narrativeSummary || 'Bundle manifest generated and ready for downstream reporting surfaces.'}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                  No report bundle exists for this assessment yet.
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Evidence & reporting</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Executive artifacts</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="button-secondary"
                  disabled={generatingSnapshotKind === 'exec-summary'}
                  onClick={() => void handleGenerateSnapshot('exec-summary')}
                  type="button"
                >
                  {generatingSnapshotKind === 'exec-summary' ? 'Generating…' : 'Exec summary'}
                </button>
                <button
                  className="button-secondary"
                  disabled={generatingSnapshotKind === 'board-brief'}
                  onClick={() => void handleGenerateSnapshot('board-brief')}
                  type="button"
                >
                  {generatingSnapshotKind === 'board-brief' ? 'Generating…' : 'Board brief'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {detail.evidencePackages.length > 0 ? (
                detail.evidencePackages.map((item) => (
                  <a
                    className="rounded-3xl border border-white/10 bg-slate-950/30 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                    href={item.downloadPath}
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">Evidence package</div>
                        <div className="mt-2 text-xl font-semibold text-white">{item.title}</div>
                      </div>
                      <span className="badge-neutral">{item.status}</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      Proof-chain manifest with findings, evidence references, and assurance/export links.
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                  No evidence package has been generated for this assessment yet.
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4">
              {detail.reportSnapshots.length > 0 ? (
                detail.reportSnapshots.map((snapshot) => (
                  <a
                    className="rounded-3xl border border-white/10 bg-slate-950/30 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                    href={snapshot.downloadPath}
                    key={snapshot.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">{snapshot.reportKind}</div>
                        <div className="mt-2 text-xl font-semibold text-white">{snapshot.title}</div>
                      </div>
                      <span className="badge-neutral">{snapshot.status}</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      {snapshot.contentMarkdown.slice(0, 180)}
                      {snapshot.contentMarkdown.length > 180 ? '…' : ''}
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                  No executive report snapshots have been generated for this assessment yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
