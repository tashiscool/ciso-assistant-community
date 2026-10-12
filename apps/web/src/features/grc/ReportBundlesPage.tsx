import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { getReportBundles } from './api';
import type { ReportBundle } from './types';

export function ReportBundlesPage() {
  const [searchParams] = useSearchParams();
  const [bundles, setBundles] = useState<ReportBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const assessmentId = searchParams.get('assessmentId') ?? undefined;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await getReportBundles(assessmentId);
        if (!cancelled) {
          setBundles(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load report bundles.');
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

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance / Evidence Packages"
        title="Report Bundle View"
        description="Review generated evidence-package metadata, AI-authored summaries, and downstream manifest payloads that connect assessments into reporting and compliance-export flows."
        meta={
          <>
            <RegStatusPill tone="neutral">{bundles.length} bundles</RegStatusPill>
            {assessmentId ? <RegStatusPill tone="purple">Assessment filter active</RegStatusPill> : null}
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Bundle catalog</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Generated outputs</h2>
          </div>
          {assessmentId ? <RegStatusPill tone="purple">Assessment filter active</RegStatusPill> : null}
        </div>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
            Loading report bundles...
          </div>
        ) : null}

        {!loading && bundles.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
            No report bundles are available for the current scope yet.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {bundles.map((bundle) => (
            <Link
              className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
              key={bundle.id}
              to={`/report-bundles/${bundle.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{bundle.reportFamily}</div>
                  <h3 className="mt-2 text-xl font-semibold text-[#241232]">{bundle.title}</h3>
                </div>
                <RegStatusPill tone="info">{bundle.status}</RegStatusPill>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Assessment</div>
                  <div className="mt-2 text-sm font-semibold text-[#241232]">{bundle.assessmentId}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">AI provider</div>
                  <div className="mt-2 text-sm font-semibold text-[#241232]">{bundle.aiProvider ?? 'fallback'}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Created</div>
                  <div className="mt-2 text-sm font-semibold text-[#241232]">{new Date(bundle.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Download</div>
                  <div className="mt-2 text-sm font-semibold text-[#7a3ccf]">Manifest ready</div>
                </div>
              </div>
              <div className="mt-4 text-sm leading-6 text-[#4f435c]">
                {bundle.narrativeSummary || 'Bundle manifest generated and ready for compliance export or reporting distribution.'}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
