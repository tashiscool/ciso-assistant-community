import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';
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
    return <section className="panel p-6 text-sm text-[#4f435c]">Loading report bundle...</section>;
  }

  if (!bundle) {
    return <section className="panel p-6 text-sm text-[#4f435c]">Report bundle detail is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance / Evidence Package"
        title={bundle.title}
        description="This bundle packages the assessment narrative, metadata, mapped findings, and export-ready manifest for downstream reporting and compliance submission surfaces."
        actions={
          <>
            <Link className="button-secondary" to="/report-bundles">
              Back to Report Bundles
            </Link>
            <a className="button-primary" href={bundle.downloadPath}>
              Download manifest
            </a>
          </>
        }
        meta={
          <>
            <RegStatusPill tone="info">{bundle.status}</RegStatusPill>
            <RegStatusPill tone="neutral">{bundle.reportFamily}</RegStatusPill>
            <RegStatusPill tone="purple">Assessment {bundle.assessmentId}</RegStatusPill>
            <RegStatusPill tone="neutral">AI {bundle.aiProvider ?? 'fallback'}</RegStatusPill>
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />

      <section className="panel">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Assessment</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{bundle.assessmentId}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Status</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{bundle.status}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">AI provider</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{bundle.aiProvider ?? 'fallback'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Report family</div>
            <div className="mt-2 text-sm font-semibold text-[#241232]">{bundle.reportFamily}</div>
          </div>
        </div>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel min-w-0">
          <div className="eyebrow">Narrative summary</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Assessment storyline</h2>
          <div className="mt-6 rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 text-sm leading-7 text-[#4f435c]">
            {bundle.narrativeSummary || 'No narrative summary was generated for this bundle.'}
          </div>

          <div className="mt-6">
            <div className="eyebrow">Manifest payload</div>
            <pre className="mt-4 overflow-x-auto rounded-3xl border border-[#ded8e4] bg-white p-5 text-xs leading-6 text-[#4f435c]">
              {JSON.stringify(bundle.manifest, null, 2)}
            </pre>
          </div>
        </div>

        <div className="panel min-w-0 space-y-4">
          <div>
            <div className="eyebrow">Connected surfaces</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Next step</h2>
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
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 text-sm leading-6 text-[#4f435c]">
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
