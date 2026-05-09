import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Cpu,
  Database,
  Eye,
  FileOutput,
  FileText,
  Gauge,
  GitBranch,
  Link2,
  Lock,
  MessageSquare,
  PlayCircle,
  Search,
  ServerCog,
  Shield,
  User,
  Users,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Upload,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';
import { canAccessShellRoute, type ShellAccessProfile } from './shellAccess';

interface NavItem {
  to: string;
  label: string;
  section: string;
  icon: LucideIcon;
  audience: 'standard' | 'admin' | 'internal';
}

const navigation: NavItem[] = [
  { to: '/', label: 'Home', section: 'Home', icon: Gauge, audience: 'standard' },
  { to: '/search', label: 'Search', section: 'Home', icon: Search, audience: 'standard' },
  { to: '/analytics', label: 'Analytics', section: 'Home', icon: BarChart3, audience: 'standard' },
  { to: '/program', label: 'Program Workspace', section: 'Program', icon: Compass, audience: 'standard' },
  { to: '/libraries', label: 'Libraries', section: 'Program', icon: BookOpen, audience: 'standard' },
  { to: '/frameworks', label: 'Frameworks', section: 'Program', icon: GitBranch, audience: 'standard' },
  { to: '/assessments', label: 'Assessments', section: 'Program', icon: ClipboardCheck, audience: 'standard' },
  { to: '/third-party', label: 'Third Party', section: 'Program', icon: Building2, audience: 'standard' },
  { to: '/privacy', label: 'Privacy', section: 'Program', icon: Lock, audience: 'standard' },
  { to: '/resilience', label: 'Resilience', section: 'Program', icon: Activity, audience: 'standard' },
  { to: '/portal', label: 'External Portal', section: 'Program', icon: Link2, audience: 'standard' },
  { to: '/advanced-risk/ebios', label: 'EBIOS RM', section: 'Program', icon: ShieldCheck, audience: 'standard' },
  {
    to: '/advanced-risk/quantitative',
    label: 'Quantitative Risk',
    section: 'Program',
    icon: BarChart3,
    audience: 'standard',
  },
  { to: '/evidence-management', label: 'Evidence Workspace', section: 'Evidence & Monitoring', icon: Database, audience: 'standard' },
  { to: '/evidence/jobs', label: 'Collection Jobs', section: 'Evidence & Monitoring', icon: Cpu, audience: 'standard' },
  { to: '/conmon/executions', label: 'Monitoring Runs', section: 'Evidence & Monitoring', icon: PlayCircle, audience: 'standard' },
  { to: '/reports', label: 'Reports', section: 'Evidence & Monitoring', icon: FileOutput, audience: 'standard' },
  { to: '/assurance', label: 'Assurance Overview', section: 'Assurance', icon: Gauge, audience: 'standard' },
  { to: '/assurance/evidence', label: 'Evidence Explorer', section: 'Assurance', icon: Search, audience: 'standard' },
  { to: '/assurance/tracker', label: 'Tracker Workbench', section: 'Assurance', icon: Upload, audience: 'standard' },
  { to: '/assurance/packages', label: '20x Packages', section: 'Assurance', icon: FileOutput, audience: 'standard' },
  { to: '/assurance/reviews', label: 'Review Queue', section: 'Assurance', icon: ClipboardCheck, audience: 'standard' },
  { to: '/assurance/agent-runs', label: 'Agent Runs', section: 'Assurance', icon: Bot, audience: 'standard' },
  { to: '/workspace/me', label: 'My Access', section: 'Home', icon: User, audience: 'standard' },
  { to: '/chat', label: 'Workspace AI', section: 'Automation', icon: MessageSquare, audience: 'standard' },
  { to: '/program/setup', label: 'Guided Setup', section: 'Administration', icon: PlayCircle, audience: 'admin' },
  { to: '/policies', label: 'Policies', section: 'Administration', icon: FileText, audience: 'admin' },
  { to: '/workspace/domains', label: 'Domains', section: 'Administration', icon: Boxes, audience: 'admin' },
  { to: '/workspace/team', label: 'Team', section: 'Administration', icon: Users, audience: 'admin' },
  { to: '/evidence/sources', label: 'Evidence Sources', section: 'Administration', icon: Database, audience: 'admin' },
  { to: '/conmon/profiles', label: 'Monitoring Profiles', section: 'Administration', icon: Eye, audience: 'admin' },
  { to: '/workspace/access', label: 'Permissions', section: 'Administration', icon: Shield, audience: 'admin' },
  { to: '/setup/general', label: 'Workspace Settings', section: 'Administration', icon: SlidersHorizontal, audience: 'admin' },
  { to: '/setup/security', label: 'Security', section: 'Administration', icon: ShieldCheck, audience: 'admin' },
  { to: '/automation-manager', label: 'Integrations', section: 'Administration', icon: ServerCog, audience: 'admin' },
  { to: '/response-automation', label: 'Response Automation', section: 'Administration', icon: Bot, audience: 'admin' },
  { to: '/evidence-mapping', label: 'Evidence Mapping', section: 'Administration', icon: Link2, audience: 'admin' },
  { to: '/features/regml', label: 'AI Authoring', section: 'Administration', icon: Sparkles, audience: 'admin' },
  { to: '/settings', label: 'Platform Settings', section: 'Internal', icon: ServerCog, audience: 'internal' },
  { to: '/workflow', label: 'Workflow Console', section: 'Internal', icon: Workflow, audience: 'internal' },
];

const sections = ['Home', 'Program', 'Evidence & Monitoring', 'Assurance', 'Automation', 'Administration', 'Internal'];

const SECTION_SEPARATORS_BEFORE = new Set(['Program', 'Evidence & Monitoring', 'Assurance', 'Automation', 'Administration', 'Internal']);

type SidebarProps = {
  access: ShellAccessProfile;
};

function canSeeNavItem(item: NavItem, access: ShellAccessProfile) {
  if (item.audience === 'admin' && !access.canViewAdminNavigation) {
    return false;
  }

  if (item.audience === 'internal' && !access.canViewInternalTools) {
    return false;
  }

  return canAccessShellRoute(item.to, access);
}

export function Sidebar({ access }: SidebarProps) {
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
                <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/60">Regovise</div>
                <div className="text-sm font-semibold tracking-tight text-white">Compliance Operations</div>
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
            const items = navigation.filter((item) => item.section === section && canSeeNavItem(item, access));
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
