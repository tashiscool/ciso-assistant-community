import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Download, Eye } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  RegActionMenu,
  RegFilterBar,
  RegPageHeader,
  RegRightDrawer,
  RegStatusPill,
  RegTableShell,
  RegTabs,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { RiskActionPlanItem, RiskAssessment } from './types';

const client = new ApiClient();

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatScore(value: number) {
  return value.toFixed(1);
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete') || normalized.includes('closed')) {
    return 'success';
  }
  if (normalized.includes('progress') || normalized.includes('mitigat')) {
    return 'warning';
  }
  if (normalized.includes('monitor')) {
    return 'info';
  }
  if (normalized.includes('blocked') || normalized.includes('overdue')) {
    return 'danger';
  }
  return 'neutral';
}

function priorityTone(priority: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (priority === 'P1') return 'danger';
  if (priority === 'P2') return 'warning';
  if (priority === 'P3') return 'info';
  return 'neutral';
}

export function RiskAssessmentActionPlanPage() {
  const { identity } = useEdgeIdentity();
  const location = useLocation();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [items, setItems] = useState<RiskActionPlanItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<RiskActionPlanItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActionPlan() {
    if (!assessmentId) {
      setError('Risk assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{
        data: {
          assessment: RiskAssessment;
          actionPlan: RiskActionPlanItem[];
          summary: {
            controlsCount: number;
            totalAnnualCost: number;
            highestResidualScore: number;
            byPriority: Record<string, number>;
            byStatus: Record<string, number>;
          };
        };
      }>(`/core/risk-assessments/${assessmentId}/action-plan`);
      setAssessment(response.data.assessment);
      setItems(response.data.actionPlan);
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
    const byPriority = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.priority] = (acc[item.priority] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalAnnualCost: items.reduce((sum, item) => sum + item.annualCost, 0),
      highestResidualScore: items.reduce((highest, item) => Math.max(highest, item.residualScore), 0),
      p1Items: byPriority.P1 ?? 0,
      fundedItems: items.filter((item) => item.annualCost > 0).length,
      activeTreatments: items.filter((item) => item.status !== 'completed').length,
    };
  }, [items]);

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading risk treatment plan...</div>;
  }

  if (!assessment) {
    return <div className="notice-error">{error ?? 'Risk treatment plan is unavailable.'}</div>;
  }

  const isBudgetOverview = location.pathname.endsWith('/budget-overview');
  const actionPlanUrl = `/risk-assessments/${assessment.id}/action-plan`;
  const budgetOverviewUrl = `${actionPlanUrl}/budget-overview`;
  const pageTitle = isBudgetOverview ? 'Budget Overview' : 'Action Plan';

  return (
    <div className="space-y-6">
      <RegPageHeader
        actions={
          <>
            <Link className="button-secondary" to={`/risk-assessments/${assessment.id}`}>
              Back to assessment
            </Link>
            <button
              className="button-secondary"
              onClick={() => setNotice('Treatment review packet prepared from the current assessment action plan.')}
              type="button"
            >
              <Download className="mr-2 h-4 w-4" />
              Prepare review packet
            </button>
          </>
        }
        description={
          isBudgetOverview
            ? 'Review estimated treatment spend, priority posture, and residual-risk concentration for this assessment.'
            : 'Legacy risk-treatment routes now resolve into a Worker-backed action-plan summary built from the assessment register, scenario posture, and estimated remediation effort.'
        }
        eyebrow="Risk Treatment"
        meta={
          <>
            <RegStatusPill tone="purple">{assessment.status}</RegStatusPill>
            <span>{assessment.name}</span>
            <span>{assessment.riskRegisterName ?? 'Unassigned register'}</span>
          </>
        }
        title={pageTitle}
      />

      <RegTabs
        tabs={[
          { id: 'action-plan', label: 'Action plan', active: !isBudgetOverview, to: actionPlanUrl },
          { id: 'budget-overview', label: 'Budget overview', active: isBudgetOverview, to: budgetOverviewUrl },
        ]}
      />

      {notice && <div className="notice-success">{notice}</div>}

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Treatment items</div>
          <div className="metric-value">{items.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{isBudgetOverview ? 'Active treatments' : 'P1 items'}</div>
          <div className="metric-value">{isBudgetOverview ? summary.activeTreatments : summary.p1Items}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Annual budget</div>
          <div className="metric-value text-2xl">{formatCurrency(summary.totalAnnualCost)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Highest residual</div>
          <div className="metric-value">{formatScore(summary.highestResidualScore)}</div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="metric-card">
          <div className="metric-label">Assessment</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">{assessment.name}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Perimeter</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">
            {assessment.perimeterName ?? assessment.folderName}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Version</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">{assessment.version}</div>
        </div>
      </section>

      {isBudgetOverview && (
        <section className="panel-subtle">
          <div className="label">Budget lens</div>
          <p className="mt-3 text-sm leading-6 text-[#4f435c]">
            Treatment budget is calculated from scenario-derived remediation items so funding conversations remain
            tied to residual risk, priority, effort, and the mapped scenario workspace.
          </p>
        </section>
      )}

      <RegTableShell>
        <RegFilterBar className="justify-between">
          <div className="min-w-0">
            <div className="eyebrow">Treatment queue</div>
            <h2 className="mt-1 text-lg font-semibold text-[#241232]">
              {isBudgetOverview ? 'Budgeted treatment items' : 'Scenario-derived treatment items'}
            </h2>
          </div>
          <RegStatusPill tone="info">Read-only derived plan</RegStatusPill>
        </RegFilterBar>
        <div className="max-h-[min(620px,calc(100vh-300px))] max-w-full overflow-auto">
          <table className="min-w-[1080px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#ded8e4] bg-[#f7f2fa] text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Residual</th>
                <th className="px-4 py-3">Effort</th>
                <th className="px-4 py-3">Annual cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#eeeaf2] align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#241232]">{item.scenarioTitle}</div>
                    <div className="mt-2 text-sm leading-6 text-[#6f6578]">{item.recommendedAction}</div>
                    <div className="mt-2">
                      <Link className="text-xs text-[#6d28d9] transition hover:text-[#5f1aa8]" to={item.targetRoute}>
                        Open mapped scenario workspace
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <RegStatusPill tone={priorityTone(item.priority)}>{item.priority}</RegStatusPill>
                  </td>
                  <td className="px-4 py-4">
                    <RegStatusPill tone={statusTone(item.status)} className="capitalize">
                      {item.status.replace(/_/g, ' ')}
                    </RegStatusPill>
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    {formatScore(item.residualScore)}
                    <div className="mt-1 text-xs text-[#62576a]">
                      Inherent {formatScore(item.inherentScore)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">{item.effort}</td>
                  <td className="px-4 py-4 text-[#4f435c]">{formatCurrency(item.annualCost)}</td>
                  <td className="px-4 py-4 text-right">
                    <RegActionMenu
                      actions={[
                        {
                          label: 'Review treatment',
                          icon: Eye,
                          onSelect: () => setSelectedItem(item),
                        },
                        {
                          label: 'Open mapped scenario workspace',
                          icon: ArrowUpRight,
                          to: item.targetRoute,
                        },
                      ]}
                      label={`Open actions for ${item.scenarioTitle}`}
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={7}>
                    No scenarios are currently in scope for this assessment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </RegTableShell>

      <RegRightDrawer
        description="Review the scenario-derived treatment item before opening the mapped scenario workspace."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setSelectedItem(null)} type="button">
              Close
            </button>
            {selectedItem ? (
              <Link className="button-primary" to={selectedItem.targetRoute}>
                Open mapped scenario
              </Link>
            ) : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        open={Boolean(selectedItem)}
        title={selectedItem?.scenarioTitle ?? 'Review treatment'}
      >
        {selectedItem ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="label">Recommended action</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">{selectedItem.recommendedAction}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Priority</div>
                <div className="mt-3">
                  <RegStatusPill tone={priorityTone(selectedItem.priority)}>{selectedItem.priority}</RegStatusPill>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Status</div>
                <div className="mt-3">
                  <RegStatusPill tone={statusTone(selectedItem.status)} className="capitalize">
                    {selectedItem.status.replace(/_/g, ' ')}
                  </RegStatusPill>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Residual score</div>
                <div className="metric-value">{formatScore(selectedItem.residualScore)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Annual cost</div>
                <div className="metric-value text-2xl">{formatCurrency(selectedItem.annualCost)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Effort</div>
                <div className="mt-3 text-sm font-semibold text-[#241232]">{selectedItem.effort}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Inherent score</div>
                <div className="mt-3 text-sm font-semibold text-[#241232]">
                  {formatScore(selectedItem.inherentScore)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>
    </div>
  );
}
