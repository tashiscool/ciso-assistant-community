import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getReportBundle } from './api';
import type { ReportBundle } from './types';

export function ReportBundleDetailPage() {
  const { bundleId = '' } = useParams();
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await getReportBundle(bundleId);
        if (!cancelled) {
          setBundle(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the report bundle.');
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
  }, [bundleId]);

  if (loading) {
    return <section className="panel p-6 text-sm text-slate-300">Loading report bundle...</section>;
  }

  if (!bundle) {
    return <section className="panel p-6 text-sm text-slate-300">Report bundle detail is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-300 transition hover:text-cyan-200" to="/report-bundles">
          ← Back to Report Bundles
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Evidence Package</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{bundle.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              This bundle packages the assessment narrative, metadata, mapped findings, and export-ready manifest for
              downstream reporting and compliance submission surfaces.
            </p>
          </div>
          <a className="button-primary" href={bundle.downloadPath}>
            Download manifest
          </a>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Assessment</div>
            <div className="mt-2 text-sm font-semibold text-white">{bundle.assessmentId}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Status</div>
            <div className="mt-2 text-sm font-semibold text-white">{bundle.status}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">AI provider</div>
            <div className="mt-2 text-sm font-semibold text-white">{bundle.aiProvider ?? 'fallback'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Report family</div>
            <div className="mt-2 text-sm font-semibold text-white">{bundle.reportFamily}</div>
          </div>
        </div>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel">
          <div className="eyebrow">Narrative summary</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Assessment storyline</h2>
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/30 p-5 text-sm leading-7 text-slate-300">
            {bundle.narrativeSummary || 'No narrative summary was generated for this bundle.'}
          </div>

          <div className="mt-6">
            <div className="eyebrow">Manifest payload</div>
            <pre className="mt-4 overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/40 p-5 text-xs leading-6 text-slate-300">
              {JSON.stringify(bundle.manifest, null, 2)}
            </pre>
          </div>
        </div>

        <div className="panel space-y-4">
          <div>
            <div className="eyebrow">Connected surfaces</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Next step</h2>
          </div>
          <Link className="button-secondary w-full justify-center" to={`/gap-assessments/${bundle.assessmentId}`}>
            Open source assessment
          </Link>
          <Link className="button-secondary w-full justify-center" to="/reports">
            Open reports
          </Link>
          <Link className="button-secondary w-full justify-center" to="/compliance-exports">
            Open compliance exports
          </Link>
          <Link className="button-secondary w-full justify-center" to="/framework-library">
            Return to framework library
          </Link>
          {bundle.manifest.connectedSurfaces && typeof bundle.manifest.connectedSurfaces === 'object' ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
              <div className="eyebrow">Connected delivery</div>
              <div className="mt-3">
                The bundle is structured so assurance, reports, and compliance-export surfaces can reuse the same
                normalized findings manifest without duplicating control mapping work.
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
