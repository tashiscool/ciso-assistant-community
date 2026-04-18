import { Link, useParams } from 'react-router-dom';

export function RiskAssessmentConversionPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Quantitative Migration</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Convert to Quantitative Study</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          The legacy conversion route now maps to the quantitative workbench. Use the existing risk
          assessment context to open or create a quantitative study and continue the modeling flow in
          the Cloudflare/React app.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="button-primary" to="/advanced-risk/quantitative">
            Open Quantitative Workspace
          </Link>
          <Link className="button-secondary" to={`/risk-assessments/${assessmentId ?? ''}`}>
            Back to Risk Assessment
          </Link>
        </div>
      </section>
    </div>
  );
}
