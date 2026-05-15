import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
      <section className="panel">
        <div className="eyebrow">Evidence Packages</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Report Bundle View</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Review generated evidence-package metadata, AI-authored summaries, and downstream manifest payloads that
          connect assessments into reporting and compliance-export flows.
        </p>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Bundle catalog</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Generated outputs</h2>
          </div>
          {assessmentId ? <span className="badge-neutral">Assessment filter active</span> : null}
        </div>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
            Loading report bundles...
          </div>
        ) : null}

        {!loading && bundles.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
            No report bundles are available for the current scope yet.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {bundles.map((bundle) => (
            <Link
              className="rounded-3xl border border-white/10 bg-slate-950/30 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
              key={bundle.id}
              to={`/report-bundles/${bundle.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{bundle.reportFamily}</div>
                  <h3 className="mt-2 text-xl font-semibold text-white">{bundle.title}</h3>
                </div>
                <span className="badge-neutral">{bundle.status}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Assessment</div>
                  <div className="mt-2 text-sm font-semibold text-white">{bundle.assessmentId}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">AI provider</div>
                  <div className="mt-2 text-sm font-semibold text-white">{bundle.aiProvider ?? 'fallback'}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Created</div>
                  <div className="mt-2 text-sm font-semibold text-white">{new Date(bundle.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Download</div>
                  <div className="mt-2 text-sm font-semibold text-cyan-300">Manifest ready</div>
                </div>
              </div>
              <div className="mt-4 text-sm leading-6 text-slate-300">
                {bundle.narrativeSummary || 'Bundle manifest generated and ready for compliance export or reporting distribution.'}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

