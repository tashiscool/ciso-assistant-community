import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { AppliedControl, ComplianceAssessment } from './types';

const client = new ApiClient();

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    : 'n/a';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

export function ComplianceActionPlanPage() {
  const { identity } = useEdgeIdentity();
  const location = useLocation();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [assessment, setAssessment] = useState<ComplianceAssessment | null>(null);
  const [controls, setControls] = useState<AppliedControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActionPlan() {
    if (!assessmentId) {
      setError('Compliance assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{
        data: {
          assessment: ComplianceAssessment;
          appliedControls: AppliedControl[];
          summary: {
            controlsCount: number;
            totalAnnualCost: number;
            byStatus: Record<string, number>;
            byPriority: Record<string, number>;
          };
        };
      }>(`/core/compliance-assessments/${assessmentId}/action-plan`);
      setAssessment(response.data.assessment);
      setControls(response.data.appliedControls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActionPlan();
  }, [identity.tenantId, identity.userId, assessmentId]);

  const summary = useMemo(() => {
    const totalAnnualCost = controls.reduce((sum, control) => sum + (control.annualCost ?? 0), 0);
    const byStatus = controls.reduce<Record<string, number>>((acc, control) => {
      acc[control.status] = (acc[control.status] ?? 0) + 1;
      return acc;
    }, {});
    const byPriority = controls.reduce<Record<string, number>>((acc, control) => {
      const key = control.priority ?? '--';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalAnnualCost,
      openItems: (byStatus.to_do ?? 0) + (byStatus.in_progress ?? 0) + (byStatus.on_hold ?? 0),
      activeItems: byStatus.active ?? 0,
      pendingItems: byStatus['--'] ?? 0,
      controlsCount: controls.length,
      highPriorityItems: (byPriority.P1 ?? 0) + (byPriority.P2 ?? 0),
    };
  }, [controls]);

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading action plan workspace...</div>;
  }

  if (!assessment) {
    return <div className="notice-error">Action plan not found for tenant {identity.tenantId}.</div>;
  }

  const backUrl = `/compliance-assessments/${assessment.id}/action-plan`;
  const backLabel = 'Action Plan';
  const isBudgetOverview = location.pathname.endsWith('/budget-overview');
  const actionPlanUrl = `/compliance-assessments/${assessment.id}/action-plan`;
  const budgetOverviewUrl = `${actionPlanUrl}/budget-overview`;
  const pageTitle = isBudgetOverview ? 'Budget Overview' : 'Action Plan';

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to={`/compliance-assessments/${assessment.id}`}>
            Back to compliance review
          </Link>
          <div className="eyebrow mt-4">Remediation</div>
          <h1 className="mt-2 text-3xl font-semibold text-[#241232]">{pageTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
            {isBudgetOverview
              ? 'Review the annual remediation budget, priority mix, and open work generated from this compliance review.'
              : 'Track the applied controls and remediation work generated from this compliance review.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className={isBudgetOverview ? 'button-secondary' : 'button-primary'} to={actionPlanUrl}>
              Action plan
            </Link>
            <Link className={isBudgetOverview ? 'button-primary' : 'button-secondary'} to={budgetOverviewUrl}>
              Budget overview
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Assessment</div>
              <div className="mt-3 text-sm font-semibold text-[#241232]">{assessment.name}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Framework</div>
              <div className="mt-3 text-sm font-semibold text-[#241232]">{assessment.frameworkName}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Perimeter</div>
              <div className="mt-3 text-sm font-semibold text-[#241232]">
                {assessment.perimeterName ?? assessment.folderName}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{isBudgetOverview ? 'High priority' : 'Version'}</div>
              <div className="metric-value">{isBudgetOverview ? summary.highPriorityItems : assessment.version}</div>
            </div>
          </div>
        </div>

        <div className="panel-subtle space-y-4">
          <div className="flex flex-wrap gap-3">
            <Link
              className="button-primary"
              to={`/applied-controls/flash-mode?complianceAssessmentId=${assessment.id}&backUrl=${encodeURIComponent(backUrl)}&backLabel=${encodeURIComponent(backLabel)}`}
            >
              Open Flash Mode
            </Link>
            <Link
              className="button-secondary"
              to={`/applied-controls/kanban-mode?complianceAssessmentId=${assessment.id}&backUrl=${encodeURIComponent(backUrl)}&backLabel=${encodeURIComponent(backLabel)}`}
            >
              Open Kanban Board
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <div className="metric-label">Annual budget</div>
              <div className="metric-value">{formatCurrency(summary.totalAnnualCost)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Open work</div>
              <div className="metric-value">{summary.openItems}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{isBudgetOverview ? 'Controls costed' : 'Active controls'}</div>
              <div className="metric-value">{isBudgetOverview ? summary.controlsCount : summary.activeItems}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Tracking only</div>
              <div className="metric-value">{summary.pendingItems}</div>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      {isBudgetOverview && (
        <section className="panel-subtle">
          <div className="label">Budget lens</div>
          <p className="mt-3 text-sm leading-6 text-[#4f435c]">
            This view keeps the budget route distinct while preserving the full remediation table below. Costs are
            derived from linked applied controls so budget discussions stay tied to accountable remediation work.
          </p>
        </section>
      )}

      <section className="panel overflow-hidden p-0">
        <div className="overflow-x-auto">
        <table className="min-w-[920px] text-left text-sm">
          <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
            <tr>
              <th className="px-4 py-3">Applied control</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Annual cost</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.id} className="border-t border-[#eeeaf2] align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-[#241232]">
                    {control.refId ? `${control.refId} ` : ''}
                    {control.name}
                  </div>
                  {control.description && (
                    <div className="mt-2 text-sm leading-6 text-[#6f6578]">{control.description}</div>
                  )}
                  {control.requirementAssessment && (
                    <div className="mt-2 text-xs text-[#6d28d9]">
                      Linked requirement: {control.requirementAssessment.ref} {control.requirementAssessment.name}
                    </div>
                  )}
                  {control.assessmentPlanItem && (
                    <div className="mt-2 text-xs text-[#6d28d9]">
                      Linked line of inquiry: {control.assessmentPlanItem.ref} {control.assessmentPlanItem.prompt}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="capitalize text-[#4f435c]">{control.status.replace(/_/g, ' ')}</div>
                  <div className="mt-1 text-xs text-[#62576a]">{control.priority ?? '--'}</div>
                </td>
                <td className="px-4 py-4 text-[#4f435c]">{control.ownerName ?? 'Unassigned'}</td>
                <td className="px-4 py-4 text-[#4f435c]">{formatDate(control.eta)}</td>
                <td className="px-4 py-4 text-[#4f435c]">{formatCurrency(control.annualCost)}</td>
              </tr>
            ))}
            {controls.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={5}>
                  No applied controls are linked to this compliance review yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
