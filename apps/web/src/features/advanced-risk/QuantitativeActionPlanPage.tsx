import { useEffect, useState } from 'react';
import { ArrowUpRight, Download, Eye } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  RegActionMenu,
  RegFilterBar,
  RegPageHeader,
  RegRightDrawer,
  RegStatusPill,
  RegTableShell,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeAction, QuantitativeStudy } from './types';

const client = new ApiClient();

function formatCurrency(value: number | null, currency: string) {
  if (typeof value !== 'number') {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete') || normalized.includes('done') || normalized.includes('approved')) {
    return 'success';
  }
  if (normalized.includes('blocked') || normalized.includes('failed')) {
    return 'danger';
  }
  if (normalized.includes('progress') || normalized.includes('planned')) {
    return 'warning';
  }
  if (normalized.includes('review') || normalized.includes('monitor')) {
    return 'info';
  }
  return 'neutral';
}

export function QuantitativeActionPlanPage() {
  const { identity } = useEdgeIdentity();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [actionPlan, setActionPlan] = useState<QuantitativeAction[]>([]);
  const [budget, setBudget] = useState(0);
  const [selectedAction, setSelectedAction] = useState<QuantitativeAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActionPlan() {
    if (!studyId) {
      setError('Quantitative study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{
        data: { study: QuantitativeStudy; actionPlan: QuantitativeAction[]; budget: number };
      }>(`/ops/quantitative-studies/${studyId}/action-plan`);
      setStudy(response.data.study);
      setActionPlan(response.data.actionPlan);
      setBudget(response.data.budget);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActionPlan();
  }, [identity.tenantId, identity.userId, studyId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading quantitative action plan...</div>;
  }

  if (!study) {
    return <div className="notice-error">Quantitative action plan unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        actions={
          <>
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}`}>
              Back to study
            </Link>
            <button
              className="button-secondary"
              onClick={() => setNotice('Review packet prepared from the current quantitative action plan.')}
              type="button"
            >
              <Download className="mr-2 h-4 w-4" />
              Prepare review packet
            </button>
          </>
        }
        description="Turn scenario economics into a prioritized set of treatment initiatives and budget asks. Actions are derived from scenario treatment data so deterministic risk economics stay visually primary."
        eyebrow="Action Plan"
        meta={
          <>
            <RegStatusPill tone="purple">{study.status}</RegStatusPill>
            <span>{formatCurrency(budget, study.currency)} budget</span>
            <span>{actionPlan.length} actions</span>
          </>
        }
        title={study.name}
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Budget</div>
          <div className="metric-value text-2xl">{formatCurrency(budget, study.currency)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Actions</div>
          <div className="metric-value">{actionPlan.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Assigned</div>
          <div className="metric-value">{actionPlan.filter((item) => item.ownerName).length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Scenario links</div>
          <div className="metric-value">{actionPlan.filter((item) => item.scenarioId).length}</div>
        </div>
      </section>

      <RegTableShell>
        <RegFilterBar className="justify-between">
          <div className="min-w-0">
            <div className="eyebrow">Treatment queue</div>
            <h2 className="mt-1 text-lg font-semibold text-[#241232]">Scenario-derived actions</h2>
          </div>
          <RegStatusPill tone="info">Read-only derived plan</RegStatusPill>
        </RegFilterBar>
        <div className="max-h-[min(620px,calc(100vh-300px))] max-w-full overflow-auto">
          <table className="min-w-[960px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#ded8e4] bg-[#f7f2fa] text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Annual cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {actionPlan.map((item) => (
                <tr key={item.id} className="border-t border-[#eeeaf2] align-top">
                  <td className="px-4 py-4 font-medium text-[#241232]">{item.title}</td>
                  <td className="px-4 py-4 text-[#4f435c]">{item.ownerName ?? 'Unassigned'}</td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    <RegStatusPill tone={statusTone(item.status)} className="capitalize">
                      {item.status}
                    </RegStatusPill>
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">{item.scenarioName}</td>
                  <td className="px-4 py-4 text-[#4f435c]">{formatCurrency(item.annualCost, study.currency)}</td>
                  <td className="px-4 py-4 text-right">
                    <RegActionMenu
                      actions={[
                        {
                          label: 'Review action',
                          icon: Eye,
                          onSelect: () => setSelectedAction(item),
                        },
                        {
                          label: 'Open scenario',
                          icon: ArrowUpRight,
                          to: `/quantitative-risk-scenarios/${item.scenarioId}`,
                        },
                      ]}
                      label={`Open actions for ${item.title}`}
                    />
                  </td>
                </tr>
              ))}
              {actionPlan.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={6}>
                    No quantitative treatment actions have been generated for this study.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </RegTableShell>

      <RegRightDrawer
        description="Review the action generated from scenario treatment data before opening the scenario workspace."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setSelectedAction(null)} type="button">
              Close
            </button>
            {selectedAction ? (
              <Link className="button-primary" to={`/quantitative-risk-scenarios/${selectedAction.scenarioId}`}>
                Open scenario
              </Link>
            ) : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
        open={Boolean(selectedAction)}
        title={selectedAction?.title ?? 'Review action'}
      >
        {selectedAction ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="label">Deterministic source</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                This action is generated from the scenario treatment strategy and cost fields in the quantitative
                study. Scenario economics remain the source of truth.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Scenario</div>
                <div className="mt-3 text-sm font-semibold text-[#241232]">{selectedAction.scenarioName}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Owner</div>
                <div className="mt-3 text-sm font-semibold text-[#241232]">
                  {selectedAction.ownerName ?? 'Unassigned'}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Status</div>
                <div className="mt-3">
                  <RegStatusPill tone={statusTone(selectedAction.status)} className="capitalize">
                    {selectedAction.status}
                  </RegStatusPill>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Annual cost</div>
                <div className="mt-3 text-sm font-semibold text-[#241232]">
                  {formatCurrency(selectedAction.annualCost, study.currency)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>
    </div>
  );
}
