import { useEffect, useState } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Zap,
  Users,
  Globe,
  Shield,
  Activity,
  BarChart3,
  Eye,
  MessageSquare,
  Download,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { ApiClient } from '../../shared/api/client';
import { setEdgeIdentity, useEdgeIdentity } from '../../shared/session/identity';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { cn } from '../../lib/utils';

type HealthPayload = {
  ok: boolean;
  service: string;
  appEnv: string;
  bindings: {
    assets: boolean;
    d1: boolean;
    r2: boolean;
    queues: boolean;
    durableObjects: boolean;
  };
};

type OverviewPayload = {
  tenantId: string;
  counts: {
    users: number;
    folders: number;
    domains: number;
    userGroups: number;
    roleAssignments: number;
    perimeters: number;
    riskAssessments: number;
    complianceAssessments: number;
    frameworks: number;
    entities: number;
    contracts: number;
    processings: number;
    rightRequests: number;
    dataBreaches: number;
    businessImpactAnalyses: number;
    riskRegisters: number;
    riskScenarios: number;
    conMonProfiles: number;
    conMonExecutions: number;
    evidenceSources: number;
    evidenceJobs: number;
    evidenceArtifacts: number;
    reportExports: number;
    chatSessions: number;
    importJobs: number;
    portalAssignments: number;
    ebiosStudies: number;
    quantitativeStudies: number;
  };
};

type WorkflowSnapshot = {
  tenantId: string;
  activeLeases: Array<{
    leaseKey: string;
    acquiredAt: string;
    expiresAt: string;
  }>;
};

const client = new ApiClient();

interface MetricCardProps {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ReactNode;
  trend?: 'up' | 'neutral';
  accent?: boolean;
}

function MetricCard({ label, value, loading, icon, trend, accent }: MetricCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-[0_8px_40px_rgba(2,8,23,0.6)]',
        accent && 'border-cyan-400/20 bg-cyan-400/[0.03]',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl',
              accent
                ? 'bg-cyan-400/15 text-cyan-400'
                : 'bg-white/[0.05] text-slate-400',
            )}
          >
            {icon}
          </div>
          {trend === 'up' && (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400 opacity-60" />
          )}
        </div>
        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-8 w-16 rounded-xl" />
          ) : (
            <div className={cn('text-3xl font-semibold', accent ? 'text-cyan-100' : 'text-white')}>
              {value ?? 0}
            </div>
          )}
          <div className="mt-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const migrationPhases = [
  { title: 'Workspace Administration', description: 'Define domains, team structure, and role assignments so every operating surface has a clear perimeter.' },
  { title: 'Governance', description: 'Keep core controls, frameworks, and operating baselines organized in one shared workspace.' },
  { title: 'Risk', description: 'Track scenarios, monitor exposure, and keep attention on the items that need action.' },
  { title: 'Third Party', description: 'Map providers, solutions, contracts, and assessment coverage without splitting vendor context across tools.' },
  { title: 'Privacy', description: 'Keep processings, data subject requests, and breach handling tied to the same operating domains.' },
  { title: 'Resilience', description: 'Document recovery expectations, dependency thresholds, and continuity readiness for critical services.' },
  { title: 'Reports and Exports', description: 'Generate operational and regulatory packages directly from the migrated workspace data set.' },
  { title: 'Chat and Imports', description: 'Use workspace guidance chat and deterministic import pipelines without dropping back into legacy services.' },
  { title: 'Portal', description: 'Run auditee assignments and vendor responses inside the same Cloudflare-backed workspace model.' },
  { title: 'Advanced Risk', description: 'Support EBIOS RM and quantitative studies alongside the core qualitative risk and compliance workflows.' },
  { title: 'Continuous Monitoring', description: 'Run operational checks, review results, and keep an auditable trail of monitoring activity.' },
  { title: 'Evidence', description: 'Collect, store, and review evidence from connected sources without leaving the workspace.' },
];

type MetricGroup = {
  section: string;
  items: MetricCardProps[];
};

export function DashboardPage() {
  const { identity } = useEdgeIdentity();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<WorkflowSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const [healthResponse, overviewResponse, workflowResponse] = await Promise.all([
        client.get<{ data: HealthPayload }>('/core/health'),
        client.get<{ data: OverviewPayload }>('/core/overview'),
        client.get<{ data: { tenantId: string; workflowState: WorkflowSnapshot } }>(
          `/core/tenants/${identity.tenantId}/workflows`,
        ),
      ]);

      setHealth(healthResponse.data);
      setOverview(overviewResponse.data);
      setWorkflowSnapshot(workflowResponse.data.workflowState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [identity.tenantId, identity.userId]);

  async function bootstrapDemo() {
    try {
      setBootstrapping(true);
      setNotice(null);
      const response = await client.post<{
        data: { tenantId: string; userId: string; message: string };
      }>('/core/bootstrap-demo');

      setEdgeIdentity({
        tenantId: response.data.tenantId,
        userId: response.data.userId,
      });
      setNotice(response.data.message);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBootstrapping(false);
    }
  }

  const metricGroups: MetricGroup[] = [
    {
      section: 'Governance',
      items: [
        { label: 'Domains', value: overview?.counts.domains, loading, icon: <Globe className="h-4 w-4" />, trend: 'up', accent: true },
        { label: 'Team Members', value: overview?.counts.users, loading, icon: <Users className="h-4 w-4" />, trend: 'up' },
        { label: 'Access Assignments', value: overview?.counts.roleAssignments, loading, icon: <Shield className="h-4 w-4" /> },
        { label: 'Frameworks', value: overview?.counts.frameworks, loading, icon: <BarChart3 className="h-4 w-4" />, accent: true },
      ],
    },
    {
      section: 'Risk',
      items: [
        { label: 'Risk Assessments', value: overview?.counts.riskAssessments, loading, icon: <Activity className="h-4 w-4" />, accent: true },
        { label: 'Compliance Reviews', value: overview?.counts.complianceAssessments, loading, icon: <CheckCircle2 className="h-4 w-4" />, trend: 'up' },
        { label: 'Risk Scenarios', value: overview?.counts.riskScenarios, loading, icon: <Shield className="h-4 w-4" /> },
        { label: 'Third Parties', value: overview?.counts.entities, loading, icon: <ExternalLink className="h-4 w-4" /> },
      ],
    },
    {
      section: 'Operations',
      items: [
        { label: 'Report Exports', value: overview?.counts.reportExports, loading, icon: <Download className="h-4 w-4" /> },
        { label: 'Chat Sessions', value: overview?.counts.chatSessions, loading, icon: <MessageSquare className="h-4 w-4" />, trend: 'up' },
        { label: 'Import Jobs', value: overview?.counts.importJobs, loading, icon: <Eye className="h-4 w-4" /> },
        { label: 'Portal Assignments', value: overview?.counts.portalAssignments, loading, icon: <Users className="h-4 w-4" /> },
      ],
    },
    {
      section: 'Advanced',
      items: [
        { label: 'Privacy Processings', value: overview?.counts.processings, loading, icon: <Shield className="h-4 w-4" /> },
        { label: 'BIA Studies', value: overview?.counts.businessImpactAnalyses, loading, icon: <BarChart3 className="h-4 w-4" /> },
        { label: 'EBIOS Studies', value: overview?.counts.ebiosStudies, loading, icon: <Activity className="h-4 w-4" />, accent: true },
        { label: 'Quant Studies', value: overview?.counts.quantitativeStudies, loading, icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
  ];

  const bindingChecks = health
    ? [
        { label: 'Application shell', enabled: health.bindings.assets },
        { label: 'Workspace data', enabled: health.bindings.d1 },
        { label: 'Evidence storage', enabled: health.bindings.r2 },
        { label: 'Automation jobs', enabled: health.bindings.queues },
        { label: 'Background coordination', enabled: health.bindings.durableObjects },
      ]
    : [];

  const healthyCount = bindingChecks.filter((c) => c.enabled).length;
  const healthPercent = bindingChecks.length > 0 ? (healthyCount / bindingChecks.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">Overview</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">CISO Assistant</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Centralize governance, risk, continuous monitoring, and evidence operations in one
            workspace. This dashboard gives you a quick read on readiness, activity, and the core
            areas that teams need day to day.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={bootstrapping}
              onClick={() => void bootstrapDemo()}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {bootstrapping ? 'Loading...' : 'Load Demo Workspace'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void loadDashboard()}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
        <Card className="border-white/8">
          <CardHeader className="pb-3">
            <div className="eyebrow">Active Identity</div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tenant</div>
              <div className="font-mono text-sm text-cyan-200 truncate">{identity.tenantId}</div>
            </div>
            <Separator />
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">User</div>
              <div className="font-mono text-sm text-cyan-200 truncate">{identity.userId}</div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Runtime</div>
              {loading ? (
                <Skeleton className="h-5 w-20 rounded-lg" />
              ) : (
                <Badge variant={health?.appEnv === 'production' ? 'default' : 'secondary'}>
                  {health?.appEnv ?? 'unknown'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      {/* Metric groups */}
      {metricGroups.map((group) => (
        <section key={group.section}>
          <div className="mb-4 flex items-center gap-3">
            <div className="eyebrow">{group.section}</div>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {group.items.map((item) => (
              <MetricCard key={item.label} {...item} />
            ))}
          </div>
        </section>
      ))}

      {/* Bottom grid */}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Operational areas */}
        <Card>
          <CardHeader>
            <div className="eyebrow">Operational Areas</div>
            <CardTitle className="text-base mt-1">Platform Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {migrationPhases.map((phase, i) => (
              <div key={phase.title}>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-white/10 hover:bg-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-white">{phase.title}</div>
                    <Badge variant="secondary" className="text-[9px] py-0.5">Active</Badge>
                  </div>
                  <div className="mt-1.5 text-xs leading-5 text-slate-400">{phase.description}</div>
                </div>
                {i < migrationPhases.length - 1 && <div className="h-px" />}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Workspace status */}
          <Card>
            <CardHeader>
              <div className="eyebrow">Workspace Status</div>
              <div className="mt-3 space-y-1.5">
                {loading ? (
                  <Skeleton className="h-2 w-full rounded-full" />
                ) : (
                  <>
                    <Progress value={healthPercent} />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{healthyCount} of {bindingChecks.length} bindings ready</span>
                      <span>{Math.round(healthPercent)}%</span>
                    </div>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-2xl" />
                  ))
                : bindingChecks.map(({ label, enabled }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {enabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        <span className="text-sm text-slate-300">{label}</span>
                      </div>
                      <Badge variant={enabled ? 'success' : 'destructive'}>
                        {enabled ? 'ready' : 'missing'}
                      </Badge>
                    </div>
                  ))}
              {!health && !loading && (
                <p className="text-sm text-slate-400">Binding status unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* Active background work */}
          <Card>
            <CardHeader>
              <div className="eyebrow">Active Background Work</div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                ))
              ) : workflowSnapshot?.activeLeases.length ? (
                workflowSnapshot.activeLeases.map((lease) => (
                  <div
                    key={lease.leaseKey}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-cyan-400/60 shrink-0" />
                      <div className="font-mono text-xs text-cyan-200 truncate">{lease.leaseKey}</div>
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500">
                      Acquired {lease.acquiredAt} &middot; expires {lease.expiresAt}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] mb-3">
                    <Activity className="h-5 w-5 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400">No active background activity</p>
                  <p className="text-xs text-slate-600 mt-1">All systems idle</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
