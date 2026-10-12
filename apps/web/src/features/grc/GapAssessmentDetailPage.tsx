import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RegModal, RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { createEvidencePackage, createReportBundle, generateExecutiveReport, getGapAssessment, waitForGrcJob } from './api';
import type { GapAssessmentDetail, GapAssessmentRow } from './types';

type SnapshotKind = 'exec-summary' | 'board-brief' | 'program-health' | 'automation-coverage';

function gapStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'fail' || normalized === 'failed') {
    return 'danger' as const;
  }
  if (normalized === 'pass' || normalized === 'passed' || normalized === 'ok') {
    return 'success' as const;
  }
  if (normalized === 'partial' || normalized === 'warning') {
    return 'warning' as const;
  }
  return 'neutral' as const;
}

export function GapAssessmentDetailPage() {
  const navigate = useNavigate();
  const { assessmentId = '' } = useParams();
  const [detail, setDetail] = useState<GapAssessmentDetail | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingReport, setCreatingReport] = useState(false);
  const [creatingEvidencePackage, setCreatingEvidencePackage] = useState(false);
  const [generatingSnapshotKind, setGeneratingSnapshotKind] = useState<string | null>(null);
  const [evidencePackageReviewOpen, setEvidencePackageReviewOpen] = useState(false);
  const [reportBundleReviewOpen, setReportBundleReviewOpen] = useState(false);
  const [pendingSnapshotKind, setPendingSnapshotKind] = useState<SnapshotKind | null>(null);
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
      setReportBundleReviewOpen(false);
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
      setEvidencePackageReviewOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the evidence package.');
    } finally {
      setCreatingEvidencePackage(false);
    }
  }

  async function handleGenerateSnapshot(reportKind: SnapshotKind) {
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
      setPendingSnapshotKind(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate the report snapshot.');
    } finally {
      setGeneratingSnapshotKind(null);
    }
  }

  if (loading) {
    return <section className="panel p-6 text-sm text-[#4f435c]">Loading gap assessment...</section>;
  }

  if (!detail) {
    return <section className="panel p-6 text-sm text-[#4f435c]">Gap assessment detail is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance / Gap Assessment"
        title={detail.title}
        description="This assessment expands normalized findings through SCF crosswalks into target framework obligations and packages the results into reusable reporting artifacts."
        actions={
          <>
            <Link className="button-secondary" to="/gap-assessments">
              Back to Gap Assessments
            </Link>
            <button className="button-secondary" disabled={creatingEvidencePackage} onClick={() => setEvidencePackageReviewOpen(true)} type="button">
              {creatingEvidencePackage ? 'Packaging evidence…' : 'Create evidence package'}
            </button>
            <button className="button-primary" disabled={creatingReport} onClick={() => setReportBundleReviewOpen(true)} type="button">
              {creatingReport ? 'Building bundle…' : 'Create report bundle'}
            </button>
          </>
        }
        meta={
          <>
            <RegStatusPill tone="purple">{detail.frameworks.length} frameworks</RegStatusPill>
            <RegStatusPill tone="neutral">{detail.summary.sourceCount} sources</RegStatusPill>
            <RegStatusPill tone="warning">{detail.gapCount} gap rows</RegStatusPill>
            <RegStatusPill tone={detail.summary.aiNarrativeAvailable ? 'success' : 'neutral'}>
              AI narrative {detail.summary.aiNarrativeAvailable ? 'available' : 'pending'}
            </RegStatusPill>
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />

      <section className="panel">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="panel-subtle">
            <div className="label">Frameworks</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{detail.frameworks.join(' · ')}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Sources</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{detail.summary.sourceCount}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Findings</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.findingsCount}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Gap rows</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.gapCount}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">AI narrative</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">
              {detail.summary.aiNarrativeAvailable ? 'Available' : 'Pending'}
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="panel min-w-0 space-y-3">
          <div className="eyebrow">Gap rows</div>
          {detail.rows.map((row) => {
            const active = row.id === selectedRowId;
            return (
              <button
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-[#d7c3f1] bg-[#f2e8ff] text-[#241232]'
                    : 'border-[#ded8e4] bg-[#fbf9fc] text-[#4f435c] hover:border-[#d7c3f1] hover:bg-[#f6f1fa]'
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
                  <RegStatusPill tone={gapStatusTone(row.status)}>{row.status}</RegStatusPill>
                </div>
                <div className="mt-3 text-sm text-[#4f435c]">{row.title}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#62576a]">
                  <span>{row.severity}</span>
                  <span>{row.relatedFindingIds.length} findings</span>
                  <span>{row.mappedTargets.length} targets</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="panel min-w-0">
            <div className="eyebrow">Selected gap</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{selectedRow?.title ?? 'Select a gap row'}</h2>

            {selectedRow ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="panel-subtle">
                    <div className="label">SCF control</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{selectedRow.scfControlId}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Status</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{selectedRow.status}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Severity</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{selectedRow.severity}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Evidence refs</div>
                    <div className="mt-2 text-sm font-semibold text-[#241232]">{selectedRow.evidenceRefs.length}</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5">
                  <div className="eyebrow">Description</div>
                  <div className="mt-3 text-sm leading-6 text-[#4f435c]">
                    {selectedRow.description || 'No SCF description was attached to this control expansion.'}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5">
                  <div className="eyebrow">Mapped target controls</div>
                  <div className="mt-4 grid gap-3">
                    {selectedRow.mappedTargets.map((target) => (
                      <div className="rounded-3xl border border-[#ded8e4] bg-white p-4" key={`${selectedRow.id}-${target.frameworkId}`}>
                        <div className="text-sm font-semibold text-[#241232]">{target.frameworkName}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {target.controlIds.map((controlId) => (
                            <RegStatusPill tone="neutral" key={controlId}>
                              {controlId}
                            </RegStatusPill>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
                Select a gap row from the left to inspect mapped control obligations and remediation context.
              </div>
            )}
          </div>

          <div className="panel min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Report bundles</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Assessment outputs</h2>
              </div>
              <Link className="button-secondary" to={`/report-bundles?assessmentId=${encodeURIComponent(detail.id)}`}>
                View bundle index
              </Link>
            </div>
            <div className="mt-6 grid gap-4">
              {detail.reportBundles.length > 0 ? (
                detail.reportBundles.map((bundle) => (
                  <Link
                    className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
                    key={bundle.id}
                    to={`/report-bundles/${bundle.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">{bundle.reportFamily}</div>
                        <div className="mt-2 text-xl font-semibold text-[#241232]">{bundle.title}</div>
                      </div>
                      <RegStatusPill tone="info">{bundle.status}</RegStatusPill>
                    </div>
                    <div className="mt-3 text-sm text-[#4f435c]">
                      {bundle.narrativeSummary || 'Bundle manifest generated and ready for downstream reporting surfaces.'}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
                  No report bundle exists for this assessment yet.
                </div>
              )}
            </div>
          </div>

          <div className="panel min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Evidence & reporting</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Executive artifacts</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="button-secondary"
                  disabled={generatingSnapshotKind === 'exec-summary'}
                  onClick={() => setPendingSnapshotKind('exec-summary')}
                  type="button"
                >
                  {generatingSnapshotKind === 'exec-summary' ? 'Generating…' : 'Exec summary'}
                </button>
                <button
                  className="button-secondary"
                  disabled={generatingSnapshotKind === 'board-brief'}
                  onClick={() => setPendingSnapshotKind('board-brief')}
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
                    className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
                    href={item.downloadPath}
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">Evidence package</div>
                        <div className="mt-2 text-xl font-semibold text-[#241232]">{item.title}</div>
                      </div>
                      <RegStatusPill tone="info">{item.status}</RegStatusPill>
                    </div>
                    <div className="mt-3 text-sm text-[#4f435c]">
                      Proof-chain manifest with findings, evidence references, and assurance/export links.
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
                  No evidence package has been generated for this assessment yet.
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4">
              {detail.reportSnapshots.length > 0 ? (
                detail.reportSnapshots.map((snapshot) => (
                  <a
                    className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
                    href={snapshot.downloadPath}
                    key={snapshot.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">{snapshot.reportKind}</div>
                        <div className="mt-2 text-xl font-semibold text-[#241232]">{snapshot.title}</div>
                      </div>
                      <RegStatusPill tone="info">{snapshot.status}</RegStatusPill>
                    </div>
                    <div className="mt-3 text-sm text-[#4f435c]">
                      {snapshot.contentMarkdown.slice(0, 180)}
                      {snapshot.contentMarkdown.length > 180 ? '…' : ''}
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
                  No executive report snapshots have been generated for this assessment yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <RegModal
        description="Create a proof-chain package from this assessment's current finding, evidence, and framework mappings."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              disabled={creatingEvidencePackage}
              onClick={() => setEvidencePackageReviewOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="button-primary" disabled={creatingEvidencePackage} onClick={() => void handleCreateEvidencePackage()} type="button">
              {creatingEvidencePackage ? 'Packaging evidence...' : 'Create package'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !creatingEvidencePackage) {
            setEvidencePackageReviewOpen(false);
          }
        }}
        open={evidencePackageReviewOpen}
        title="Create evidence package"
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel-subtle">
              <div className="label">Assessment</div>
              <div className="mt-2 font-semibold text-[#241232]">{detail.title}</div>
            </div>
            <div className="panel-subtle">
              <div className="label">Gap rows</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.gapCount}</div>
            </div>
            <div className="panel-subtle">
              <div className="label">Evidence packages</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.evidencePackages.length}</div>
            </div>
          </div>
          <div className="notice-warning">
            The package is generated from deterministic assessment data first. AI narrative remains explanatory and does not
            override the assessment status.
          </div>
        </div>
      </RegModal>

      <RegModal
        description="Queue a report bundle for this assessment and open the generated bundle after the job completes."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={creatingReport} onClick={() => setReportBundleReviewOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={creatingReport} onClick={() => void handleCreateReport()} type="button">
              {creatingReport ? 'Building bundle...' : 'Create report bundle'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !creatingReport) {
            setReportBundleReviewOpen(false);
          }
        }}
        open={reportBundleReviewOpen}
        title="Create report bundle"
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel-subtle">
              <div className="label">Frameworks</div>
              <div className="mt-2 font-semibold text-[#241232]">{detail.frameworks.join(', ')}</div>
            </div>
            <div className="panel-subtle">
              <div className="label">Current bundles</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.reportBundles.length}</div>
            </div>
            <div className="panel-subtle">
              <div className="label">Findings</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{detail.findingsCount}</div>
            </div>
          </div>
          <div className="notice-warning">
            This keeps the existing report-bundle API path and does not change the source assessment, findings, or evidence records.
          </div>
        </div>
      </RegModal>

      <RegModal
        description={
          pendingSnapshotKind === 'board-brief'
            ? 'Generate a board-facing snapshot from this assessment.'
            : 'Generate an executive summary snapshot from this assessment.'
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              disabled={Boolean(generatingSnapshotKind)}
              onClick={() => setPendingSnapshotKind(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!pendingSnapshotKind || generatingSnapshotKind === pendingSnapshotKind}
              onClick={() => pendingSnapshotKind && void handleGenerateSnapshot(pendingSnapshotKind)}
              type="button"
            >
              {pendingSnapshotKind && generatingSnapshotKind === pendingSnapshotKind ? 'Generating...' : 'Generate snapshot'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !generatingSnapshotKind) {
            setPendingSnapshotKind(null);
          }
        }}
        open={Boolean(pendingSnapshotKind)}
        title={pendingSnapshotKind === 'board-brief' ? 'Generate board brief' : 'Generate executive summary'}
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          <div className="panel-subtle">
            <div className="label">Audience</div>
            <div className="mt-2 font-semibold text-[#241232]">
              {pendingSnapshotKind === 'board-brief' ? 'Board' : 'CISO and program leadership'}
            </div>
          </div>
          <div className="notice-warning">
            Snapshot generation reads the current deterministic gap rows and evidence package state. It does not mutate the
            assessment decisions.
          </div>
        </div>
      </RegModal>
    </div>
  );
}
