import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Boxes,
  Users,
  Shield,
  BookOpen,
  GitBranch,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Lock,
  Activity,
  FileText,
  MessageSquare,
  Bot,
  Upload,
  ExternalLink,
  Link2,
  Network,
  BarChart3,
  Search,
  Eye,
  PlayCircle,
  Database,
  Cpu,
  SlidersHorizontal,
  Workflow,
  ShieldAlert,
  ShieldCheck,
  FormInput,
  FileOutput,
  Route,
  Layers3,
  Tags,
  KeyRound,
  LockKeyhole,
  Newspaper,
  Mail,
  BriefcaseBusiness,
  Wrench,
  ServerCog,
  Sparkles,
  Wand2,
  Palette,
  Globe2,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';

interface NavItem {
  to: string;
  label: string;
  section: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { to: '/', label: 'Dashboard', section: 'Overview', icon: LayoutDashboard },
  { to: '/dashboards', label: 'Dashboards', section: 'Overview', icon: LayoutDashboard },
  { to: '/quick-start', label: 'Quick Start', section: 'Overview', icon: PlayCircle },
  { to: '/workspace/me', label: 'My Access', section: 'Workspace', icon: User },
  { to: '/workspace/domains', label: 'Domains', section: 'Workspace', icon: Boxes },
  { to: '/workspace/team', label: 'Team', section: 'Workspace', icon: Users },
  { to: '/actors', label: 'Actors', section: 'Workspace', icon: Users },
  { to: '/workspace/access', label: 'Access Control', section: 'Workspace', icon: Shield },
  { to: '/setup/tags', label: 'Tags', section: 'Setup', icon: Tags },
  { to: '/setup/general', label: 'General', section: 'Setup', icon: Globe2 },
  { to: '/setup/classification', label: 'Classification', section: 'Setup', icon: ShieldCheck },
  { to: '/setup/risk-model', label: 'Risk Model', section: 'Setup', icon: AlertTriangle },
  { to: '/setup/service-accounts', label: 'Service Accounts', section: 'Setup', icon: KeyRound },
  { to: '/setup/branding', label: 'Branding', section: 'Setup', icon: Palette },
  { to: '/setup/email', label: 'Email', section: 'Setup', icon: Mail },
  { to: '/setup/modules-features', label: 'Modules and Features', section: 'Setup', icon: Layers3 },
  { to: '/setup/sso', label: 'Single Sign-On', section: 'Setup', icon: Shield },
  { to: '/setup/mfa', label: 'Multi-Factor Auth', section: 'Setup', icon: LockKeyhole },
  { to: '/setup/logs-utilization', label: 'Logs and Utilization', section: 'Setup', icon: Activity },
  { to: '/setup/security', label: 'Security', section: 'Setup', icon: ShieldCheck },
  { to: '/libraries', label: 'Libraries', section: 'Governance', icon: BookOpen },
  { to: '/frameworks', label: 'Frameworks', section: 'Governance', icon: GitBranch },
  { to: '/policies', label: 'Policies', section: 'Governance', icon: FileText },
  { to: '/assessments', label: 'Assessments', section: 'Governance', icon: ClipboardCheck },
  { to: '/ai-policy-builder', label: 'AI Policy Builder', section: 'AI', icon: Sparkles },
  { to: '/features/regml', label: 'RegML (AI)', section: 'AI', icon: Wand2 },
  { to: '/response-automation', label: 'Response Automation', section: 'AI', icon: Bot },
  { to: '/evidence-mapping', label: 'Evidence Mapping', section: 'AI', icon: Link2 },
  { to: '/compliance-exports', label: 'Compliance Exports', section: 'AI', icon: FileOutput },
  { to: '/builders/export-builder', label: 'Export Builder', section: 'Builders', icon: FileOutput },
  { to: '/builders/form-builder', label: 'Form Builder', section: 'Builders', icon: FormInput },
  { to: '/builders/report-builder', label: 'Report Builder', section: 'Builders', icon: BarChart3 },
  { to: '/builders/dashboard-builder', label: 'Dashboard Builder', section: 'Builders', icon: LayoutDashboard },
  { to: '/builders/rules-builder', label: 'Rules Builder', section: 'Builders', icon: SlidersHorizontal },
  { to: '/builders/wayfinder-builder', label: 'Wayfinder Builder', section: 'Builders', icon: Route },
  { to: '/builders/questionnaire-builder', label: 'Questionnaire Builder', section: 'Builders', icon: Workflow },
  { to: '/builders/questionnaire-builder/overview', label: 'Questionnaire Overview', section: 'Builders', icon: ClipboardCheck },
  {
    to: '/builders/questionnaire-builder/rules-engine',
    label: 'Visual Rules Engine',
    section: 'Builders',
    icon: SlidersHorizontal,
  },
  { to: '/risk-scenarios', label: 'Risk Scenarios', section: 'Risk', icon: AlertTriangle },
  { to: '/vulnerabilities', label: 'Vulnerabilities', section: 'Risk', icon: AlertTriangle },
  { to: '/security-exceptions', label: 'Security Exceptions', section: 'Risk', icon: ShieldCheck },
  { to: '/third-party', label: 'Third Party', section: 'Risk', icon: Building2 },
  { to: '/privacy', label: 'Privacy', section: 'Risk', icon: Lock },
  { to: '/resilience', label: 'Resilience', section: 'Risk', icon: Activity },
  { to: '/assets', label: 'Assets', section: 'Risk', icon: Boxes },
  { to: '/asset-assessments', label: 'Asset Assessments', section: 'Risk', icon: ClipboardCheck },
  { to: '/incidents', label: 'Incidents', section: 'Risk', icon: ShieldAlert },
  { to: '/reports', label: 'Reports', section: 'Operations', icon: FileText },
  { to: '/analytics', label: 'Analytics', section: 'Operations', icon: BarChart3 },
  { to: '/search', label: 'Search', section: 'Operations', icon: Search },
  { to: '/backup-restore', label: 'Backup / Restore', section: 'Operations', icon: Upload },
  { to: '/calendar', label: 'Calendar', section: 'Operations', icon: Activity },
  { to: '/chat', label: 'Chat', section: 'Operations', icon: MessageSquare },
  { to: '/imports', label: 'Imports', section: 'Operations', icon: Upload },
  { to: '/automation-manager', label: 'Automation Manager', section: 'Operations', icon: Link2 },
  { to: '/workflow', label: 'Workflow', section: 'Operations', icon: Workflow },
  { to: '/utilities', label: 'Utilities', section: 'Operations', icon: Wrench },
  { to: '/subsystems', label: 'Subsystems', section: 'Operations', icon: Layers3 },
  { to: '/rmf', label: 'RMF', section: 'Operations', icon: ShieldCheck },
  { to: '/app-management', label: 'App Management', section: 'Operations', icon: ServerCog },
  { to: '/workbench', label: 'Workbench', section: 'Operations', icon: BriefcaseBusiness },
  { to: '/news-feed', label: 'News Feed', section: 'Operations', icon: Newspaper },
  { to: '/validation-flows', label: 'Validation Flows', section: 'Operations', icon: ClipboardCheck },
  { to: '/settings', label: 'Settings', section: 'Operations', icon: SlidersHorizontal },
  { to: '/x-rays', label: 'X-Rays', section: 'Operations', icon: Activity },
  { to: '/portal', label: 'Auditee Portal', section: 'Operations', icon: ExternalLink },
  { to: '/advanced-risk/ebios', label: 'EBIOS RM', section: 'Advanced Risk', icon: Network },
  { to: '/advanced-risk/quantitative', label: 'Quantitative', section: 'Advanced Risk', icon: BarChart3 },
  { to: '/evidence-management', label: 'Evidence Management', section: 'Evidence', icon: Database },
  { to: '/conmon/profiles', label: 'ConMon Profiles', section: 'ConMon', icon: Eye },
  { to: '/conmon/executions', label: 'ConMon Runs', section: 'ConMon', icon: PlayCircle },
  { to: '/evidence/sources', label: 'Evidence Sources', section: 'Evidence', icon: Database },
  { to: '/evidence/jobs', label: 'Evidence Jobs', section: 'Evidence', icon: Cpu },
];

const sections = ['Overview', 'Workspace', 'Setup', 'Governance', 'AI', 'Builders', 'Risk', 'Operations', 'Advanced Risk', 'ConMon', 'Evidence'];

const SECTION_SEPARATORS_BEFORE = new Set(['Workspace', 'Setup', 'Governance', 'AI', 'Builders', 'Risk', 'Operations', 'Advanced Risk', 'ConMon', 'Evidence']);

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'glass-panel sticky top-0 flex h-screen flex-col border-r border-white/10 transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-72',
        )}
      >
        {/* Logo header */}
        <div
          className={cn(
            'flex h-20 items-center border-b border-white/10 px-4',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-cyan-600/15 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]">
              <ShieldCheck className="h-4.5 w-4.5 text-cyan-400" strokeWidth={1.8} />
            </div>
            {!collapsed && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/60">CISO Assistant</div>
                <div className="text-sm font-semibold tracking-tight text-white">Workspace</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.07] hover:text-white"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-3 flex h-7 w-7 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.07] hover:text-white"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin">
          {sections.map((section, sectionIndex) => {
            const items = navigation.filter((item) => item.section === section);
            if (items.length === 0) return null;

            return (
              <div key={section}>
                {SECTION_SEPARATORS_BEFORE.has(section) && sectionIndex > 0 && (
                  <div className={cn('my-2', collapsed ? 'px-3' : 'px-4')}>
                    <Separator />
                  </div>
                )}

                <div className={cn('mb-1', !collapsed && 'px-4')}>
                  {!collapsed && (
                    <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {section}
                    </div>
                  )}
                  <div className={cn('space-y-0.5', collapsed && 'flex flex-col items-center px-2')}>
                    {items.map((item) => {
                      const Icon = item.icon;

                      if (collapsed) {
                        return (
                          <Tooltip key={item.to}>
                            <TooltipTrigger asChild>
                              <NavLink
                                to={item.to}
                                className={({ isActive }) =>
                                  cn(
                                    'flex h-9 w-9 items-center justify-center rounded-xl transition',
                                    isActive
                                      ? 'bg-cyan-400/15 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]'
                                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
                                  )
                                }
                              >
                                <Icon className="h-4 w-4" strokeWidth={1.7} />
                              </NavLink>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        );
                      }

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition',
                              isActive
                                ? 'bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]'
                                : 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                className={cn('h-4 w-4 shrink-0', isActive ? 'text-cyan-400' : 'text-slate-500')}
                                strokeWidth={1.7}
                              />
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-white/10 px-5 py-4">
            <p className="text-[11px] leading-5 text-slate-500">
              One workspace for governance, risk, portal operations, advanced studies, monitoring, and evidence.
            </p>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
