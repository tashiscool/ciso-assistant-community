import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  RegActionMenu,
  RegFilterBar,
  RegPageHeader,
  RegRightDrawer,
  RegStatusPill,
  RegTableShell,
  RegTabs,
} from '../../components/regovise/PagePrimitives';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import { getFindings } from '../grc/api';
import type { FindingSummary } from '../grc/types';
import { useOpsParityOverview, type OpsParityCard } from '../ops/useOpsParityOverview';

type RiskScenario = {
  id: string;
  registerName: string;
  title: string;
  description: string | null;
  likelihood: number | null;
  impact: number | null;
  inherentScore: number | null;
  residualScore: number | null;
  status: string;
  updatedAt: string;
};

type RiskActionSource = 'Task' | 'Finding' | 'Incident' | 'Exception' | 'Scenario' | 'Validation';

type RiskActionRow = {
  id: string;
  source: RiskActionSource;
  title: string;
  owner: string;
  status: string;
  statusTone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  priority: string;
  evidence: string;
  route: string;
  updatedAt: string;
  detail: string;
};

const client = new ApiClient();

function normalizeStatusTone(status: string): RiskActionRow['statusTone'] {
  const normalized = status.toLowerCase();
  if (normalized.includes('ok') || normalized.includes('closed') || normalized.includes('complete') || normalized.includes('accepted')) {
    return 'success';
  }
  if (normalized.includes('critical') || normalized.includes('fail') || normalized.includes('overdue') || normalized.includes('blocked')) {
    return 'danger';
  }
  if (normalized.includes('review') || normalized.includes('due') || normalized.includes('monitor') || normalized.includes('pending')) {
    return 'warning';
  }
  if (normalized.includes('open') || normalized.includes('active')) {
    return 'info';
  }
  return 'neutral';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not tracked';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function fromOpsCard(card: OpsParityCard, source: Extract<RiskActionSource, 'Task' | 'Incident' | 'Exception' | 'Validation'>): RiskActionRow {
  return {
    id: `${source.toLowerCase()}-${card.id}`,
    source,
    title: card.title,
    owner: 'Workspace team',
    status: card.status,
    statusTone: normalizeStatusTone(card.status),
    priority: source === 'Exception' || source === 'Incident' ? 'High attention' : 'Follow-up',
    evidence: card.subtitle,
    route: card.route || '/tasks',
    updatedAt: card.detail,
    detail: card.detail,
  };
}

function fromFinding(finding: FindingSummary): RiskActionRow {
  return {
    id: `finding-${finding.id}`,
    source: 'Finding',
    title: `${finding.resourceType}: ${finding.resourceId}`,
    owner: finding.source,
    status: finding.statusSummary,
    statusTone: normalizeStatusTone(`${finding.statusSummary} ${finding.severitySummary}`),
    priority: finding.severitySummary,
    evidence: `${finding.evaluationCount} evaluations, ${finding.evidenceRefCount} evidence refs`,
    route: `/findings?finding=${encodeURIComponent(finding.id)}`,
    updatedAt: formatDate(finding.collectedAt),
    detail: `${finding.scfMatchCount} SCF matches from ${finding.sourceVersion}`,
  };
}

function fromScenario(scenario: RiskScenario): RiskActionRow {
  return {
    id: `scenario-${scenario.id}`,
    source: 'Scenario',
    title: scenario.title,
    owner: scenario.registerName,
    status: scenario.status,
    statusTone: normalizeStatusTone(scenario.status),
    priority: scenario.inherentScore == null ? 'Unscored' : `Inherent ${scenario.inherentScore}`,
    evidence: `Likelihood ${scenario.likelihood ?? 'n/a'} / Impact ${scenario.impact ?? 'n/a'}`,
    route: '/risk-scenarios',
    updatedAt: formatDate(scenario.updatedAt),
    detail: scenario.description ?? 'No description captured.',
  };
}

function sourceTone(source: RiskActionSource): RiskActionRow['statusTone'] {
  if (source === 'Incident' || source === 'Exception') {
    return 'danger';
  }
  if (source === 'Finding') {
    return 'warning';
  }
  if (source === 'Scenario') {
    return 'info';
  }
  if (source === 'Validation') {
    return 'purple';
  }
  return 'neutral';
}

export function RiskActionTrackerPage() {
  const { identity } = useEdgeIdentity();
  const { overview, loading: opsLoading, error: opsError, refresh } = useOpsParityOverview();
  const [findings, setFindings] = useState<FindingSummary[]>([]);
  const [scenarios, setScenarios] = useState<RiskScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | RiskActionSource>('all');
  const [selectedAction, setSelectedAction] = useState<RiskActionRow | null>(null);

  async function loadRiskActions() {
    setLoading(true);
    setWarning(null);

    const [scenarioResult, findingsResult] = await Promise.allSettled([
      client.get<{ data: RiskScenario[] }>('/core/risk-scenarios'),
      getFindings(),
    ]);

    if (scenarioResult.status === 'fulfilled') {
      setScenarios(scenarioResult.value.data);
    } else {
      setScenarios([]);
      setWarning(scenarioResult.reason instanceof Error ? scenarioResult.reason.message : 'Unable to load risk scenarios.');
    }

    if (findingsResult.status === 'fulfilled') {
      setFindings(findingsResult.value);
    } else if (scenarioResult.status === 'fulfilled') {
      setFindings([]);
      setWarning('Risk scenarios loaded. Findings are hidden for this access profile or temporarily unavailable.');
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadRiskActions();
  }, [identity.tenantId, identity.userId]);

  const rows = useMemo<RiskActionRow[]>(() => {
    const taskRows = overview?.tasks.map((card) => fromOpsCard(card, 'Task')) ?? [];
    const incidentRows = overview?.incidents.map((card) => fromOpsCard(card, 'Incident')) ?? [];
    const exceptionRows = overview?.exceptions.map((card) => fromOpsCard(card, 'Exception')) ?? [];
    const validationRows = overview?.validationFlows.map((card) => fromOpsCard(card, 'Validation')) ?? [];
    const findingRows = findings.slice(0, 12).map(fromFinding);
    const scenarioRows = scenarios.map(fromScenario);

    return [...incidentRows, ...exceptionRows, ...findingRows, ...taskRows, ...validationRows, ...scenarioRows];
  }, [findings, overview, scenarios]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSource = sourceFilter === 'all' || row.source === sourceFilter;
      const matchesQuery =
        !normalizedQuery ||
        [row.title, row.owner, row.status, row.priority, row.evidence, row.detail, row.source]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSource && matchesQuery;
    });
  }, [query, rows, sourceFilter]);

  const highAttentionCount = rows.filter((row) => row.statusTone === 'danger' || row.priority.toLowerCase().includes('high')).length;
  const openCount = rows.filter((row) => row.statusTone !== 'success').length;
  const sourceCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.source] = (counts[row.source] ?? 0) + 1;
    return counts;
  }, {});

  const pageLoading = loading || opsLoading;

  return (
    <div className="space-y-6">
      <RegPageHeader
        actions={
          <>
            <Button
              className="gap-2"
              onClick={() => {
                void refresh();
                void loadRiskActions();
              }}
              type="button"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild className="gap-2">
              <Link to="/tasks">
                <ClipboardCheck className="h-4 w-4" />
                Open Work Queue
              </Link>
            </Button>
          </>
        }
        description="Track remediation work across risk scenarios, findings, exceptions, incidents, validation flows, and task operations without flattening Regovise's richer GRC object model."
        eyebrow="Risk"
        meta={
          <>
            <RegStatusPill tone="info">{openCount} open actions</RegStatusPill>
            <RegStatusPill tone={highAttentionCount > 0 ? 'danger' : 'success'}>{highAttentionCount} high attention</RegStatusPill>
            <RegStatusPill tone="purple">{Object.keys(sourceCounts).length} source families</RegStatusPill>
          </>
        }
        title="Action Tracker"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="metric-card">
          <div className="text-sm font-semibold text-[#6f6578]">Open risk work</div>
          <div className="mt-3 text-3xl font-semibold text-[#241232]">{openCount}</div>
          <p className="mt-2 text-sm text-[#4f435c]">Non-closed tasks, findings, exceptions, incidents, and scenario follow-ups.</p>
        </div>
        <div className="metric-card">
          <div className="text-sm font-semibold text-[#6f6578]">High attention</div>
          <div className="mt-3 text-3xl font-semibold text-[#241232]">{highAttentionCount}</div>
          <p className="mt-2 text-sm text-[#4f435c]">Items with danger status or explicit high-attention priority.</p>
        </div>
        <div className="metric-card">
          <div className="text-sm font-semibold text-[#6f6578]">Evidence-linked findings</div>
          <div className="mt-3 text-3xl font-semibold text-[#241232]">{findings.length}</div>
          <p className="mt-2 text-sm text-[#4f435c]">GRC findings are included when the current access profile can read them.</p>
        </div>
      </section>

      {(warning || opsError) ? (
        <div className="notice-warning flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{warning ?? opsError}</span>
        </div>
      ) : null}

      <section className="panel p-0">
        <RegTabs
          tabs={[
            { id: 'all', label: 'All work', count: rows.length, active: sourceFilter === 'all' },
            { id: 'Finding', label: 'Findings', count: sourceCounts.Finding ?? 0, active: sourceFilter === 'Finding' },
            { id: 'Task', label: 'Tasks', count: sourceCounts.Task ?? 0, active: sourceFilter === 'Task' },
            { id: 'Incident', label: 'Incidents', count: sourceCounts.Incident ?? 0, active: sourceFilter === 'Incident' },
            { id: 'Exception', label: 'Exceptions', count: sourceCounts.Exception ?? 0, active: sourceFilter === 'Exception' },
            { id: 'Scenario', label: 'Scenarios', count: sourceCounts.Scenario ?? 0, active: sourceFilter === 'Scenario' },
          ]}
          onSelect={(id) => setSourceFilter(id === 'all' ? 'all' : (id as RiskActionSource))}
        />

        <RegFilterBar className="items-stretch">
          <label className="relative block min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#786b84]" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search risk actions"
              value={query}
            />
          </label>
          <Button onClick={() => setSourceFilter('all')} type="button" variant="outline">
            Clear filters
          </Button>
        </RegFilterBar>

        <div className="p-4">
          <RegTableShell>
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#faf7fc] text-xs uppercase tracking-wide text-[#6f6578]">
                  <tr>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Source</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Action</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Owner</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Status</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Priority</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Evidence</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3">Updated</th>
                    <th className="border-b border-[#ded8e4] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8f2]">
                  {pageLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-[#6f6578]" colSpan={8}>
                        Loading risk action tracker...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[#6f6578]" colSpan={8}>
                        No risk actions match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr className="align-top hover:bg-[#fbf9fd]" key={row.id}>
                        <td className="px-4 py-4">
                          <RegStatusPill tone={sourceTone(row.source)}>{row.source}</RegStatusPill>
                        </td>
                        <td className="max-w-[340px] px-4 py-4">
                          <div className="font-semibold text-[#241232]">{row.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#6f6578]">{row.detail}</div>
                        </td>
                        <td className="px-4 py-4 text-[#4f435c]">{row.owner}</td>
                        <td className="px-4 py-4">
                          <RegStatusPill tone={row.statusTone}>{row.status}</RegStatusPill>
                        </td>
                        <td className="px-4 py-4 text-[#4f435c]">{row.priority}</td>
                        <td className="max-w-[220px] px-4 py-4 text-[#4f435c]">{row.evidence}</td>
                        <td className="px-4 py-4 text-[#4f435c]">{row.updatedAt}</td>
                        <td className="px-4 py-4 text-right">
                          <RegActionMenu
                            actions={[
                              {
                                label: 'Inspect action',
                                onSelect: () => setSelectedAction(row),
                              },
                              {
                                label: 'Open source',
                                to: row.route,
                                icon: ExternalLink,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </RegTableShell>
        </div>
      </section>

      <RegRightDrawer
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setSelectedAction(null)} type="button" variant="outline">
              Close
            </Button>
            {selectedAction ? (
              <Button asChild>
                <Link to={selectedAction.route}>Open source</Link>
              </Button>
            ) : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAction(null);
          }
        }}
        open={Boolean(selectedAction)}
        title={selectedAction?.title ?? 'Risk action'}
      >
        {selectedAction ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fd] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RegStatusPill tone={sourceTone(selectedAction.source)}>{selectedAction.source}</RegStatusPill>
                <RegStatusPill tone={selectedAction.statusTone}>{selectedAction.status}</RegStatusPill>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#4f435c]">{selectedAction.detail}</p>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6f6578]">Owner</div>
                <div className="mt-1 text-[#241232]">{selectedAction.owner}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6f6578]">Priority</div>
                <div className="mt-1 text-[#241232]">{selectedAction.priority}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6f6578]">Evidence and scope</div>
                <div className="mt-1 text-[#241232]">{selectedAction.evidence}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6f6578]">Last update</div>
                <div className="mt-1 text-[#241232]">{selectedAction.updatedAt}</div>
              </div>
            </div>

            <div className="notice-info flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This tracker uses deterministic Regovise records first. AI or narrative context should explain the action, not replace the
                status shown here.
              </span>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>
    </div>
  );
}
