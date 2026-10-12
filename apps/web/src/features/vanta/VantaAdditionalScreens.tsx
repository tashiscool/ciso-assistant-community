import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Box,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileText,
  Filter,
  HelpCircle,
  Home,
  Info,
  Link2,
  List,
  Mail,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type FlatNavKey =
  | 'Home'
  | 'Tests'
  | 'Reports'
  | 'Compliance'
  | 'Customer Trust'
  | 'Risk'
  | 'Vendors'
  | 'Assets'
  | 'Personnel'
  | 'Integrations'
  | 'Users'
  | 'Settings';

const routes = {
  home: '/vanta-clone/console/home',
  tests: '/vanta-clone/tests',
  testDetail: '/vanta-clone/tests/inventory-owners',
  controls: '/vanta-clone/controls',
  reports: '/vanta-clone/reports/compliance',
  policies: '/vanta-clone/compliance/policies',
  audits: '/vanta-clone/compliance/audits',
  frameworks: '/vanta-clone/frameworks',
  frameworkScope: '/vanta-clone/frameworks/esg-demo/scope',
  inventory: '/vanta-clone/inventory/autoscale-groups',
  people: '/vanta-clone/personnel/people/tasks',
  integrations: '/vanta-clone/integrations',
  riskLibrary: '/vanta-clone/risk/library',
  users: '/vanta-clone/users',
  settings: '/vanta-clone/settings/notifications',
};

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

function VantaWordmark() {
  return <div className="vanta-flat-logo">Vanta</div>;
}

function Glyph({ label, tone = 'purple' }: { label: string; tone?: 'purple' | 'blue' | 'green' | 'black' | 'orange' }) {
  return <span className={cx('vanta-glyph', tone)}>{label}</span>;
}

function MiniCheckbox({ checked = false }: { checked?: boolean }) {
  return <span className={cx('vanta-mini-check', checked && 'is-checked')}>{checked ? <Check size={13} strokeWidth={3} /> : null}</span>;
}

function Toggle({ on = true }: { on?: boolean }) {
  return (
    <button className={cx('vanta-toggle-flat', on && 'is-on')} type="button" aria-pressed={on}>
      <span />
    </button>
  );
}

function FlatPill({
  children,
  tone = 'gray',
  icon,
}: {
  children: ReactNode;
  tone?: 'purple' | 'green' | 'red' | 'yellow' | 'blue' | 'gray';
  icon?: ReactNode;
}) {
  return (
    <span className={cx('vanta-flat-pill', tone)}>
      {icon}
      {children}
    </span>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="vanta-flat-tag">{children}</span>;
}

function GhostButton({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button className={cx('vanta-flat-button', className)} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function PurpleButton({ children }: { children: ReactNode }) {
  return (
    <button className="vanta-flat-button primary" type="button">
      {children}
    </button>
  );
}

function WorkspaceButton({ label = 'Workspace cons...', animal = false }: { label?: string; animal?: boolean }) {
  return (
    <button className="vanta-flat-workspace" type="button">
      <Glyph label={animal ? 'T' : 'V'} tone={animal ? 'orange' : 'purple'} />
      <span>{label}</span>
      <ChevronDown size={17} />
    </button>
  );
}

function FlatTopbar({
  workspace = 'Workspace cons...',
  avatar = 'JH',
  staging = false,
  animal = false,
  menu = false,
  nestedMenu = false,
}: {
  workspace?: string;
  avatar?: string;
  staging?: boolean;
  animal?: boolean;
  menu?: boolean;
  nestedMenu?: boolean;
}) {
  return (
    <header className="vanta-flat-topbar">
      <div className="vanta-flat-brand-area">
        <VantaWordmark />
        <WorkspaceButton label={workspace} animal={animal} />
        {staging ? <span className="vanta-staging-badge">Staging</span> : null}
      </div>
      <div className="vanta-flat-top-actions">
        <HelpCircle size={21} />
        <Megaphone size={21} />
        <Settings size={22} />
        <span className="vanta-flat-avatar">{avatar}</span>
      </div>
      {menu ? <WorkspaceMenu nested={nestedMenu} /> : null}
    </header>
  );
}

function WorkspaceMenu({ nested = false }: { nested?: boolean }) {
  return (
    <>
      <div className="vanta-workspace-dropdown">
        <h4>Company</h4>
        <button type="button">
          <Glyph label="T" tone="orange" /> Tiger Labs App <ChevronDown size={18} />
        </button>
        <button type="button">
          <span className="vanta-mini-wordmark">Vanta</span> Vanta
        </button>
      </div>
      {nested ? (
        <div className="vanta-workspace-dropdown nested">
          <h4>Workspace</h4>
          {[
            ['A', 'Amalgamated Widgets', 'black'],
            ['T', 'Tiger Labs App', 'orange'],
            ['V', 'VelocirAPPtor', 'green'],
            ['G', 'Vendor Guard', 'black'],
            ['C', 'Workspace console', 'purple'],
          ].map(([letter, label, tone]) => (
            <button key={label} type="button">
              <Glyph label={letter} tone={tone as 'purple' | 'green' | 'black' | 'orange'} /> {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

const appNav: Array<{ label: FlatNavKey; icon: LucideIcon; route?: string; children?: string[]; section?: boolean }> = [
  { label: 'Home', icon: Home, route: routes.home },
  { label: 'Tests', icon: List, route: routes.tests },
  { label: 'Reports', icon: BarChart3, route: routes.reports },
  { label: 'Compliance', icon: ClipboardCheck, route: routes.audits, section: true, children: ['Frameworks', 'Controls', 'Policies', 'Documents', 'Audits', 'Settings'] },
  { label: 'Customer Trust', icon: ShieldCheck },
  { label: 'Risk', icon: Shield, route: routes.riskLibrary, children: ['Overview', 'Risk register', 'Risk library', 'Action tracker', 'Snapshots', 'Settings'] },
  { label: 'Vendors', icon: Briefcase },
  { label: 'Assets', icon: Database, route: routes.inventory },
  { label: 'Personnel', icon: Users, route: routes.people, children: ['People', 'Computers', 'Access', 'Settings'] },
  { label: 'Integrations', icon: Plug, route: routes.integrations, section: true },
];

const compactNavItems: Array<{ label: FlatNavKey; icon: LucideIcon; route: string }> = [
  { label: 'Home', icon: Home, route: routes.home },
  { label: 'Users', icon: Users, route: routes.users },
];

function FlatSidebar({
  active,
  child,
  compact = false,
}: {
  active: FlatNavKey;
  child?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  if (compact) {
    return (
      <aside className="vanta-flat-sidebar compact">
        {compactNavItems.map(({ label, icon: Icon, route }) => (
          <button
            key={label}
            type="button"
            aria-current={active === label ? 'page' : undefined}
            className={cx('vanta-flat-nav-item', active === label && 'is-active')}
            data-active={active === label ? 'true' : undefined}
            onClick={() => navigate(route)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="vanta-flat-sidebar">
      <div className="vanta-flat-search">
        <Search size={19} />
        <span>Help...</span>
        <kbd>Cmd+K</kbd>
      </div>
      <nav aria-label="Vanta flat navigation">
        {appNav.map((item) => {
          const Icon = item.icon;
          const open = item.label === active && item.children;
          return (
            <div key={item.label}>
              {item.section ? <div className="vanta-flat-divider" /> : null}
              <button
                aria-current={item.label === active ? 'page' : undefined}
                className={cx('vanta-flat-nav-item', item.label === active && 'is-active')}
                data-active={item.label === active ? 'true' : undefined}
                type="button"
                onClick={() => item.route && navigate(item.route)}
              >
                <Icon size={21} />
                <span>{item.label}</span>
                {item.children ? <ChevronDown size={16} /> : null}
              </button>
              {open ? (
                <div className="vanta-flat-subnav">
                  {item.children?.map((label) => (
                    <button
                      key={label}
                      type="button"
                      aria-current={label === child ? 'page' : undefined}
                      className={cx(label === child && 'is-active')}
                      data-active={label === child ? 'true' : undefined}
                      onClick={() => {
                        if (label === 'People') navigate(routes.people);
                        if (label === 'Frameworks') navigate(routes.frameworks);
                        if (label === 'Controls') navigate(routes.controls);
                        if (label === 'Policies') navigate(routes.policies);
                        if (label === 'Audits') navigate(routes.audits);
                        if (label === 'Risk library') navigate(routes.riskLibrary);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <button className="vanta-sidebar-collapse" type="button" aria-label="Collapse sidebar">
        &lt;|
      </button>
    </aside>
  );
}

function FlatShell({
  active,
  child,
  children,
  workspace = 'Workspace cons...',
  animal = false,
  staging = false,
  avatar = 'JH',
  compactSidebar = false,
  menu = false,
  nestedMenu = false,
}: {
  active: FlatNavKey;
  child?: string;
  children: ReactNode;
  workspace?: string;
  animal?: boolean;
  staging?: boolean;
  avatar?: string;
  compactSidebar?: boolean;
  menu?: boolean;
  nestedMenu?: boolean;
}) {
  return (
    <div className="vanta-app vanta-flat-app">
      <FlatTopbar workspace={workspace} animal={animal} staging={staging} avatar={avatar} menu={menu} nestedMenu={nestedMenu} />
      <div className={cx('vanta-flat-layout', compactSidebar && 'compact')}>
        <FlatSidebar active={active} child={child} compact={compactSidebar} />
        <main className="vanta-flat-main">{children}</main>
      </div>
    </div>
  );
}

function SimpleVantaShell({
  active,
  child,
  children,
  avatar = 'F',
  dim = false,
}: {
  active: FlatNavKey;
  child?: string;
  children: ReactNode;
  avatar?: string;
  dim?: boolean;
}) {
  return (
    <div className="vanta-app vanta-flat-app">
      <header className="vanta-simple-topbar">
        <VantaWordmark />
        <div className="vanta-flat-top-actions">
          <HelpCircle size={20} />
          <Megaphone size={20} />
          <Settings size={21} />
          <span className="vanta-flat-avatar">{avatar}</span>
        </div>
      </header>
      <div className={cx('vanta-simple-layout', dim && 'is-dimmed')}>
        <FlatSidebar active={active} child={child} />
        <main className="vanta-simple-main">{children}</main>
      </div>
    </div>
  );
}

function BarePage({
  children,
  className,
  current = false,
}: {
  children: ReactNode;
  className?: string;
  current?: boolean;
}) {
  return (
    <div
      aria-current={current ? 'page' : undefined}
      className={cx('vanta-app vanta-flat-app vanta-bare-page', className)}
      data-active={current ? 'true' : undefined}
    >
      {children}
    </div>
  );
}

export function StarterGuideScreen() {
  const completedPolicies = [
    'Verify your company name and logo',
    'Draft Code of Conduct Policy',
    'Draft Information Security Policy (AUP)',
  ];

  return (
    <BarePage className="vanta-starter-page">
      <header className="vanta-starter-hero">
        <h1>Starter Guide</h1>
        <p>Get up and running on Vanta fast with these key activities!</p>
      </header>

      <section className="vanta-starter-stepper" aria-label="Starter guide progress">
        <div className="vanta-starter-step is-current">
          <span>1</span>
          <strong>Onboarding</strong>
        </div>
        <div className="vanta-starter-step">
          <span>2</span>
          <strong>Program implementation</strong>
        </div>
        <div className="vanta-starter-step">
          <span>3</span>
          <strong>Risk remediation</strong>
        </div>
      </section>

      <main className="vanta-starter-card">
        <h2>Onboarding</h2>
        <p className="vanta-starter-card-copy">
          Get started quickly by completing these two essential tasks. They will set a solid foundation and help you make the most of Vanta from the start.
        </p>

        <section className="vanta-starter-task is-complete" aria-label="Connect your first integrations">
          <div className="vanta-starter-task-header">
            <span className="vanta-starter-icon">
              <Wrench size={40} strokeWidth={2.4} />
            </span>
            <div className="vanta-starter-task-copy">
              <h3>Connect your first integrations</h3>
              <p>Learn about your purchased frameworks, and connect key systems so that you can begin fixing tests.</p>
            </div>
            <div className="vanta-starter-task-status">
              <span>3 of 3 complete</span>
              <CheckCircle2 size={28} fill="#1fa34a" stroke="#ffffff" />
              <ChevronDown size={32} strokeWidth={2.6} />
            </div>
          </div>
        </section>

        <section className="vanta-starter-task is-open" aria-label="Set up policies">
          <div className="vanta-starter-task-header">
            <span className="vanta-starter-icon">
              <FileText size={40} strokeWidth={2.4} />
            </span>
            <div className="vanta-starter-task-copy">
              <h3>Set up policies</h3>
              <p>Draft your first policy to make progress toward your compliance goals.</p>
            </div>
            <div className="vanta-starter-task-status">
              <span>3 of 4 complete</span>
              <span className="vanta-starter-ring" />
              <ChevronDown className="vanta-starter-chevron-up" size={32} strokeWidth={2.6} />
            </div>
          </div>

          <div className="vanta-starter-subtasks">
            {completedPolicies.map((label) => (
              <div className="vanta-starter-subtask is-done" key={label}>
                <CheckCircle2 size={25} fill="#1fa34a" stroke="#ffffff" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="vanta-starter-next-task">
            <span className="vanta-starter-empty-check" />
            <strong>Draft Information Roles and Responsibilities Policy</strong>
            <button className="vanta-starter-policy-button" type="button">
              Go to policy
            </button>
          </div>
        </section>
      </main>

      <div className="vanta-starter-continue">
        <button type="button">Continue to Program implementation -&gt;</button>
      </div>
    </BarePage>
  );
}

export function PolicyBuilderScreen() {
  return (
    <div className="vanta-app vanta-flat-app">
      <FlatTopbar workspace="Vantaroo" staging avatar="H" />
      <div className="vanta-policy-builder-layout">
        <aside className="vanta-icon-rail">
          {[Search, Home, List, BarChart3, ClipboardCheck, ShieldCheck, CircleAlert, Briefcase, Database, Users, Plug].map((Icon, index) => (
            <button key={index} className={cx(index === 4 && 'is-active')} type="button">
              <Icon size={18} />
            </button>
          ))}
        </aside>
        <main className="vanta-policy-editor">
          <div className="vanta-breadcrumb">Policies / Code of Conduct /</div>
          <button className="vanta-floating-more" type="button">
            <MoreHorizontal size={18} />
          </button>
          <h1>Policy Builder: Code of Conduct</h1>
          <p className="vanta-lead">
            This policy outlines the culture and guidelines of the workplace environment, including expectations for personnel behavior and details for consequences of non-compliance.
          </p>
          <hr />
          <section className="vanta-policy-question">
            <h3>Who owns this policy?</h3>
            <p>The primary drafter of this policy (typically the CEO, COO, or someone in Human Resources or Operations).</p>
            <button className="vanta-flat-button" type="button">
              <span className="vanta-user-mini" /> Vlad Van Taroni <ChevronDown size={15} />
            </button>
          </section>
          <section className="vanta-policy-question">
            <h3>When should this policy go into effect?</h3>
            <p>Specifies the date when the policy becomes active.</p>
            <label className="vanta-radio-option selected">
              <span className="vanta-radio-dot" /> <strong>Auto-populate with policy approval date</strong>
              <small>Policy will be immediately effective from the date of approval</small>
            </label>
            <label className="vanta-radio-option">
              <span className="vanta-radio-dot" /> <strong>Specify a date</strong>
              <small>Specify a future effective date for the policy</small>
            </label>
          </section>
        </main>
        <aside className="vanta-policy-preview">
          <div className="vanta-policy-preview-card">
            <div className="vanta-policy-preview-head">
              <h2>Code of Conduct</h2>
              <span>
                <Pencil size={16} /> Customize
              </span>
              <FlatPill tone="green" icon={<CheckCircle2 size={14} />}>
                2/2 completed
              </FlatPill>
            </div>
            <p>
              <strong>Policy Owner:</strong> <mark>Vlad Van Taroni</mark>
            </p>
            <p>
              <strong>Effective Date:</strong> <mark>[Approval date]</mark>
            </p>
          </div>
          {[
            [
              'Purpose',
              "The primary goal of Vantaroo's Code of Conduct is to foster inclusive, collaborative and safe working conditions for all Vantaroo staff. As such, Vantaroo is committed to providing a friendly, safe and welcoming environment for all staff, regardless of gender, sexual orientation, ability, ethnicity, socioeconomic status, or religion (or lack thereof).",
            ],
            [
              'Scope',
              'The Code of Conduct applies to all Vantaroo staff. This includes full-time, part-time and contractor staff employed at every seniority level. The Code of Conduct is to be upheld during all professional functions and events.',
            ],
          ].map(([title, body]) => (
            <section key={title} className="vanta-policy-preview-section">
              <div>
                <h3>{title}</h3>
                <FlatPill tone="green" icon={<CheckCircle2 size={14} />}>
                  No input needed
                </FlatPill>
              </div>
              <p>{body}</p>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}

const policyRows = [
  ['Human Resource Security Policy 1', ['DORA', 'HITRUST', '+8'], 'OK', 'Pending approval', 'Oct 18, 2025', '0/23'],
  ["New Policy Name Test (Lindsey Test)", ["AT's Test Framework", 'ISO 27001:2022', '+3'], 'OK', 'Draft', 'Oct 9, 2025', '0/25'],
  ['Risk Management Policy', ['DORA', 'HITRUST', '+10'], 'OK', 'Approved', 'Sep 3, 2025', '0/20'],
  ['Data Management Policy', ['ADG TF', "AT's Test Framework", '+13'], 'Needs remediation', 'Draft', '-', '-'],
] as const;

export function PoliciesListScreen() {
  return (
    <FlatShell active="Compliance" child="Policies" workspace="Vantaroo" staging avatar="HT">
      <section className="vanta-flat-page policies">
        <div className="vanta-page-action-row">
          <h1>Policies</h1>
          <div>
            <GhostButton>
              <Plus size={18} /> Add custom policy
            </GhostButton>
            <GhostButton>
              <Pencil size={18} /> Edit SLAs
            </GhostButton>
            <GhostButton>
              More <ChevronDown size={17} />
            </GhostButton>
          </div>
        </div>
        <div className="vanta-filter-bar">
          <div className="vanta-input-like">
            <Search size={18} />
            <span>Search by name</span>
          </div>
          {['Framework', 'Overall status', 'Latest status', 'Type'].map((label) => (
            <button key={label} type="button">
              {label} <ChevronDown size={16} />
            </button>
          ))}
          <label className="vanta-filter-check">
            <MiniCheckbox /> Require my approval
          </label>
          <span className="vanta-sort-label">Sort by</span>
          <GhostButton>
            Recommended order <ChevronDown size={17} />
          </GhostButton>
          <GhostButton>
            <Download size={17} />
          </GhostButton>
          <GhostButton>
            <SlidersHorizontal size={18} />
          </GhostButton>
        </div>
        <div className="vanta-modern-table vanta-policy-table">
          <div className="vanta-modern-header">
            <span>Name</span>
            <span>Frameworks</span>
            <span>Overall policy status <Info size={14} /></span>
            <span>Latest policy version status <Info size={14} /></span>
            <span>Renew by</span>
            <span className="vanta-pink-column">Personnel acceptance <Info size={14} /></span>
            <span />
          </div>
          {policyRows.map(([name, frameworks, overall, latest, renew, acceptance]) => (
            <div className="vanta-modern-row" key={name}>
              <strong>{name}</strong>
              <span className="vanta-tag-cloud">
                {frameworks.map((framework) => (
                  <Tag key={framework}>{framework}</Tag>
                ))}
              </span>
              <span className={cx(overall === 'OK' ? 'ok-status' : 'bad-status')}>
                {overall === 'OK' ? <CheckCircle2 size={18} fill="#1aa64b" color="#fff" /> : <CircleAlert size={18} fill="#e0525d" color="#fff" />}
                {overall}
              </span>
              <FlatPill tone={latest === 'Approved' ? 'green' : latest === 'Pending approval' ? 'purple' : 'gray'} icon={latest === 'Draft' ? <Pencil size={14} /> : <Clock3 size={14} />}>
                {latest}
              </FlatPill>
              <span>
                {renew !== '-' ? <Calendar size={16} /> : null}
                {renew}
              </span>
              <span className="vanta-pink-column">
                {acceptance === '-' ? '-' : <span className="vanta-spinner" />}
                {acceptance !== '-' ? acceptance : null}
              </span>
              <MoreHorizontal size={18} />
            </div>
          ))}
        </div>
      </section>
    </FlatShell>
  );
}

const peopleTaskRows = [
  ['6 24 2024', 'Terminated', 'Dec 9, 2023', 'Dec 25, 2023', 'Offboarding complete', 'Default Group REMIX!', 'Full Time Sales Team'],
  ['Aaa Onboard SLA test Test', 'Current', 'Nov 1, 2024', '-', 'Tasks overdue', 'Engineers', 'Default Group REMIX!'],
  ['Aaron Weiss', 'Current', 'Feb 19, 2023', '-', 'Tasks overdue', 'Vanta Admins', 'Engineers +2'],
  ['Access Page test', 'Service account', 'Apr 3, 2023', '-', '', '-', ''],
  ['Added by Access User', 'Service account', 'May 1, 2022', 'Sep 25, 2023', '', '-', ''],
  ['Admin Admin', 'Current', 'Apr 2, 2022', '-', 'Tasks overdue', 'Vanta Admins', 'A default group'],
] as const;

export function PeopleTaskStatusScreen() {
  return (
    <FlatShell active="Personnel" child="People" workspace="Vantaroo" avatar="HT">
      <section className="vanta-flat-page people-tasks">
        <h1>People</h1>
        <p className="vanta-muted-copy">
          Monitor and manage tasks for your personnel. <a>Learn more</a>
        </p>
        <div className="vanta-tabs-flat">
          {['People', 'Groups', 'Background checks'].map((tab, index) => (
            <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>
              {tab}
            </button>
          ))}
        </div>
        <div className="vanta-filter-bar">
          <div className="vanta-input-like">
            <Search size={18} />
            <span>Search</span>
          </div>
          {['Status', 'Task status', 'Group', 'Audit window'].map((label) => (
            <button key={label} type="button">
              {label} <ChevronDown size={16} />
            </button>
          ))}
          <span className="vanta-pink-arrow task-status-arrow" />
          <div className="vanta-spacer" />
          <GhostButton>
            <MoreHorizontal size={17} />
          </GhostButton>
          <GhostButton>
            <SlidersHorizontal size={18} />
          </GhostButton>
        </div>
        <div className="vanta-modern-table vanta-people-task-table">
          <div className="vanta-modern-header">
            <MiniCheckbox />
            <span>Name</span>
            <span>Employment status</span>
            <span>Start date</span>
            <span>End date</span>
            <span>Task status</span>
            <span>Groups</span>
            <span />
          </div>
          {peopleTaskRows.map(([name, status, start, end, task, groupA, groupB], index) => (
            <div className="vanta-modern-row" key={`${name}-${index}`}>
              <MiniCheckbox />
              <strong>
                {index === 0 ? <span className="vanta-initial-dot">62</span> : null}
                {name}
              </strong>
              <FlatPill>{status}</FlatPill>
              <span>{start}</span>
              <span>{end}</span>
              <span>
                {task ? (
                  <FlatPill tone={task.includes('complete') ? 'green' : 'red'} icon={task.includes('complete') ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}>
                    {task}
                  </FlatPill>
                ) : (
                  <span className="vanta-spinner" />
                )}
              </span>
              <span className="vanta-tag-cloud">
                {groupA !== '-' ? <Tag>{groupA}</Tag> : '-'}
                {groupB ? <Tag>{groupB}</Tag> : null}
              </span>
              <MoreHorizontal size={17} />
            </div>
          ))}
        </div>
      </section>
    </FlatShell>
  );
}

const frameworks = [
  'Australian Essential 8',
  'CIS Critical Security Controls v8.1',
  'FedRAMP Moderate Rev. 4',
  'GCP',
  'GDPR',
  'HITRUST e1',
  'ISO 27001:2022',
  'ISO 27017',
  'NIST 800-171',
  'NIST CSF 2.0',
  'Open Finance Data Security Standard',
  'PCI DSS 4.0.1 - SAQ-D Service Provider',
  'UK Cyber Essentials',
  'US Data Privacy',
];

const testRows = [
  ['Inventory items have active owners', 'Automated', '14 frameworks', 'Overdue'],
  ['Inventory items have descriptions', 'Automated', '14 frameworks', 'Overdue'],
  ['Critical vulnerabilities identified in packages are addressed (Azure...', 'Automated', '15 frameworks', 'Due soon'],
  ['High vulnerabilities identified in packages are addressed (Azure...', 'Automated', '15 frameworks', 'Due soon'],
  ['Medium vulnerabilities identified in packages are addressed (Azure...', 'Automated', '15 frameworks', 'Due soon'],
  ['Medium vulnerabilities identified in', 'Automated', '16 frameworks', 'Due soon'],
] as const;

export function TestsOverviewScreen() {
  const navigate = useNavigate();
  return (
    <BarePage className="vanta-tests-overview-page" current>
      <div className="vanta-test-summary-grid">
        <section className="vanta-test-score-card">
          <span className="vanta-score-bubble">15</span>
          <h2>Tests passing</h2>
          <div className="vanta-score-main">
            <strong>44%</strong>
            <span>15 of 34 passing</span>
          </div>
          <div className="vanta-big-meter">
            <span style={{ width: '44%' }} />
          </div>
          <div className="vanta-score-subcards">
            <div>
              <h3>Automated tests</h3>
              <div className="vanta-mini-meter">
                <span style={{ width: '44%' }} />
              </div>
              <p>15 / 34 passing</p>
            </div>
            <div>
              <h3>Documents</h3>
              <div className="vanta-mini-meter">
                <span style={{ width: '0%' }} />
              </div>
              <p>0 / 0 passing</p>
            </div>
          </div>
        </section>
        <section className="vanta-test-attention-card">
          <span className="vanta-score-bubble">19</span>
          <h2>Tests that need attention</h2>
          <div className="vanta-attention-list">
            <span>Overdue</span>
            <strong>2</strong>
            <span>Needs remediation (no SLA assigned)</span>
            <strong>12</strong>
            <span>Due soon</span>
            <strong>5</strong>
          </div>
        </section>
      </div>
      <div className="vanta-test-filter-row">
        <div className="vanta-input-like">
          <Search size={21} />
          <span>Search</span>
        </div>
        {['Category', 'Framework', 'Type', 'Status', 'Rollout'].map((label) => (
          <button key={label} type="button">
            {label} <ChevronDown size={18} />
          </button>
        ))}
        <button type="button" className="vanta-link-button">
          Clear
        </button>
        <GhostButton>
          <SlidersHorizontal size={20} />
        </GhostButton>
      </div>
      <div className="vanta-modern-table vanta-tests-table">
        <div className="vanta-modern-header">
          <MiniCheckbox />
          <span>Name</span>
          <span>Type</span>
          <span>Program mapping</span>
          <span>Status ^</span>
          <span />
        </div>
        {testRows.map(([name, type, mapping, status], index) => (
          <button className="vanta-modern-row as-button" key={name} type="button" onClick={() => navigate(routes.testDetail)}>
            <MiniCheckbox />
            <strong>
              {index === 0 ? <Zap size={22} fill="#666" /> : null}
              {name}
            </strong>
            <span>{type}</span>
            <span className="vanta-dotted-link">
              {mapping} <span className="vanta-linked-rings" />
            </span>
            <FlatPill tone={status === 'Overdue' ? 'red' : 'yellow'} icon={status === 'Overdue' ? <CircleAlert size={14} /> : <Clock3 size={14} />}>
              {status}
            </FlatPill>
            <MoreHorizontal size={18} />
          </button>
        ))}
      </div>
      <div className="vanta-program-popover">
        <span>Program mapping</span>
        <h2>Inventory items have active owners</h2>
        <div className="vanta-popover-callout">
          <span className="vanta-linked-rings" />
          This test evaluates different resources based on the framework
        </div>
        <div className="vanta-popover-table">
          <strong>Framework</strong>
          <strong>Resources in scope</strong>
          {frameworks.map((framework, index) => (
            <div style={{ display: 'contents' }} key={framework}>
              <span>{framework}</span>
              <span>{index === 4 || index === 9 ? 100 : index === 6 ? 99 : index === 11 ? 128 : 129}</span>
            </div>
          ))}
        </div>
      </div>
    </BarePage>
  );
}

export function TestDetailScreen() {
  const resultRows = [
    ['DESKTOP-0', '0', 'Jan 7, 2025', 'All frameworks'],
    ['CISCO 2...', 'Jira', 'Jan 7, 2025', 'All frameworks'],
    ['123456 (', '', 'Jan 7, 2025', 'All frameworks'],
    ['On prem', 'Jira', 'Jan 7, 2025', 'All frameworks'],
    ['ToastyCloud', '', 'Jan 7, 2025', 'All frameworks'],
    ['ada (67d3ee3e5ef2ef9b9c209df1)', '', 'Mar 15, 2025', 'All frameworks'],
    ['MinhK-GPKFHTQV50', 'Owned by Minh Nguyen', 'Mar 27, 2025', 'All frameworks'],
    ['MacBook Pro', 'FB5C9697-1189-5343-8B1A-F63E854388C8', '1 day ago', 'All frameworks'],
  ] as const;
  return (
    <BarePage className="vanta-test-detail-page">
      <header className="vanta-test-detail-head">
        <div>
          <div className="vanta-breadcrumb">Tests</div>
          <h1>Inventory items have active owners</h1>
          <p>This test determines whether each item in the Vanta inventory has an assigned owner who is an active employee.</p>
          <div className="vanta-test-meta">
            <FlatPill tone="yellow" icon={<TriangleAlert size={15} />}>
              Needs reassignment
            </FlatPill>
            <span>
              <Plug size={15} /> Azure, Azure DevOps +15
            </span>
            <span>Last refreshed 8 hours ago</span>
            <span>
              <Zap size={15} /> Task automation enabled
            </span>
          </div>
        </div>
        <div className="vanta-test-actions">
          <GhostButton>
            <FileText size={17} /> About this test
          </GhostButton>
          <GhostButton>
            <Users size={17} />
          </GhostButton>
          <GhostButton>
            <MoreHorizontal size={17} />
          </GhostButton>
        </div>
      </header>
      <div className="vanta-tabs-flat wide">
        {['Results', 'Source data', 'History', 'Tasks (13)', 'Controls (44)', 'Audits', 'Notes'].map((tab, index) => (
          <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>
            {tab}
          </button>
        ))}
      </div>
      <div className="vanta-test-detail-grid">
        <main>
          <div className="vanta-page-action-row compact">
            <h2>Test results</h2>
            <button className="vanta-framework-button" type="button">
              Frameworks <ChevronDown size={16} />
            </button>
            <div className="vanta-spacer" />
            <GhostButton>
              Create task <ChevronDown size={16} />
            </GhostButton>
            <PurpleButton>
              How to remediate <ExternalLink size={17} />
            </PurpleButton>
          </div>
          <div className="vanta-framework-dropdown">
            <div className="vanta-input-like focused">
              <Search size={18} />
              <span>Search</span>
            </div>
            {['All frameworks', 'Internal only', 'ADG Test Frame', 'Australian Essential 8', 'AWS Foundational Technical Review', 'CAIQ', 'CIS Critical Security Controls v8.1', 'COSO', 'Digital Operational Resilience Act'].map((label) => (
              <label key={label}>
                <MiniCheckbox /> {label}
              </label>
            ))}
          </div>
          <div className="vanta-modern-table vanta-result-table">
            <div className="vanta-modern-header">
              <span>
                <CircleAlert size={18} fill="#e0525d" color="#fff" /> 8 items need reassignment
              </span>
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="vanta-modern-row select-row">
              <MiniCheckbox /> Select all <span />
              <span />
              <span />
              <span />
            </div>
            {resultRows.map(([item, source, date, framework]) => (
              <div className="vanta-modern-row" key={item}>
                <MiniCheckbox />
                <strong>
                  {item}
                  {source ? <small>{source}</small> : null}
                </strong>
                <span />
                <span className="date-red">
                  <Calendar size={14} /> {date}
                </span>
                <Tag>{framework}</Tag>
                <MoreHorizontal size={16} />
              </div>
            ))}
          </div>
          <div className="vanta-table-footer">
            <span>1 to 8 of 8 results</span>
            <span>
              Show per page <button type="button">20 <ChevronDown size={14} /></button>
            </span>
          </div>
        </main>
        <aside className="vanta-test-side-panel">
          <span className="vanta-pink-arrow down" />
          <h3>Status</h3>
          <FlatPill tone="red" icon={<CircleAlert size={14} />}>
            Overdue
          </FlatPill>
          <hr />
          <h3>Frameworks</h3>
          <div className="vanta-tag-cloud">
            {frameworks.map((framework) => (
              <Tag key={framework}>{framework.replace('PCI DSS 4.0.1 - SAQ-D Service Provider', 'PCI DSS 4.0.1')}</Tag>
            ))}
          </div>
        </aside>
      </div>
    </BarePage>
  );
}

const integrationCards = [
  ['Addigy', 'Computers,Inventory', 'A', 'blue'],
  ['Amazon Web Services (AWS)', 'Access,Inventory,Vulnerabilities', 'aws', 'orange'],
  ['Azure', 'Access,Inventory,Vulnerabilities', 'A', 'blue'],
  ['Azure DevOps', 'Access,Inventory,Task creation,+2', 'D', 'blue'],
  ['Bitbucket', 'Access,Inventory', 'B', 'blue'],
  ['Box', 'Access', 'box', 'blue'],
  ['Calendly', 'Access', 'C', 'blue'],
  ['Checkr', 'Access,People', 'C', 'green'],
  ['Cloudflare', 'Access,Inventory', 'cf', 'orange'],
] as const;

function ScopeTabs({ people = false }: { people?: boolean }) {
  return (
    <>
      <div className="vanta-tabs-flat framework">
        {['Overview', 'Requirements', 'Scope'].map((tab, index) => (
          <button key={tab} className={(people ? index === 2 : index === 0) || tab === 'Scope' ? 'is-active' : ''} type="button">
            {tab}
          </button>
        ))}
      </div>
      <div className="vanta-scope-toggle-row">
        <button className={cx(!people && 'is-active')} type="button">
          <Wrench size={18} /> Systems
        </button>
        <button className={cx(people && 'is-active')} type="button">
          <Users size={18} /> People
        </button>
      </div>
    </>
  );
}

export function FrameworkScopeScreen() {
  const navigate = useNavigate();
  return (
    <BarePage className="vanta-framework-scope-page">
      <div className="vanta-breadcrumb">Frameworks</div>
      <h1>
        ESG Demo <FlatPill>Custom</FlatPill>
      </h1>
      <ScopeTabs />
      <h2>Configurable integrations</h2>
      <p>Modify which integrations and assets you want to include in your framework.</p>
      <div className="vanta-integration-scope-grid">
        {integrationCards.map(([name, scopes, logo, tone], index) => (
          <article key={name} className="vanta-integration-scope-card">
            {index === 0 ? <span className="vanta-pink-arrow configure" /> : null}
            <div className="vanta-integration-card-body">
              <Glyph label={logo} tone={tone as 'purple' | 'blue' | 'green' | 'black' | 'orange'} />
              <h3>
                {name} <FlatPill tone="green">In scope</FlatPill>
              </h3>
              <div className="vanta-tag-cloud">
                {scopes.split(',').map((scope) => (
                  <Tag key={scope}>{scope}</Tag>
                ))}
              </div>
            </div>
            <div className="vanta-integration-card-footer">
              <GhostButton className={index === 0 ? 'pink-outline' : ''} onClick={() => index === 0 && navigate('/vanta-clone/frameworks/esg-demo/scope/addigy')}>
                <Settings size={14} /> Configure scope
              </GhostButton>
              <Toggle />
            </div>
          </article>
        ))}
      </div>
    </BarePage>
  );
}

export function IntegrationScopeConfigScreen() {
  return (
    <BarePage className="vanta-integration-config-page">
      <header>
        <div>
          <div className="vanta-breadcrumb">Frameworks / ESG Demo</div>
          <h1>
            <Glyph label="A" tone="blue" /> Addigy <FlatPill tone="green">In scope</FlatPill>
          </h1>
          <p>Configure whether your account is in scope for ESG Demo</p>
        </div>
        <div>
          <GhostButton>Cancel</GhostButton>
          <GhostButton className="disabled">Save changes</GhostButton>
        </div>
      </header>
      <section className="vanta-config-panel">
        <div className="vanta-config-panel-head">
          <h2>Addigy</h2>
          <strong>
            In scope <Toggle />
          </strong>
        </div>
        <div className="vanta-config-assets">
          <div className="vanta-config-assets-head">
            <h3>Assets</h3>
            <label>
              <MiniCheckbox /> Exclude new assets from scope <Info size={13} />
            </label>
          </div>
          <div className="vanta-input-like small">
            <Search size={15} />
            <span>Search by asset name</span>
          </div>
          <button className="vanta-asset-dropdown" type="button">
            <span>
              <strong>Addigy Managed Computers</strong>
              <small>1 of 1 in scope</small>
            </span>
            <ChevronDown size={18} />
          </button>
        </div>
      </section>
    </BarePage>
  );
}

export function InventoryScopeScreen() {
  const resources = ['Autoscale groups (3)', 'Azure Subscriptions (3)', 'Cluster deployments (0)', 'Compute instances (20)', 'Computers (MDM) (7)', 'Computers (Vanta ag... (2)', 'Container clusters (1)', 'Container repositories (1)', 'Data warehouses (4)', 'Encryption Keys (8)', 'GCP Organization Pr... (2)', 'Git repositories (23)', 'Kubernetes clusters (3)', 'Load balancers (8)', 'NoSQL databases (2)'];
  return (
    <BarePage className="vanta-inventory-page">
      <div className="vanta-page-action-row">
        <div>
          <h1>Autoscale groups</h1>
          <p>
            Seeing some accounts that should not be here? <a>Learn more about scoping out resources.</a>
          </p>
        </div>
        <GhostButton>
          <Pencil size={15} /> Edit bulk tag
        </GhostButton>
      </div>
      <div className="vanta-inventory-layout">
        <aside>
          <h4>STANDARD</h4>
          {resources.map((resource, index) => (
            <button key={resource} type="button" className={index === 0 ? 'is-active' : ''}>
              {resource}
            </button>
          ))}
        </aside>
        <main>
          <div className="vanta-filter-bar">
            <div className="vanta-input-like small">
              <Search size={15} />
              <span>Search...</span>
            </div>
            <button type="button">
              All owners <ChevronDown size={15} />
            </button>
            <button type="button">
              Frameworks <ChevronDown size={15} />
            </button>
            <div className="vanta-spacer" />
            <GhostButton>
              <Download size={15} /> Export
            </GhostButton>
          </div>
          <div className="vanta-info-banner">
            <Info size={18} />
            <span>
              Vanta supports reading tags from various cloud provider integrations to populate different attributes. We recommend using Vanta tags or custom tags to populate attributes as they are continuous checked and are more scalable. <a>Learn more.</a>
            </span>
            <GhostButton>Edit bulk tag</GhostButton>
            <X size={16} />
          </div>
          <div className="vanta-modern-table vanta-inventory-table">
            <div className="vanta-modern-header">
              <MiniCheckbox />
              <span>Service / Identifier / Details</span>
              <span>Region / Account</span>
              <span>Description <Info size={13} /></span>
              <span>Owner <Info size={13} /></span>
              <span className="vanta-pink-column">Framework scope <Info size={13} /></span>
              <span />
            </div>
            {[1, 2, 3].map((row) => (
              <div className="vanta-modern-row" key={row}>
                <MiniCheckbox />
                <strong>
                  <Glyph label="A" tone="blue" />
                  JakeVMscaleSet
                  <small>/subscriptions/69aaad1-cf24-4a2d-89ab-7233370e96f7/resourceGrou...</small>
                </strong>
                <span>
                  {row === 1 ? 'westus' : 'eastus'}
                  <small>Azure subscriptio...</small>
                </span>
                <span>The Name has a space</span>
                <span>Dave's team</span>
                <span className="vanta-pink-column vanta-tag-cloud">
                  <Tag>CAIQ</Tag>
                  <Tag>ADG Test Frame</Tag>
                  <Tag>Australian Essential 8</Tag>
                  <strong>+18</strong>
                </span>
                <ExternalLink size={17} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </BarePage>
  );
}

export function PrivacyPeopleScopeScreen() {
  const navigate = useNavigate();
  return (
    <BarePage className="vanta-privacy-scope-page">
      <div className="vanta-breadcrumb">Frameworks</div>
      <h1>Australian Privacy Principles</h1>
      <FlatPill>Custom</FlatPill>
      <div className="vanta-tabs-flat framework">
        {['Overview', 'Controls', 'Tests', 'Scope'].map((tab, index) => (
          <button key={tab} type="button" className={index === 3 ? 'is-active' : ''}>
            {tab}
          </button>
        ))}
      </div>
      <div className="vanta-scope-toggle-row">
        <button type="button">
          <Wrench size={18} /> Systems
        </button>
        <button type="button" className="is-active">
          <Users size={18} /> People
        </button>
        <button type="button" className="vanta-feedback">
          <Sparkles size={16} /> Submit feedback
        </button>
      </div>
      <div className="vanta-page-action-row">
        <div>
          <h2>People</h2>
          <p>
            The following personnel groups can be modified for your framework scope. Missing a group? Import or create a new group in <u>Personnel</u>
          </p>
        </div>
        <GhostButton>Update scope</GhostButton>
      </div>
      <div className="vanta-settings-banner">
        <span>
          Devices and user access accounts will not be automatically included or excluded from scope. <FlatPill tone="blue">Preview</FlatPill>
        </span>
        <GhostButton className="pink-outline" onClick={() => navigate('/vanta-clone/frameworks/australian-privacy-principles/scope-settings')}>
          Change settings
        </GhostButton>
      </div>
      <div className="vanta-filter-bar">
        <div className="vanta-input-like small">
          <Search size={15} />
          <span>Search</span>
        </div>
        <button type="button">
          Source <ChevronDown size={15} />
        </button>
        <div className="vanta-spacer" />
        <GhostButton>
          <SlidersHorizontal size={16} />
        </GhostButton>
      </div>
    </BarePage>
  );
}

export function ScopeSettingsScreen() {
  return (
    <BarePage className="vanta-scope-settings-page">
      <div className="vanta-breadcrumb">Back to Personnel scope</div>
      <h1>Scope Settings</h1>
      <p>Set whether devices and access accounts should follow their owner's scoping or be managed manually for this framework.</p>
      {[
        ['Devices', 'Include or exclude a device based on its owner status. Switching to automatic will override any manual scoping.', "Set the device's scope directly within the integration."],
        ['Access Accounts', "Include or exclude access accounts based on their owner's status. Switching to automatic will override any manual scoping.", "Manage user account scope manually in the integration. Existing configurations won't change--update them as needed."],
      ].map(([title, autoCopy, manualCopy]) => (
        <section key={title}>
          <h2>{title}</h2>
          <label className="vanta-radio-option">
            <span className="vanta-radio-dot" /> <strong>Automatically scope with owner</strong>
            <small>{autoCopy}</small>
          </label>
          <label className="vanta-radio-option selected">
            <span className="vanta-radio-dot" /> <strong>Set manually</strong>
            <small>{manualCopy}</small>
          </label>
        </section>
      ))}
    </BarePage>
  );
}

export function AuditModalScreen() {
  const [internal, setInternal] = useState(false);
  return (
    <FlatShell active="Compliance" child="Audits" workspace="Acme Co" avatar="A">
      <section className="vanta-flat-page audit-modal-bg">
        <h1>Audits</h1>
        <div className="vanta-tabs-flat">
          <button className="is-active" type="button">
            Active
          </button>
          <button type="button">Completed</button>
        </div>
        <div className="vanta-audit-ghost-card">
          <h2>SOC 2 Type II</h2>
          <div className="vanta-progress-track mini">
            <span style={{ background: '#f5575f', width: '22%' }} />
            <span style={{ background: '#3d91ef', width: '38%' }} />
            <span style={{ background: '#12c94b', width: '31%' }} />
            <span style={{ background: '#ddd', width: '9%' }} />
          </div>
        </div>
      </section>
      <div className="vanta-modal-backdrop" />
      <section className="vanta-audit-modal">
        <button type="button" className="vanta-modal-close" aria-label="Close">
          <X size={18} />
        </button>
        <h2>Add a new audit</h2>
        <h3>Define audit scope</h3>
        <p>Your audit's framework, visibility and auditor cannot be edited once the audit is created. Make sure to discuss with your auditor first.</p>
        <label>
          Framework
          <button className="vanta-modal-select highlight" type="button">
            Select a framework <ChevronDown size={16} />
          </button>
        </label>
        <div className="vanta-modal-radios">
          <strong>
            Audit type <Info size={13} />
          </strong>
          <button type="button" onClick={() => setInternal(false)}>
            <span className={cx('vanta-radio-dot', !internal && 'is-on')} /> External
          </button>
          <button type="button" onClick={() => setInternal(true)}>
            <span className={cx('vanta-radio-dot', internal && 'is-on')} /> Internal
          </button>
        </div>
        <label>
          Audit firm (optional)
          <button className="vanta-modal-select" type="button">
            Select an audit firm <ChevronDown size={16} />
          </button>
          <small>Don't see your auditor? Invite them to Vanta</small>
        </label>
        <label className="disabled">
          Auditor
          <button className="vanta-modal-select" type="button">
            Select the auditor <ChevronDown size={16} />
          </button>
        </label>
        <footer>
          <strong>Step 1 of 3</strong>
          <span>
            <GhostButton>Back</GhostButton>
            <GhostButton className="disabled">Next</GhostButton>
          </span>
        </footer>
      </section>
    </FlatShell>
  );
}

function ProgramHealthTable({ tooltip = false }: { tooltip?: boolean }) {
  const tooltipEvents: Array<{ label: string; count: number; icon: LucideIcon }> = [
    { label: 'Controls moved to "OK"', count: 366, icon: Check },
    { label: 'Controls moved to "Not passing"', count: 13, icon: TriangleAlert },
    { label: 'Controls added', count: 74, icon: Plus },
    { label: 'Controls removed', count: 689, icon: X },
  ];
  const rows = [
    ['A', 'Amalgamated Widgets', 47, '+0% since last week', 99, '2381 of 2397'],
    ['T', 'Tiger Labs App', 64, '+2% since last week', 99, '3009 of 3051'],
    ['V', 'VelocirAPPtor', 46, '+1% since last week', 99, '172 of 173'],
    ['G', 'Vendor Guard', 0, '+0% since last week', 0, '0 of 1'],
  ] as const;
  return (
    <section className="vanta-console-card program-health">
      <Filter className="vanta-card-filter" size={24} />
      <h2>Control and evidence status</h2>
      <div className="vanta-program-table">
        <div className="vanta-program-header">
          <span>Workspace</span>
          <span>Controls</span>
          <span>Tests</span>
          <span>Documents</span>
        </div>
        {rows.map(([letter, name, controls, delta, docs, count], index) => (
          <div className="vanta-program-row" key={name}>
            <span>
              <Glyph label={letter} tone={letter === 'T' ? 'orange' : letter === 'V' ? 'green' : 'black'} />
              {name}
            </span>
            <span>
              <span className="vanta-ring" /> {controls}% <FlatPill tone={controls ? 'green' : 'gray'}>{delta}</FlatPill>
            </span>
            <span>
              <span className="vanta-ring" /> {index === 3 ? 28 : index === 2 ? 56 : index === 1 ? 44 : 38}% <FlatPill>{index === 3 ? '13 of 47' : index === 2 ? '115 of 204' : index === 1 ? '192 of 434' : '107 of 282'}</FlatPill>
            </span>
            <span>
              <span className="vanta-ring" /> {docs}% <FlatPill>{count}</FlatPill>
            </span>
          </div>
        ))}
      </div>
      {tooltip ? (
        <div className="vanta-health-tooltip">
          <h3>Amalgamated Widgets controls</h3>
          <p>+0% since last week</p>
          <hr />
          <strong>In the last week</strong>
          {tooltipEvents.map(({ label, count, icon: Icon }) => (
            <span key={label}>
              <Icon size={18} />
              {label}
              <strong>{count}</strong>
            </span>
          ))}
          <GhostButton>View full breakdown</GhostButton>
        </div>
      ) : null}
    </section>
  );
}

function ProgressCard({ title, pct, done, total }: { title: string; pct: number; done: number; total: number }) {
  return (
    <article className="vanta-console-card progress">
      <Filter size={20} />
      <h3>{title}</h3>
      <strong>{pct}%</strong>
      <div className="vanta-big-meter">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p>
        <span>{done} controls complete</span>
        <span>{total} total</span>
      </p>
    </article>
  );
}

export function ConsoleProgramHealthScreen() {
  return (
    <FlatShell active="Home" workspace="Workspace cons..." compactSidebar menu animal avatar="JH">
      <section className="vanta-console-page">
        <h1>Program health</h1>
        <ProgramHealthTable />
        <h2>Framework progress</h2>
        <div className="vanta-console-progress-grid">
          <ProgressCard title="SOC 2 progress" pct={73} done={116} total={159} />
          <ProgressCard title="ISO 27001:2022 progress" pct={17} done={22} total={128} />
          <ProgressCard title="HIPAA progress" pct={14} done={10} total={73} />
        </div>
      </section>
    </FlatShell>
  );
}

export function ConsoleHomeScreen() {
  return (
    <FlatShell active="Home" workspace="Tiger Labs App" compactSidebar menu nestedMenu animal avatar="JH">
      <section className="vanta-console-page home">
        <h1>Home</h1>
        <div className="vanta-warning-card">
          <TriangleAlert size={22} /> We found stale data in one or more of your integrations. Please go to the Integrations page for more details.
          <GhostButton>View details</GhostButton>
        </div>
        <div className="vanta-warning-card">
          <TriangleAlert size={22} /> We're having trouble assigning owners to some of your resources. Please go to the Inventory page for more details.
          <GhostButton>View details</GhostButton>
        </div>
        <div className="vanta-page-action-row">
          <h2>Compliance progress</h2>
          <span>Last updated less than a minute ago</span>
        </div>
        <div className="vanta-compliance-progress-grid">
          <ProgressCard title="SOC 2" pct={73} done={116} total={159} />
          <ProgressCard title="ISO 27001:2022" pct={17} done={22} total={128} />
          <ProgressCard title="HIPAA" pct={14} done={10} total={73} />
        </div>
        <a className="vanta-purple-link">View all frameworks -&gt;</a>
      </section>
    </FlatShell>
  );
}

export function ConsoleHomeTooltipScreen() {
  return (
    <FlatShell active="Home" workspace="Workspace cons..." compactSidebar animal avatar="JH">
      <section className="vanta-console-page">
        <h1>Home</h1>
        <h2>Program health</h2>
        <ProgramHealthTable tooltip />
        <h2>Framework progress</h2>
        <div className="vanta-console-progress-grid">
          <ProgressCard title="SOC 2 progress" pct={73} done={116} total={159} />
          <ProgressCard title="ISO 27001:2022 progress" pct={17} done={22} total={128} />
          <ProgressCard title="HIPAA progress" pct={14} done={10} total={73} />
        </div>
      </section>
    </FlatShell>
  );
}

export function NotificationsSettingsScreen() {
  return (
    <FlatShell active="Settings" workspace="Tiger Labs App" animal avatar="JH">
      <section className="vanta-settings-page">
        <h1>Notifications</h1>
        <div className="vanta-settings-layout">
          <aside>
            <h4>Company</h4>
            {['Notifications', 'User permissions', 'Roles', 'Teams', 'Information', 'Login and security', 'Billing', 'Frameworks', 'Language', 'Developer console', 'Tags', 'Advanced'].map((item, index) => (
              <button key={item} type="button" className={index === 0 || index === 4 ? 'is-active-soft' : ''}>
                {item}
              </button>
            ))}
            <h4>My account</h4>
            {['Notifications', 'GraphQL API tokens', 'Language', 'Interface'].map((item) => (
              <button key={item} type="button">
                {item}
              </button>
            ))}
          </aside>
          <main>
            <section className="vanta-settings-card">
              <h2>Schedule</h2>
              <p>Configure when Test, Document, and Control owners should be notified about failures.</p>
              <div className="vanta-settings-section">
                <h3>Allow notifications</h3>
                <label className="vanta-radio-option">
                  <span className="vanta-radio-dot" /> <strong>Anytime</strong>
                </label>
                <label className="vanta-radio-option selected inline">
                  <span className="vanta-radio-dot" /> <strong>Every day between 9am and 6pm in</strong>
                  <GhostButton>GMT+2 Europe/Paris <ChevronDown size={16} /></GhostButton>
                </label>
              </div>
            </section>
            <section className="vanta-settings-card">
              <div className="vanta-page-action-row">
                <div>
                  <h2>Personnel reminders</h2>
                  <p>Send personnel a digest of their incomplete security tasks.</p>
                </div>
                <Toggle />
              </div>
              <div className="vanta-settings-section">
                <h3>Frequency</h3>
                <label className="vanta-radio-option">
                  <span className="vanta-radio-dot" /> <strong>Every Monday</strong>
                </label>
                <label className="vanta-radio-option selected">
                  <span className="vanta-radio-dot" /> <strong>Every weekday</strong>
                </label>
                <GhostButton>Email <ChevronDown size={16} /></GhostButton>
              </div>
            </section>
            <section className="vanta-settings-card">
              <h2>External notifications</h2>
              <p>Notify external mailing lists and users not in Vanta.</p>
              <div className="vanta-tabs-flat">
                {['HR', 'IT', 'Engineering', 'Policy', 'Risk', 'Vendors', 'Trust Center', 'Access reviews'].map((tab, index) => (
                  <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>
                    {tab}
                  </button>
                ))}
              </div>
            </section>
          </main>
        </div>
      </section>
    </FlatShell>
  );
}

export function IntegrationsCatalogScreen() {
  const cards = ['13 Penetration Testing & Scanning', '360Learning', '4me', '8x8', 'AccessOwl', 'Acunetix360', 'Aha'];
  return (
    <FlatShell active="Integrations" workspace="Tiger Labs App" animal avatar="JH">
      <section className="vanta-integrations-page">
        <div className="vanta-page-action-row">
          <div>
            <h1>
              Integrations <Info size={18} />
            </h1>
            <p>
              Review your integrations and enable new connections to activate automated evidence collection and monitoring. Vanta scans your infrastructure from a known <a>IP address</a> in case an allowlist is required.
            </p>
          </div>
          <a className="vanta-purple-link">
            Missing an integration? Let us know! <ExternalLink size={16} />
          </a>
        </div>
        <div className="vanta-tabs-flat">
          {['Available (345)', 'Connected (28)', 'Errors (1)'].map((tab, index) => (
            <button key={tab} className={index === 0 ? 'is-active' : ''} type="button">
              {tab}
            </button>
          ))}
        </div>
        <div className="vanta-filter-bar">
          <div className="vanta-input-like">
            <Search size={18} />
            <span>Search available integrations</span>
          </div>
          <button type="button">
            Category <ChevronDown size={16} />
          </button>
          <button type="button">
            Creator <ChevronDown size={16} />
          </button>
          <button type="button">
            Status <ChevronDown size={16} />
          </button>
        </div>
        <div className="vanta-category-dropdown">
          {['Background checkers', 'Cloud providers', 'Communication platforms', 'CRM platforms', 'Datastore providers', 'Data warehouse providers'].map((category, index) => (
            <label key={category} className={index === 4 ? 'is-hovered' : ''}>
              <MiniCheckbox /> {category}
            </label>
          ))}
          <button type="button">Clear</button>
        </div>
        <h2>Recommended for you</h2>
        <p className="vanta-integrations-copy">
          To save you time, we've bookmarked the integrations you are likely already using that you haven't installed. If you see a bookmarked system that you don't recognize, you can see the specific employees who use it.
        </p>
        <div className="vanta-integration-catalog-grid">
          {cards.map((card, index) => (
            <article key={card} className="vanta-catalog-card">
              <span className="vanta-bookmark" />
              <div className="vanta-catalog-logo">{card.slice(0, 2)}</div>
              <h3>{card}</h3>
              <p>{index === 0 || index === 4 ? 'Document upload' : 'Access'}</p>
              <footer>
                <GhostButton>View details</GhostButton>
                <PurpleButton>Connect</PurpleButton>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </FlatShell>
  );
}

const controlRows = [
  ['AAT-1', 'Job Scheduling Access', 'Batch job scheduling is restricted to authorized individuals.', 'Unassigned', 'Vanta', 'SOX ITGC - JP.01', '0/4'],
  ['AAT-2', 'Automate production code deployment', 'Utilize automation tools for building, testing, and deploying code to production', 'Unassigned', 'Vanta', 'OFDSS - Use automation', '0/4'],
  ['AAT-3', 'Security and Privacy Function Verification | Automation Support for Distributed Testing', 'Implement automated mechanisms to support the management of distributed security and privacy function testing.', 'Unassigned', 'Vanta', 'NIST 800-53 - SI-6(2)', '0/14'],
  ['AAT-4', 'Manage 1.1', 'Determination is made about whether the AI system achieves its intended purpose and stated objectives and should proceed in development or deployment.', 'Unassigned', 'Vanta', 'NIST AI RMF - Manage 1', '0/2'],
] as const;

function ControlsBaseContent() {
  return (
    <section className="vanta-controls-page">
      <div className="vanta-page-action-row">
        <h1>Controls</h1>
        <div>
          <GhostButton>More <ChevronDown size={15} /></GhostButton>
          <PurpleButton>Add control <ChevronDown size={15} /></PurpleButton>
        </div>
      </div>
      <div className="vanta-controls-card-grid">
        <section className="vanta-control-summary-card assignment">
          <h2>Assignment</h2>
          <div className="vanta-donut">0%<small>Assigned</small></div>
          <div className="vanta-assignment-legend">
            <span><i /> Unassigned <strong>4825</strong></span>
            <span><i className="purple" /> Assigned <strong>1</strong></span>
            <span><i className="orange" /> Needs reassignment <strong>0</strong></span>
          </div>
        </section>
        <section className="vanta-control-summary-card completion">
          <h2>Completion</h2>
          <div>
            <small>Controls OK</small>
            <strong>2%</strong>
            <div className="vanta-big-meter"><span style={{ width: '2%' }} /></div>
            <p><span>85 controls</span><span>4826 total</span></p>
          </div>
          <div className="vanta-completion-mini">
            <span>Test <ExternalLink size={12} /><strong>11/128</strong></span>
            <div className="vanta-mini-meter"><span style={{ width: '9%' }} /></div>
            <span>Document <ExternalLink size={12} /><strong>1/3033</strong></span>
            <div className="vanta-mini-meter"><span style={{ width: '0%' }} /></div>
          </div>
        </section>
      </div>
      <div className="vanta-filter-bar controls">
        <div className="vanta-input-like small"><Search size={15} /><span>Search controls</span></div>
        {['Framework', 'Owner', 'Domain', 'Source', 'Framework code', 'Status', 'Trust Center', 'Risk'].map((label) => (
          <button key={label} type="button">{label} <ChevronDown size={14} /></button>
        ))}
        <div className="vanta-spacer" />
        <GhostButton><SlidersHorizontal size={16} /></GhostButton>
      </div>
      <div className="vanta-modern-table vanta-controls-table">
        <div className="vanta-modern-header">
          <MiniCheckbox /><span>ID <Info size={13} /></span><span>Control</span><span>Owner</span><span>Source</span><span>Frameworks</span><span>Tests</span><span />
        </div>
        {controlRows.map(([id, name, desc, owner, source, framework, tests]) => (
          <div className="vanta-modern-row" key={id}>
            <MiniCheckbox />
            <span>{id}</span>
            <strong>{name}<small>{desc}</small></strong>
            <span><span className="vanta-spinner" /> {owner}</span>
            <span><Glyph label="V" /> {source}</span>
            <Tag>{framework}</Tag>
            <span><span className="vanta-spinner" /> {tests}</span>
            <MoreHorizontal size={16} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ControlsOverviewScreen() {
  return (
    <SimpleVantaShell active="Compliance" child="Controls">
      <ControlsBaseContent />
    </SimpleVantaShell>
  );
}

export function ControlsUploadScreen() {
  return (
    <>
      <SimpleVantaShell active="Compliance" child="Controls" dim>
        <ControlsBaseContent />
      </SimpleVantaShell>
      <div className="vanta-modal-backdrop light" />
      <section className="vanta-file-upload-modal">
        <header>
          <h2><Download size={17} /> Upload a File</h2>
          <button type="button" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="vanta-upload-layout">
          <aside>
            <div className="vanta-import-note"><Info size={16} /> Make sure your file includes the following required columns:</div>
            <h4>Required columns</h4>
            {['Control ID', 'Control Description'].map((item) => (
              <p key={item}>{item}<Info size={15} /></p>
            ))}
            <h4>Optional columns</h4>
            {['Control Summary', 'Control Note', 'Domain', 'EIDAS'].map((item) => (
              <p key={item}>{item}<Info size={15} /></p>
            ))}
            <PurpleButton>Download Excel template</PurpleButton>
          </aside>
          <main className="vanta-drop-zone">
            <div className="vanta-file-icons">
              <FileText size={54} />
              <FileText size={54} />
              <span>+</span>
            </div>
            <h3>What data do you want to upload?</h3>
            <p>Upload a CSV or Excel file to begin the import process.</p>
          </main>
        </div>
        <footer>Powered by <strong>one schema</strong></footer>
      </section>
    </>
  );
}

export function ControlsImportReviewScreen() {
  return (
    <>
      <SimpleVantaShell active="Compliance" child="Controls" dim>
        <ControlsBaseContent />
      </SimpleVantaShell>
      <div className="vanta-modal-backdrop light" />
      <section className="vanta-import-review-modal">
        <header>
          <h2><CheckCircle2 size={18} /> Review & finalize</h2>
          <button type="button" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="vanta-review-toolbar">
          {['All rows', 'Clean rows', 'Rows with issues'].map((label, index) => (
            <button key={label} className={index === 0 ? 'is-active' : ''} type="button">{label} <span>{index === 0 ? 2 : index === 1 ? 2 : 0}</span></button>
          ))}
          <div className="vanta-spacer" />
          <GhostButton><FileText size={16} /> Map columns</GhostButton>
          <GhostButton><Search size={16} /> Find and replace</GhostButton>
          <GhostButton><Download size={16} /> Export</GhostButton>
        </div>
        <div className="vanta-import-grid">
          <div className="vanta-import-head"><MiniCheckbox /></div>
          {['Control Summary', 'Control ID', 'Control Description', 'Control Note', 'Domain', 'SOC 2'].map((heading) => (
            <div key={heading} className="vanta-import-head">{heading} <Info size={12} /> <ChevronDown size={14} /></div>
          ))}
          {[
            ['1', 'This is a test summary', 'TEST-01', 'This is a test description', '', '', 'CC 1.1,CC'],
            ['2', 'This is another test summary', 'TEST-02', 'This is another test description', '', '', 'CC 2.2,CC'],
          ].map((row) => (
            <div style={{ display: 'contents' }} key={row[0]}>
              <div><MiniCheckbox /> {row[0]}</div>
              {row.slice(1).map((cell, index) => <div key={`${row[0]}-${index}`}>{cell}</div>)}
            </div>
          ))}
        </div>
        <footer>
          <span>Powered by <strong>one schema</strong></span>
          <div><GhostButton>Previous</GhostButton><PurpleButton>Import</PurpleButton></div>
        </footer>
      </section>
    </>
  );
}

export function HomeWelcomeScreen() {
  return (
    <SimpleVantaShell active="Home">
      <section className="vanta-welcome-page">
        <h1>Home</h1>
        <div className="vanta-welcome-hero">
          <div>
            <h2>Welcome to Vanta!</h2>
            <p>Get started by connecting your identity provider to import your company's personnel.</p>
            <p>If you do not have the appropriate credentials, add the team member who does as an admin.</p>
            <div>
              <PurpleButton>Connect identity provider</PurpleButton>
              <GhostButton>Invite another admin</GhostButton>
            </div>
          </div>
          <div className="vanta-mascot-art" aria-hidden="true">
            <span className="rock" />
            <span className="body" />
            <span className="neck" />
            <span className="head" />
            <span className="ear a" />
            <span className="ear b" />
            <span className="grass" />
          </div>
        </div>
      </section>
    </SimpleVantaShell>
  );
}

const frameworkCards = [
  ['Essential 8 Level 2', '0%', 'ACSC'],
  ['AWS FTR', '2%', 'aws FTR'],
  ['CCPA', '7%', 'CCPA'],
  ['CIS v8.1', '5%', 'CIS v8'],
  ['CPS 234', '0%', 'APRA CPS 234'],
  ['DORA', '0%', 'DORA'],
] as const;

function FrameworkCards() {
  return (
    <section className="vanta-frameworks-grid">
      {frameworkCards.map(([title, pct, seal]) => (
        <article key={title} className="vanta-framework-card">
          <div><h3>{title}</h3><span>{seal}</span></div>
          <footer><span className="vanta-ring" /> <strong>{pct}</strong><GhostButton>Snooze</GhostButton></footer>
        </article>
      ))}
    </section>
  );
}

export function FrameworksCatalogScreen() {
  return (
    <SimpleVantaShell active="Compliance" child="Frameworks">
      <section className="vanta-frameworks-page">
        <div className="vanta-page-action-row">
          <h1>Frameworks</h1>
          <div><GhostButton><Plus size={15} /> Add framework</GhostButton><GhostButton>View audits</GhostButton></div>
        </div>
        <div className="vanta-tabs-flat compact"><button className="is-active" type="button">All</button><button type="button">Custom</button></div>
        <div className="vanta-input-like small"><Search size={14} /><span>Search</span></div>
        <FrameworkCards />
      </section>
    </SimpleVantaShell>
  );
}

export function FrameworkImportModalScreen() {
  return (
    <>
      <SimpleVantaShell active="Compliance" child="Frameworks" dim>
        <section className="vanta-frameworks-page">
          <div className="vanta-page-action-row"><h1>Frameworks</h1><div><GhostButton><Plus size={15} /> Add framework</GhostButton><GhostButton>View audits</GhostButton></div></div>
          <FrameworkCards />
        </section>
      </SimpleVantaShell>
      <div className="vanta-modal-backdrop" />
      <section className="vanta-framework-import-modal">
        <header><h2>Import custom framework</h2><button type="button" aria-label="Close"><X size={18} /></button></header>
        {([
          ['Framework name', 'Test Framework', false],
          ['Framework description', 'Test Framework Description', true],
          ['Short name', 'TEST', false],
          ['Parent section label', 'Requirement Category', false],
          ['Child section label', 'Requirement', false],
        ] as Array<[string, string, boolean]>).map(([label, value, large]) => (
          <label key={label}>
            {label} {label !== 'Framework name' ? <small>Optional</small> : null}
            {large ? <textarea defaultValue={String(value)} /> : <input defaultValue={String(value)} />}
          </label>
        ))}
        <footer><GhostButton>Cancel</GhostButton><PurpleButton>Import sections</PurpleButton></footer>
      </section>
    </>
  );
}

export function FrameworkDetailScreen() {
  return (
    <SimpleVantaShell active="Compliance" child="Frameworks">
      <section className="vanta-framework-detail-page">
        <div className="vanta-breadcrumb">Frameworks</div>
        <div className="vanta-page-action-row">
          <div><h1>Test Framework <FlatPill>Custom</FlatPill></h1><div className="vanta-filter-bar inline"><div className="vanta-input-like small"><Search size={14} /><span>Search...</span></div><button type="button">Control status <ChevronDown size={14} /></button><button type="button">Owner <ChevronDown size={14} /></button></div></div>
          <div><GhostButton>More <ChevronDown size={14} /></GhostButton><GhostButton><Plus size={14} /> Create new control</GhostButton></div>
        </div>
        <div className="vanta-framework-detail-layout">
          <aside><h4>Requirement categories</h4><button>Parent-1 Parent Section Name - 1</button><button>Parent-2 Parent Section Name - 2</button></aside>
          <main>
            <div className="vanta-framework-detail-cards">
              <section><h2>Completion</h2><small>Controls OK</small><strong>100%</strong><div className="vanta-big-meter"><span style={{ width: '100%' }} /></div><p><span>2 controls</span><span>2 total</span></p></section>
              <section><h2>Audit timeline</h2><GhostButton>View audits</GhostButton><p>No audit scheduled. Contact your auditor to enter a date.</p><div className="vanta-dot-timeline">{['Now', 'Dec', 'Feb', 'Apr', 'Jun', 'Aug'].map((m) => <span key={m}>{m}</span>)}</div></section>
            </div>
            <section className="vanta-parent-section">
              <button className="vanta-section-more" type="button"><MoreHorizontal size={16} /></button>
              <h2><span>Parent-1</span> Parent Section Name - 1</h2>
              <p>This is a parent section description</p>
              <div className="vanta-child-section">
                <header><h3>CHILD-1 Child Section Name - 1 -&gt;</h3><div><GhostButton>Add control</GhostButton><GhostButton><MoreHorizontal size={15} /></GhostButton></div></header>
                <div className="vanta-modern-table vanta-framework-control-table">
                  <div className="vanta-modern-header"><span>Control</span><span>Evidence readiness</span><span>Owner</span><span /></div>
                  <div className="vanta-modern-row"><strong>This is a test summary <FlatPill>Custom</FlatPill><small>This is a test description</small></strong><span>0/0</span><span>Unassigned</span><Link2 size={15} /></div>
                </div>
              </div>
              <div className="vanta-toast"><CheckCircle2 size={15} /> Framework successfully imported!</div>
            </section>
          </main>
        </div>
      </section>
    </SimpleVantaShell>
  );
}

function FrameworkUploadBackground({ dim = false }: { dim?: boolean }) {
  return (
    <SimpleVantaShell active="Compliance" child="Frameworks" dim={dim}>
      <section className="vanta-frameworks-page">
        <div className="vanta-page-action-row">
          <h1>Frameworks</h1>
          <div>
            <GhostButton>
              <Plus size={15} /> Add framework
            </GhostButton>
            <GhostButton>View audits</GhostButton>
          </div>
        </div>
        <div className="vanta-tabs-flat compact">
          <button className="is-active" type="button">
            All
          </button>
          <button type="button">Custom</button>
        </div>
        <div className="vanta-input-like small">
          <Search size={14} />
          <span>Search</span>
        </div>
        <FrameworkCards />
      </section>
    </SimpleVantaShell>
  );
}

export function FrameworkUploadScreen() {
  return (
    <>
      <FrameworkUploadBackground dim />
      <div className="vanta-modal-backdrop light" />
      <section className="vanta-file-upload-modal vanta-framework-file-modal">
        <header>
          <h2>
            <Download size={17} /> Upload a File
          </h2>
          <button type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="vanta-upload-layout">
          <aside>
            <div className="vanta-import-note">
              <Info size={16} /> Make sure your file includes the following required columns:
            </div>
            <h4>Required columns</h4>
            {['Section ID', 'Section Name', 'Section Description', 'Parent Section ID', 'Section Type'].map((item) => (
              <p key={item}>
                {item}
                <Info size={15} />
              </p>
            ))}
            <h4>Optional columns</h4>
            <p>
              Control IDs
              <Info size={15} />
            </p>
            <PurpleButton>Download Excel template</PurpleButton>
          </aside>
          <main className="vanta-drop-zone">
            <div className="vanta-file-icons">
              <FileText size={54} />
              <FileText size={54} />
              <span>+</span>
            </div>
            <h3>What data do you want to upload?</h3>
            <p>Upload a CSV or Excel file to begin the import process.</p>
          </main>
        </div>
        <footer>
          Powered by <strong>one schema</strong>
        </footer>
      </section>
    </>
  );
}

export function FrameworkImportReviewScreen() {
  const rows = [
    ['1', 'PARENT-1', 'Parent Section Name - 1', 'This is a parent section description', '', '', 'p'],
    ['2', 'CHILD-1', 'Child Section Name - 1', 'This is a child section description', 'PARENT-1', 'TEST-01', 'c'],
    ['3', 'PARENT-2', 'Parent Section Name - 2', 'This is a parent section description', '', '', 'p'],
    ['4', 'CHILD-2', 'Child Section Name - 2', 'This is a child section description', 'PARENT-2', 'TEST-02', 'c'],
  ] as const;

  return (
    <>
      <FrameworkUploadBackground dim />
      <div className="vanta-modal-backdrop light" />
      <section className="vanta-import-review-modal vanta-framework-review-modal">
        <header>
          <h2>
            <CheckCircle2 size={18} /> Review &amp; finalize
          </h2>
          <button type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="vanta-review-toolbar">
          {['All rows', 'Clean rows', 'Rows with issues'].map((label, index) => (
            <button key={label} className={index === 0 ? 'is-active' : ''} type="button">
              {label} <span>{index === 2 ? 0 : 4}</span>
            </button>
          ))}
          <div className="vanta-spacer" />
          <GhostButton>
            <FileText size={16} /> Map columns
          </GhostButton>
          <GhostButton>
            <Search size={16} /> Find and replace
          </GhostButton>
          <GhostButton>
            <Download size={16} /> Export
          </GhostButton>
        </div>
        <div className="vanta-import-grid vanta-framework-import-grid">
          <div className="vanta-import-head">
            <MiniCheckbox />
          </div>
          {['Section ID', 'Section Name', 'Section Description', 'Parent Section ID', 'Control IDs', 'Section Type'].map((heading) => (
            <div key={heading} className="vanta-import-head">
              {heading} <Info size={12} /> <ChevronDown size={14} />
            </div>
          ))}
          {rows.map((row) => (
            <div style={{ display: 'contents' }} key={row[0]}>
              <div>
                <MiniCheckbox /> {row[0]}
              </div>
              {row.slice(1).map((cell, index) => (
                <div key={`${row[0]}-${index}`} className={row[0] === '4' && index === 4 ? 'is-focused-cell' : ''}>
                  {index === 5 ? <Tag>{cell}</Tag> : cell}
                </div>
              ))}
            </div>
          ))}
        </div>
        <footer>
          <span>
            Powered by <strong>one schema</strong>
          </span>
          <div>
            <GhostButton>Previous</GhostButton>
            <PurpleButton>Import</PurpleButton>
          </div>
        </footer>
      </section>
    </>
  );
}

function SuggestionCard({
  title,
  kind,
  items,
}: {
  title: string;
  kind: string;
  items: string[];
}) {
  return (
    <section className="vanta-drawer-map-card">
      <header>
        <strong>{title}</strong>
        <button type="button">
          <Plus size={14} />
        </button>
      </header>
      <div className="vanta-ai-suggestion-bar">
        <Sparkles size={13} />
        <span>Vanta AI suggests {kind} for this control</span>
        <button type="button">Add all</button>
        <button type="button">Ignore all</button>
      </div>
      {items.map((item) => (
        <div className="vanta-ai-suggestion-row" key={item}>
          <a>{item}</a>
          <button type="button">
            <Check size={13} />
          </button>
          <button type="button">
            <X size={13} />
          </button>
        </div>
      ))}
      <button className="vanta-show-more" type="button">
        Show more
      </button>
      <p>No {title.toLowerCase()} associated with this control</p>
    </section>
  );
}

export function FrameworkControlDrawerScreen() {
  return (
    <>
      <FrameworkDetailScreen />
      <aside className="vanta-framework-drawer">
        <div className="vanta-drawer-actions">
          <MoreHorizontal size={15} />
          <X size={15} />
        </div>
        <h2>This is a test summary</h2>
        <p>This is a test access control description</p>
        <dl className="vanta-control-dl">
          <dt>ID</dt>
          <dd>TEST-01</dd>
          <dt>Source</dt>
          <dd>Custom</dd>
          <dt>Domain</dt>
          <dd>Select an option</dd>
          <dt>Owner</dt>
          <dd>
            <span className="vanta-spinner" /> Assign owner
          </dd>
          <dt>Note</dt>
          <dd>Add a note...</dd>
        </dl>
        <div className="vanta-tabs-flat compact drawer-tabs">
          <button className="is-active" type="button">
            Mapped elements
          </button>
          <button type="button">History</button>
        </div>
        <SuggestionCard
          title="Tests"
          kind="5 tests"
          items={[
            'Company has an approved FedRAMP Access Control policy',
            'Company has an approved FedRAMP Access Control Procedure',
            'Company has an approved Access Control Policy',
          ]}
        />
        <SuggestionCard
          title="Documents"
          kind="20 documents"
          items={[
            'Office visitor access restricted',
            'Access control and monitoring mechanisms for in-scope physical facilities',
            'HITRUST - Access Control Policy Addendum',
          ]}
        />
        <section className="vanta-drawer-map-card small">
          <header>
            <strong>Mapped frameworks</strong>
            <GhostButton>Add</GhostButton>
          </header>
          <div className="vanta-drawer-chip">Test Framework - CHILD-1 <X size={12} /></div>
        </section>
        <section className="vanta-drawer-map-card small">
          <header>
            <strong>Risk scenarios</strong>
            <button type="button">
              <Plus size={14} />
            </button>
          </header>
          <p>No risk scenarios associated with this control</p>
        </section>
      </aside>
    </>
  );
}

function TestsDashboardChrome({
  title = 'Tests',
  query,
  custom = false,
}: {
  title?: string;
  query?: string;
  custom?: boolean;
}) {
  const categories = custom
    ? [
        ['All', '2'],
        ['HR', ''],
        ['IT', '1'],
        ['Policy', ''],
        ['Engineering', ''],
        ['Risks', ''],
        ['Custom', '1'],
      ]
    : [
        ['All', '3019'],
        ['HR', '131'],
        ['IT', '202'],
        ['Policy', '1952'],
        ['Engineering', '364'],
        ['Risks', '47'],
        ['Custom', '323'],
      ];
  const rows = custom
    ? [['Jira Test', 'Custom', 'Automated test', 'Due soon', 'Jul 12, 2024']]
    : [
        ['Company has an approved Asset Management Policy', 'Policy', 'Automated test', 'Needs remediation', '-'],
        ['Company has approved its policy: Test Asset Management', 'Policy', 'Automated test', 'Needs remediation', '-'],
        ['HITRUST - Asset Management Policy Addendum', 'Policy', 'Document', 'Needs remediation', '-'],
        ['Sampling Required: Configuration Management and hardening checklis...', 'Information technology', 'Document', 'Needs remediation', '-'],
      ];

  return (
    <SimpleVantaShell active="Tests">
      <section className="vanta-custom-tests-page">
        <div className="vanta-page-action-row">
          <h1>{title}</h1>
          <div>
            <GhostButton>
              <Plus size={17} /> Create custom test
            </GhostButton>
            <GhostButton>
              <Pencil size={17} /> Edit SLAs
            </GhostButton>
          </div>
        </div>
        <div className="vanta-tests-category-layout">
          <aside>
            <h4>Category</h4>
            {categories.map(([label, count]) => (
              <button key={label} className={label === (custom ? 'Custom' : 'All') ? 'is-active' : ''} type="button">
                <span>{label}</span>
                {count ? <strong>{count}</strong> : null}
              </button>
            ))}
            <h4>Deactivated</h4>
            <button type="button">All deactivated</button>
          </aside>
          <main>
            <div className="vanta-test-dashboard-cards">
              <section>
                <h2>OK <strong>{custom ? 0 : 255}</strong></h2>
                <b>{custom ? '0%' : '7%'}</b>
                <div className="vanta-big-meter">
                  <span style={{ width: custom ? '0%' : '7%' }} />
                </div>
                <p>
                  <span>{custom ? '0 OK' : '255 OK'}</span>
                  <span>{custom ? '1 total' : '3274 total'}</span>
                </p>
              </section>
              <section>
                <h2>Needs attention <strong>{custom ? 1 : 3019}</strong></h2>
                {[
                  ['Overdue', custom ? 0 : 185],
                  ['Due soon', custom ? 1 : 33],
                  ['Needs remediation (no SLA assigned)', custom ? 0 : 2801],
                ].map(([label, count], index) => (
                  <p key={label}>
                    {index === 0 ? <CircleAlert size={18} fill="#e0525d" color="#fff" /> : index === 1 ? <Clock3 size={18} fill="#d86d00" color="#fff" /> : <TriangleAlert size={18} fill="#e0525d" color="#fff" />}
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </p>
                ))}
              </section>
            </div>
            <div className="vanta-filter-bar">
              <div className={cx('vanta-input-like', query && 'focused')}>
                <Search size={18} />
                <span>{query || 'Search'}</span>
              </div>
              {['Framework', 'Control', 'Integration', 'Owner', 'Type', 'Status', 'Rollout'].map((label) => (
                <button key={label} type="button">
                  {label} <ChevronDown size={15} />
                </button>
              ))}
              {query ? <button className="vanta-link-button" type="button">Clear</button> : null}
              <div className="vanta-spacer" />
              <GhostButton>
                <SlidersHorizontal size={18} />
              </GhostButton>
            </div>
            <div className="vanta-modern-table vanta-custom-tests-table">
              <div className="vanta-modern-header">
                <MiniCheckbox />
                <span>Name</span>
                <span>Category</span>
                <span>Owner</span>
                <span>Type</span>
                <span>Status</span>
                <span>Due date</span>
                <span>Frameworks</span>
              </div>
              {rows.map(([name, category, type, status, due], index) => (
                <div className="vanta-modern-row" key={name}>
                  <MiniCheckbox />
                  <strong>{name}</strong>
                  <span>{category}</span>
                  <span>{custom ? <span className="vanta-spinner" /> : index === 0 ? <span className="vanta-spinner" /> : <span className="vanta-owner-bubble">JT</span>}</span>
                  <span>{type}</span>
                  <FlatPill tone={status === 'Due soon' ? 'yellow' : 'red'} icon={status === 'Due soon' ? <Clock3 size={14} /> : <TriangleAlert size={14} />}>
                    {status}
                  </FlatPill>
                  <span>{due}</span>
                  <span>{custom ? '-' : <Tag>ISO 27001:2022</Tag>}</span>
                </div>
              ))}
            </div>
            <div className="vanta-table-footer">
              <span>1 to {custom ? 1 : 4} of {custom ? 1 : 4} results</span>
              <span>
                Show per page <button type="button">{custom ? 20 : 100} <ChevronDown size={14} /></button>
              </span>
            </div>
          </main>
        </div>
      </section>
    </SimpleVantaShell>
  );
}

export function CustomTestModalScreen() {
  return (
    <>
      <TestsDashboardChrome />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-custom-test-modal">
        <header>
          <h2>Create a custom test</h2>
          <button type="button" aria-label="Close">
            <X size={28} />
          </button>
        </header>
        <div className="vanta-custom-test-form">
          <label>
            Test name
            <input />
          </label>
          <label>
            Description
            <textarea />
          </label>
          <label>
            "How to fix" instructions <span>Optional</span>
            <textarea />
          </label>
          <button className="vanta-large-select focused" type="button">
            Select an integration <ChevronDown size={21} />
          </button>
          <a>
            Need help creating a custom test? Learn more <ExternalLink size={20} />
          </a>
        </div>
        <footer>
          <GhostButton>Cancel</GhostButton>
          <GhostButton className="disabled">Create</GhostButton>
        </footer>
      </section>
    </>
  );
}

export function CustomTestsFilteredScreen() {
  return <TestsDashboardChrome title="Tests: Custom" query="jira" custom />;
}

function JiraTestContent() {
  return (
    <SimpleVantaShell active="Tests">
      <section className="vanta-jira-test-page">
        <div className="vanta-breadcrumb">Tests / Jira Test /</div>
        <button className="vanta-menu-trigger" type="button">
          <MoreHorizontal size={22} />
        </button>
        <h1>
          Jira Test <FlatPill icon={<Wrench size={16} />}>Custom</FlatPill>
        </h1>
        <p>test</p>
        <div className="vanta-test-meta">
          <span>
            <span className="vanta-spinner" /> Unassigned <Pencil size={16} />
          </span>
          <span>
            <Plug size={16} /> Jira
          </span>
          <span>Last refreshed 1 minute ago</span>
        </div>
        <div className="vanta-tabs-flat">
          {['Results', 'Source data', 'History', 'Tasks (0)', 'Controls (0)', 'Notes'].map((tab, index) => (
            <button key={tab} className={index === 4 ? 'is-active highlighted' : ''} type="button">
              {tab}
            </button>
          ))}
        </div>
        <section className="vanta-empty-controls-card">
          <h2>No related controls</h2>
          <p>This test helps enforce a good security practice, but is not associated with any controls.</p>
          <button type="button">Add control -&gt;</button>
        </section>
      </section>
    </SimpleVantaShell>
  );
}

export function JiraTestDetailScreen() {
  return <JiraTestContent />;
}

export function AddTestToControlModalScreen() {
  return (
    <>
      <JiraTestContent />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-control-picker-modal">
        <header>
          <h2>Add test to control</h2>
          <button type="button" aria-label="Close">
            <X size={28} />
          </button>
        </header>
        <div className="vanta-control-picker-filters">
          <div className="vanta-input-like">
            <Search size={19} />
            <span>Search controls</span>
          </div>
          <button type="button">
            Framework <ChevronDown size={18} />
          </button>
        </div>
        <div className="vanta-control-picker-grid">
          <aside>
            <h4>Controls</h4>
            {['Manage 2.3', 'Policy and Procedures', 'Literacy Training and Awareness', 'Role Based Training', 'Training Records', 'Access Restrictions for Change', 'Asset disposal procedures utilized (new name)', 'Data retention procedures established'].map((item, index) => (
              <button key={item} className={index === 0 ? 'is-active' : ''} type="button">
                {item}
                {index === 1 || index === 6 ? <FlatPill tone="green" icon={<Check size={14} />}>Added</FlatPill> : null}
              </button>
            ))}
          </aside>
          <main>
            <h3>Manage 2.3</h3>
            <div className="vanta-remove-row">
              <button className="vanta-full-purple-button" type="button">Add</button>
              <GhostButton>
                <ExternalLink size={20} />
              </GhostButton>
            </div>
            <hr />
            <h4>Description</h4>
            <p>Mechanisms are in place and applied to supersede, disengage, or deactivate AI systems that demonstrate performance or outcomes inconsistent with intended use. Changing this control</p>
            <h4>Domain</h4>
            <FlatPill>Artificial &amp; Autonomous Technology</FlatPill>
            <h4>Frameworks</h4>
            <FlatPill>paige</FlatPill> <FlatPill>NIST AI Risk Management Framework</FlatPill>
            <h4>Related sections</h4>
            <FlatPill>Paige123</FlatPill> <FlatPill>Manage 2</FlatPill>
          </main>
        </div>
      </section>
    </>
  );
}

const documentRows = [
  ['Completed performance...', 'Human resources', 'Employees', 'Needs document since May 25 2023'],
  ['Board of directors charter', 'Policy', 'Shannon D', 'Needs document'],
  ['Access review evidence', 'Information technology', 'Audra', 'OK'],
] as const;

function DocumentsListContent() {
  return (
    <section className="vanta-documents-list-page">
      <div className="vanta-page-action-row">
        <h1>Documents: All</h1>
        <div>
          <GhostButton>
            <Download size={17} /> Export all
          </GhostButton>
          <button className="vanta-flat-button primary highlighted" type="button">
            Add document <ChevronDown size={17} />
          </button>
        </div>
      </div>
      <div className="vanta-document-layout">
        <aside>
          <h4>Category</h4>
          {['All', 'HR', 'IT', 'Policy', 'Engineering'].map((item, index) => (
            <button key={item} className={index === 0 ? 'is-active' : ''} type="button">
              {item}
            </button>
          ))}
        </aside>
        <main>
          <div className="vanta-filter-bar">
            <div className="vanta-input-like">
              <Search size={18} />
              <span>Search all documents</span>
            </div>
            {['Status', 'Subcategory', 'Frequency', 'Framework', 'Priority', 'Owner', 'Time sensitivity'].map((label) => (
              <button key={label} type="button">
                {label} <ChevronDown size={15} />
              </button>
            ))}
          </div>
          <div className="vanta-modern-table vanta-documents-table">
            <div className="vanta-modern-header">
              <MiniCheckbox />
              <span>Name</span>
              <span>Category</span>
              <span>Owner</span>
              <span>Status</span>
            </div>
            {documentRows.map(([name, category, owner, status]) => (
              <div className="vanta-modern-row" key={name}>
                <MiniCheckbox />
                <strong>
                  {name}
                  <span className="vanta-tag-cloud">
                    <FlatPill>Sensitive</FlatPill>
                    <FlatPill>ISO 27001:2022</FlatPill>
                    <FlatPill>+2</FlatPill>
                  </span>
                </strong>
                <span>
                  {category}
                  <small>Employees</small>
                </span>
                <span>{owner}</span>
                <FlatPill tone={status === 'OK' ? 'green' : 'gray'}>
                  {status}
                </FlatPill>
              </div>
            ))}
          </div>
        </main>
      </div>
    </section>
  );
}

export function DocumentsListScreen() {
  return (
    <SimpleVantaShell active="Compliance" child="Documents">
      <DocumentsListContent />
    </SimpleVantaShell>
  );
}

export function NewCustomDocumentScreen() {
  return (
    <>
      <SimpleVantaShell active="Compliance" child="Documents" dim>
        <DocumentsListContent />
      </SimpleVantaShell>
      <div className="vanta-modal-backdrop" />
      <section className="vanta-new-document-modal">
        <header>
          <h2>New custom document</h2>
          <button type="button" aria-label="Close">
            <X size={28} />
          </button>
        </header>
        <div className="vanta-custom-test-form">
          <label>
            Document name
            <input placeholder={'e.g. "Clear Desk Policy Enforced"'} />
          </label>
          <label>
            Description
            <textarea placeholder={'e.g. "Image of internal office space showing clear desk policy in action at 3 or more workstations."'} />
          </label>
          <label className="vanta-sensitive-check">
            <MiniCheckbox /> This is a sensitive document <Info size={18} />
          </label>
          <label>
            Recurrence
            <small>Select how often the document needs to be renewed since the most recent upload.</small>
            <button className="vanta-large-select" type="button">
              Annually <ChevronDown size={21} />
            </button>
          </label>
          <div className="vanta-radio-block">
            <h3>Time sensitivity <span>Optional</span></h3>
            <p>This only applies when you map this document to a control used by SOC2.</p>
            <label className="vanta-radio-option selected">
              <span className="vanta-radio-dot" /> <strong>Upload anytime</strong>
            </label>
            <label className="vanta-radio-option">
              <span className="vanta-radio-dot" /> <strong>Upload during SOC 2 observation window</strong>
            </label>
          </div>
        </div>
        <footer>
          <GhostButton>View N/A documents</GhostButton>
          <span>
            <GhostButton>Cancel</GhostButton>
            <button className="vanta-create-risk-button" type="button">Create document</button>
          </span>
        </footer>
      </section>
    </>
  );
}

function DocumentDetailContent({ menu = false }: { menu?: boolean }) {
  return (
    <BarePage className="vanta-document-detail-page">
      <header className="vanta-doc-view-topbar">
        <div>
          <button type="button" aria-label="Close">
            <X size={26} />
          </button>
          <strong>Board of directors charter</strong>
        </div>
        <div>
          <FlatPill>
            <span className="red-dot" /> Needs document
          </FlatPill>
          <GhostButton>Snooze document</GhostButton>
          <GhostButton>Mark as not relevant</GhostButton>
          <GhostButton className={menu ? 'highlighted' : ''}>
            More <ChevronDown size={15} />
          </GhostButton>
        </div>
        {menu ? (
          <div className="vanta-doc-more-menu">
            <button type="button">Mark as sensitive</button>
            <button type="button">Add control</button>
            <button type="button">Delete</button>
          </div>
        ) : null}
      </header>
      <main>
        <section className="vanta-doc-upload-zone">
          <h2>Add a new document</h2>
          <p>Drag and drop, or select a file</p>
          <div>
            <GhostButton>
              <Download size={15} /> Upload
            </GhostButton>
            <GhostButton>
              <Link2 size={15} /> Add link
            </GhostButton>
          </div>
          <small>Upload files up to 50 MB of the following types: .docx, .jpg, .pdf, .ai, .png, .webp, .xlsx, .csv, .txt, .xls, .zip</small>
        </section>
        <section className="vanta-doc-details-panel">
          <header>
            <ChevronDown size={18} />
            <h2>Details</h2>
          </header>
          <div className="vanta-doc-detail-columns">
            <div>
              <h3>Description</h3>
              <p>Board of directors charter or policy which outlines the independent function of the board (if applicable).</p>
              <p>Guidance: See sample board of directors charter: <a>Google docs template</a> / <a>Docx template</a>. If your organization does not have a Board of Directors, complete this Ethical Management Survey: <a>Google docs template</a> / <a>Docx template</a> and upload as evidence.</p>
              <h3>Time sensitivity &amp; recurrence</h3>
              <p>Renew annually</p>
            </div>
            <div>
              <h3>Add note (optional)</h3>
              <textarea placeholder="Add additional context about this specific document." />
              <small>This is visible to all Vanta users within your company.</small>
              <PurpleButton>Save note</PurpleButton>
            </div>
          </div>
        </section>
      </main>
      <button className="vanta-help-bubble" type="button">
        <HelpCircle size={20} />
      </button>
    </BarePage>
  );
}

export function DocumentDetailScreen({ menu = false }: { menu?: boolean }) {
  return <DocumentDetailContent menu={menu} />;
}

export function AddDocumentToControlModalScreen({ selected = false }: { selected?: boolean }) {
  return (
    <>
      <DocumentDetailContent menu />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-control-picker-modal vanta-document-control-modal">
        <header>
          <h2>Add document to control</h2>
          <button type="button" aria-label="Close">
            <X size={22} />
          </button>
        </header>
        <div className="vanta-control-picker-filters">
          <div className="vanta-input-like highlighted">
            <Search size={19} />
            <span>Search controls</span>
          </div>
          <button className="highlighted" type="button">
            Framework <ChevronDown size={18} />
          </button>
        </div>
        <div className="vanta-control-picker-grid">
          <aside>
            <h4>Controls</h4>
            {['Job Scheduling Access', 'Automate production code deployment', 'Asset disposal procedures utilized', 'Asset disposal procedures utilized', 'Data retention procedures established', 'Production inventory maintained', 'Production inventory maintained', 'Inventory of assets'].map((item, index) => (
              <button key={`${item}-${index}`} className={selected && index === 0 ? 'is-active' : ''} type="button">
                {item}
              </button>
            ))}
          </aside>
          <main>
            {selected ? (
              <>
                <h3>Job Scheduling Access</h3>
                <div className="vanta-remove-row">
                  <button className="vanta-full-purple-button" type="button">Add</button>
                  <GhostButton>
                    <ExternalLink size={20} />
                  </GhostButton>
                </div>
                <hr />
                <h4>Description</h4>
                <p>Batch job scheduling is restricted to authorized individuals.</p>
              </>
            ) : null}
          </main>
        </div>
      </section>
    </>
  );
}

export function DocumentUploadScreen() {
  return (
    <BarePage className="vanta-document-upload-page">
      <header className="vanta-doc-view-topbar">
        <div>
          <button type="button" aria-label="Close">
            <X size={26} />
          </button>
          <strong>Document Name</strong>
          <FlatPill>
            <span className="red-dot" /> ISO 27017
          </FlatPill>
        </div>
        <GhostButton>
          More <ChevronDown size={16} />
        </GhostButton>
      </header>
      <section className="vanta-doc-upload-zone large">
        <h2>Add a new document</h2>
        <p>Drag and drop, or select a file</p>
        <div>
          <GhostButton className="highlighted">
            <Download size={16} /> Upload
          </GhostButton>
          <GhostButton>
            <Link2 size={16} /> Add link
          </GhostButton>
        </div>
        <small>Upload files up to 50 MB of the following types: .docx, .jpg, .pdf, .ai, .png, .webp, .xlsx, .csv, .txt, .xls, .zip</small>
      </section>
    </BarePage>
  );
}

export function DocumentUploadDetailsModalScreen() {
  return (
    <>
      <DocumentUploadScreen />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-upload-details-modal">
        <header>
          <h2>Search_Searches_default_01242023_1351.xlsx</h2>
          <button type="button" aria-label="Close">
            <X size={28} />
          </button>
        </header>
        <div className="vanta-custom-test-form">
          <label>
            Filename
            <input defaultValue="Search_Searches_default_01242023_1351" />
            <small>Provide a friendly filename to your auditor.</small>
          </label>
          <label>
            Description (optional)
            <input />
          </label>
          <label>
            Effective date
            <button className="vanta-large-select" type="button">
              <Calendar size={24} /> Jan 25 2023
            </button>
            <small>When did this document go into effect? This will help keep your documents updated.</small>
          </label>
        </div>
        <footer>
          <GhostButton>Cancel</GhostButton>
          <button className="vanta-create-risk-button" type="button">Upload</button>
        </footer>
      </section>
    </>
  );
}

export function EditCustomDocumentRequestScreen() {
  return (
    <>
      <DocumentDetailContent />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-edit-document-request-modal">
        <header>
          <h2>Edit custom document request</h2>
          <button type="button" aria-label="Close">
            <X size={34} />
          </button>
        </header>
        <div className="vanta-custom-test-form">
          {['Existing Standard', 'Existing Control', 'New Standard', 'New Control'].map((label, index) => (
            <label key={label} className={index === 1 || index === 3 ? 'is-disabled' : ''}>
              {label}
              <button className={cx('vanta-large-select', index === 2 && 'focused')} type="button">
                Select an option <ChevronDown size={22} />
              </button>
            </label>
          ))}
          <label>
            Title
            <input defaultValue="Example Document" />
          </label>
          <label>
            Description
            <textarea defaultValue="This is an example for the Help Article" />
          </label>
        </div>
        <footer>
          <GhostButton>Cancel</GhostButton>
          <button className="vanta-create-risk-button" type="button">Save</button>
        </footer>
      </section>
    </>
  );
}

export function PolicyTemplatesScreen() {
  const rows = ['AIMS Performance Evaluation', 'AIMS Risk Management Policy', 'AIMS Scope Policy', 'AIMS Support and Operations Policy'];
  return (
    <SimpleVantaShell active="Compliance" child="Policies">
      <section className="vanta-policy-templates-page">
        <div className="vanta-modern-table vanta-policy-template-table">
          {rows.map((row) => (
            <div className="vanta-modern-row" key={row}>
              <strong>{row}</strong>
              <FlatPill>ISO 42001</FlatPill>
              <FlatPill>
                <span className="gray-dot" /> Not started
              </FlatPill>
              <span>-</span>
              <PurpleButton>Start</PurpleButton>
            </div>
          ))}
        </div>
      </section>
    </SimpleVantaShell>
  );
}

export function PolicyEditorScreen() {
  return (
    <BarePage className="vanta-policy-editor-page">
      <header className="vanta-doc-view-topbar">
        <div>
          <button type="button" aria-label="Close">
            <X size={26} />
          </button>
          <strong>Access Control Policy</strong>
          <FlatPill>CCPA</FlatPill>
          <FlatPill>GDPR</FlatPill>
          <FlatPill>+4</FlatPill>
        </div>
        <div>
          <GhostButton className="highlighted">Delete and reset</GhostButton>
        </div>
      </header>
      <div className="vanta-policy-editor-status">
        <Info size={22} />
        <FlatPill>
          <span className="gray-dot" /> Pending approval
        </FlatPill>
        <div className="vanta-spacer" />
        <PurpleButton>Close</PurpleButton>
        <GhostButton>
          <MoreHorizontal size={20} />
        </GhostButton>
      </div>
      <div className="vanta-editor-toolbar">
        {['Paragraph', 'A', 'A', 'A', 'B', 'I', 'U', 'S', '1', 'List', 'Quote', 'Table'].map((item, index) => (
          <button key={`${item}-${index}`} type="button">{item}</button>
        ))}
        <span>Auto-save enabled</span>
      </div>
      <section className="vanta-policy-paper">
        <div className="vanta-vantaroo-logo">vantaroo</div>
        <p>Access Control Policy</p>
      </section>
    </BarePage>
  );
}

export function AssignApproverModalScreen() {
  return (
    <>
      <PolicyEditorScreen />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-policy-step-modal approver">
        <header>
          <h2>Assign an approver</h2>
          <button type="button" aria-label="Close">
            <X size={34} />
          </button>
        </header>
        <div className="vanta-policy-step-body">
          <div className="vanta-note-box">
            <p>The policy approver is often the person responsible for this policy's enforcement (e.g. Secure Development Policy should be approved by your CTO).</p>
            <p>If you cannot find who you're looking for, they might not have the necessary access. <a>Please assign the user as an admin or editor.</a></p>
          </div>
          <label>
            Approver
            <button className="vanta-large-select" type="button">
              Krista Panda <ChevronDown size={24} />
            </button>
          </label>
          <div className="vanta-note-box">
            <Info size={22} />
            <p>Krista Panda will receive an email about this approval request. They will be able to see the approve button once logged in with their Vanta account. To change the approver or make edits to this policy, cancel the approval request.</p>
          </div>
        </div>
        <footer>
          <strong>Step 2 of 2</strong>
          <span>
            <GhostButton>Back</GhostButton>
            <button className="vanta-create-risk-button" type="button">Assign approver</button>
          </span>
        </footer>
      </section>
    </>
  );
}

export function PolicyReacceptModalScreen() {
  return (
    <>
      <PolicyEditorScreen />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-policy-step-modal reaccept">
        <header>
          <h2>Do you want employees to reaccept Anti-Discrimination and Harassment Policy after it is approved?</h2>
          <button type="button" aria-label="Close">
            <X size={34} />
          </button>
        </header>
        <div className="vanta-policy-step-body">
          {[
            ['Yes, ask employees to reaccept this policy', 'You have made some major changes to this policy, such as introducing a new section.'],
            ["No, don't ask employees to reaccept this policy", 'You have only made minor changes to this policy, such as fixing some typos.'],
          ].map(([title, copy]) => (
            <label className="vanta-policy-option-card" key={title}>
              <span className="vanta-radio-dot" />
              <strong>{title}</strong>
              <p>{copy}</p>
            </label>
          ))}
          <div className="vanta-policy-groups-box">
            <p>Employee groups subject to acceptance of this policy:</p>
            <ul>
              {['Renew', 'Contractors', 'Abnormal', 'Full Time Employees', 'FTE', 'Test 2', 'Test Group', 'CFO', 'New Group - Reset Onboarding', 'Security Test', 'Customer Operations', 'Default group testing'].map((group) => (
                <li key={group}>{group}</li>
              ))}
            </ul>
          </div>
        </div>
        <footer>
          <strong>Step 1 of 2</strong>
          <button className="vanta-create-risk-button" type="button">Next</button>
        </footer>
      </section>
    </>
  );
}

function PolicyVersionShell({ children }: { children: ReactNode }) {
  return (
    <BarePage className="vanta-policy-version-page">
      <div className="vanta-version-card">{children}</div>
    </BarePage>
  );
}

export function PolicyVersionEmptyScreen() {
  return (
    <PolicyVersionShell>
      <button className="vanta-flat-button version-button" type="button">
        Create new version
      </button>
    </PolicyVersionShell>
  );
}

export function PolicyCreateVersionScreen() {
  return (
    <PolicyVersionShell>
      <header>
        <h1>Create a new version</h1>
        <GhostButton>Cancel</GhostButton>
      </header>
      <div className="vanta-version-language">
        <strong>Template language:</strong>
        <GhostButton>
          English <ChevronDown size={20} />
        </GhostButton>
      </div>
      <button className="vanta-version-choice" type="button">
        <span className="purple">
          <Pencil size={30} />
        </span>
        <strong>Use the policy editor</strong>
        <p>Keep editing the policy with the editor.</p>
        <ChevronDown size={28} />
      </button>
      <div className="vanta-or-divider">Or</div>
      <button className="vanta-version-choice" type="button">
        <span className="green">
          <Download size={30} />
        </span>
        <strong>Upload a file from computer</strong>
        <p>Supported formats: .pdf .docx</p>
        <ChevronDown size={28} />
      </button>
      <button className="vanta-version-choice" type="button">
        <span className="blue">
          <Link2 size={30} />
        </span>
        <strong>Sync a file</strong>
        <p>Supported apps: Confluence, Google Drive, Sharepoint</p>
        <ChevronDown size={28} />
      </button>
    </PolicyVersionShell>
  );
}

export function PolicyUploadVersionScreen() {
  return (
    <PolicyVersionShell>
      <header className="compact">
        <h2>Upload a file</h2>
        <GhostButton>Cancel</GhostButton>
      </header>
      <button className="vanta-large-select" type="button">
        English <ChevronDown size={16} />
      </button>
      <section className="vanta-doc-upload-zone compact">
        <h2>Drag &amp; drop new document</h2>
        <GhostButton>
          <Download size={15} /> Upload
        </GhostButton>
        <small>Upload files up to 50 MB of the following types: .docx, .pdf</small>
      </section>
    </PolicyVersionShell>
  );
}

export function PolicySyncConfluenceScreen() {
  return (
    <PolicyVersionShell>
      <header>
        <h1>Sync from Confluence</h1>
        <GhostButton>Cancel</GhostButton>
      </header>
      <div className="vanta-input-like focused vanta-confluence-search">
        <Search size={25} />
        <span>Filter by name</span>
      </div>
      <button className="vanta-confluence-card" type="button">
        <Glyph label="D" tone="blue" />
        <span>
          <strong>Test policy</strong>
          <small>Last modified: 25 days ago</small>
        </span>
        <ChevronDown size={26} />
      </button>
    </PolicyVersionShell>
  );
}

export function CreateCustomPolicyScreen() {
  return (
    <>
      <PoliciesListScreen />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-create-policy-modal">
        <header>
          <h2>Create new policy</h2>
          <button type="button" aria-label="Close">
            <X size={34} />
          </button>
        </header>
        <div className="vanta-custom-test-form">
          <div className="vanta-note-box">
            <Info size={22} />
            <div>
              <h3>Custom policy test creation</h3>
              <p>For each custom policy, we will create two new policy tests. These tests will monitor that policies are revised and approved annually, and that each approved version is accepted by all relevant employees. All new tests appear on the <a>Monitoring page</a> under the Policies category.</p>
            </div>
          </div>
          <label>
            Policy title
            <input defaultValue="Help Center Review" />
          </label>
          <label>
            Description
            <textarea defaultValue="Review Help Center documentation quarterly" />
          </label>
        </div>
        <footer>
          <GhostButton>Cancel</GhostButton>
          <button className="vanta-create-risk-button" type="button">Create</button>
        </footer>
      </section>
    </>
  );
}

function CustomPolicyDetailContent() {
  return (
    <BarePage className="vanta-custom-policy-detail-page">
      <header className="vanta-doc-view-topbar">
        <div>
          <button type="button" aria-label="Close">
            <X size={26} />
          </button>
          <strong>Help Center Review</strong>
        </div>
        <GhostButton>
          More <ChevronDown size={16} />
        </GhostButton>
      </header>
      <section className="vanta-custom-policy-draft-card">
        <div>
          <h2>Draft</h2>
          <p>Last edited by Shannon D - a few seconds ago</p>
          <div>
            <FlatPill>
              <span className="gray-dot" /> Needs approval
            </FlatPill>
            <FlatPill>Created with policy editor</FlatPill>
          </div>
        </div>
        <div className="vanta-custom-policy-actions highlighted">
          <PurpleButton>Submit for approval</PurpleButton>
          <GhostButton>Edit</GhostButton>
          <GhostButton>
            <MoreHorizontal size={20} />
          </GhostButton>
        </div>
        <div className="vanta-editor-preview">
          <div>B I U A</div>
          <p />
          <p />
          <p />
        </div>
      </section>
      <section className="vanta-doc-details-panel">
        <header>
          <ChevronDown size={18} />
          <h2>Details</h2>
        </header>
        <div className="vanta-doc-detail-columns single">
          <div>
            <h3>Description</h3>
            <p>Review Help Center documentation quarterly</p>
            <h3>Time sensitivity &amp; recurrence</h3>
            <p>Renew annually</p>
          </div>
        </div>
      </section>
      <button className="vanta-help-bubble" type="button">
        <HelpCircle size={20} />
      </button>
    </BarePage>
  );
}

export function CustomPolicyDetailScreen() {
  return <CustomPolicyDetailContent />;
}

export function EmployeeAssignmentModalScreen() {
  return (
    <>
      <CustomPolicyDetailContent />
      <div className="vanta-modal-backdrop" />
      <section className="vanta-policy-step-modal employee">
        <header>
          <h2>Employee assignment</h2>
          <button type="button" aria-label="Close">
            <X size={34} />
          </button>
        </header>
        <div className="vanta-policy-step-body">
          <p>All employees in the following groups will be asked to accept the policy in the upcoming employee reminders email.</p>
          <p>
            You can configure the employee reminders email in <a>Settings &gt; Notifications</a>.
          </p>
          <div className="vanta-policy-groups-box">
            <ul>
              {['Contractors', 'Test (BAA)', 'Test 2', 'Test Group - US employees', 'New Group - Reset Onboarding', 'test GRSee', 'Design', 'SAles', 'Tman Group', "Dana Carollo's Group", 'Security Renewals', 'Testing', 'test employee task link', 'Interns', 'Policies Only'].map((group) => (
                <li key={group}>{group}</li>
              ))}
            </ul>
          </div>
        </div>
        <footer>
          <strong>Step 2 of 2</strong>
          <span>
            <GhostButton>Back</GhostButton>
            <button className="vanta-create-risk-button" type="button">Approve</button>
          </span>
        </footer>
      </section>
    </>
  );
}

const policyControlRows = [
  ['AWS FTR', 'IAM-005', 'Use IAM roles and its temporary security credentials to provide...', 'Unassigned'],
  ['DORA', 'Article 19', 'Article 19.5 - Outsourcing of Reporting Obligations', 'Unassigned'],
  ['DORA', 'Article 26', 'Article 26.3 - ICT Third-Party Participation in TLPT', 'Unassigned'],
  ['DORA', 'Article 26', 'Article 26.4 - Safeguards in Pooled TLPT Arrangements', 'Unassigned'],
  ['DORA', 'Article 26', 'Article 26.5 - Risk Management in TLPT Execution', 'Unassigned'],
] as const;

function ThirdPartyPolicyContent() {
  return (
    <section className="vanta-policy-detail-page">
      <div className="vanta-page-action-row">
        <div>
          <div className="vanta-breadcrumb">Policies</div>
          <h1>Third-Party Management Policy <FlatPill tone="green" icon={<CheckCircle2 size={15} />}>OK</FlatPill></h1>
          <p>To ensure protection of the organization's data and assets that are shared with, accessible to, or managed by suppliers, including external parties or third-party organizations such as service providers, vendors, and customers, and to maintain an agreed level of information security and service delivery in line with supplier agreements.</p>
          <div className="vanta-test-meta"><span><FileText size={15} /> AWS FTR +12 more</span><span>Renew annually</span></div>
        </div>
        <div><GhostButton><Pencil size={16} /> Edit details</GhostButton><GhostButton><MoreHorizontal size={16} /></GhostButton></div>
      </div>
      <div className="vanta-tabs-flat policy-tabs">{['Policy versions', 'Controls (107)', 'Audits', 'Notes'].map((tab, index) => <button key={tab} className={index === 1 ? 'is-active highlighted' : ''} type="button">{tab}</button>)}</div>
      <GhostButton className="pink-outline add-control-highlight">Add control</GhostButton>
      <div className="vanta-modern-table vanta-policy-controls-table">
        <div className="vanta-modern-header"><span>Framework</span><span>Section Code</span><span>Control</span><span>Owner</span></div>
        {policyControlRows.map((row) => <div className="vanta-modern-row" key={`${row[0]}-${row[1]}-${row[2]}`}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
      </div>
    </section>
  );
}

export function AddControlsModalScreen({ mode = 'modal' }: { mode?: 'policy' | 'modal' }) {
  const body = (
    <SimpleVantaShell active="Compliance" child="Policies" dim={mode === 'modal'}>
      <ThirdPartyPolicyContent />
    </SimpleVantaShell>
  );
  if (mode === 'policy') return body;
  return (
    <>
      {body}
      <div className="vanta-modal-backdrop" />
      <section className="vanta-add-controls-modal">
        <header><h2>Add controls</h2><button type="button" aria-label="Close"><X size={26} /></button></header>
        <div className="vanta-add-controls-info"><Info size={22} /> Adding a control to this policy will automatically link it to the <a>Company has an approved Data Management Policy</a> test. Newly added controls can only be in a passing state after the policy is approved.</div>
        <div className="vanta-filter-bar add-controls"><div className="vanta-input-like"><Search size={18} /><span>Search controls</span></div><button type="button">Framework <ChevronDown size={16} /></button></div>
        <div className="vanta-add-controls-grid">
          <aside>{['Information deletion', 'Data masking', 'Data leakage prevention', 'Employees have unique accounts', 'Anti-malware technology utilized', 'User endpoint devices', 'Protection against malware', 'Firewall default disallows traffic', 'Board oversight briefings conducted'].map((item, index) => <button key={item} className={index === 5 ? 'is-active' : ''} type="button"><span>{item}</span>{[0, 1, 2, 5].includes(index) ? <FlatPill tone="green" icon={<Check size={14} />}>Added</FlatPill> : null}</button>)}</aside>
          <main>
            <h3>User endpoint devices</h3>
            <span className="vanta-pink-arrow remove" />
            <div className="vanta-remove-row"><PurpleButton>Remove</PurpleButton><GhostButton><ExternalLink size={20} /></GhostButton></div>
            <hr />
            <h4>Description</h4><p>Information stored on, processed by or accessible via user endpoint devices shall be protected.</p>
            <h4>Domain</h4><FlatPill>Endpoint Security</FlatPill>
            <h4>Frameworks</h4><FlatPill>ISO 27001:2022</FlatPill>
            <h4>Related sections</h4><FlatPill>A.8.1</FlatPill>
          </main>
        </div>
      </section>
    </>
  );
}

export function TestDeactivateMenuScreen() {
  return (
    <SimpleVantaShell active="Tests">
      <section className="vanta-test-deactivate-page">
        <div className="vanta-breadcrumb">Tests</div>
        <h1>Company has an approved Asset Management Policy</h1>
        <p>Verifies that an <a>Asset Management Policy</a> has been created and approved within Vanta.</p>
        <div className="vanta-test-meta"><span><span className="vanta-spinner" /> Unassigned</span><span><Glyph label="V" /> Vanta</span><span>Last refreshed 2 hours ago</span></div>
        <button className="vanta-menu-trigger highlighted" type="button"><MoreHorizontal size={22} /></button>
        <div className="vanta-test-overflow-menu">
          <button type="button"><Users size={16} /> Manage subscribers</button>
          <button className="highlighted" type="button"><Shield size={16} /> Deactivate</button>
          <button type="button"><Megaphone size={16} /> Submit feedback</button>
        </div>
        <div className="vanta-pink-arrow deactivate-arrow" />
        <div className="vanta-tabs-flat">{['Results', 'Source data', 'History', 'Tasks (0)', 'Controls (58)', 'Audits', 'Notes'].map((tab, index) => <button className={index === 0 ? 'is-active' : ''} key={tab} type="button">{tab}</button>)}</div>
        <section className="vanta-needs-card"><div><CircleAlert size={20} fill="#df4d5a" color="#fff" /> <strong>Needs attention</strong><span><GhostButton>Create task <ChevronDown size={15} /></GhostButton><PurpleButton>How to remediate <ExternalLink size={16} /></PurpleButton></span></div><p>You don't have an approved Asset Management Policy yet.</p></section>
      </section>
    </SimpleVantaShell>
  );
}

export function DeactivatedTestsScreen() {
  const rows = [
    ['Company has approved its policy: Test Custom', 'Policy', 'Automated test', 'Indefinitely', '-'],
    ['Personnel agree to company policy: Test for 60217 - 1', 'Policy', 'Automated test', 'Indefinitely', 'ISO 27001:2022'],
    ['Personnel agree to company policy: Test (Cam)', 'Policy', 'Automated test', 'Indefinitely', '-'],
    ['User accounts have MFA enabled (Vikram - Test Private App v3)', 'Human resources', 'Automated test', 'Indefinitely', 'FedRAMP Moderate Re...'],
    ['Medium vulnerabilities identified in code repositories are addressed...', 'Engineering', 'Automated test', 'Indefinitely', 'ISO 27001:2022'],
    ['Company has approved its policy: ToastyTestPolicyTitle', 'Policy', 'Automated test', 'Indefinitely', '-'],
  ] as const;
  return (
    <SimpleVantaShell active="Tests">
      <section className="vanta-deactivated-tests-page">
        <div className="vanta-page-action-row"><h1>Tests</h1><div><GhostButton><Plus size={16} /> Create custom test</GhostButton><GhostButton><Pencil size={16} /> Edit SLAs</GhostButton></div></div>
        <div className="vanta-tests-category-layout">
          <aside><h4>Category</h4>{['All', 'HR', 'IT', 'Policy', 'Engineering', 'Risks', 'Custom'].map((item) => <button key={item} type="button">{item}</button>)}<h4>Deactivated</h4><button className="is-active highlighted" type="button">All deactivated</button></aside>
          <main>
            <div className="vanta-filter-bar"><div className="vanta-input-like"><Search size={18} /><span>Search</span></div>{['Framework', 'Control', 'Integration', 'Category', 'Owner', 'Type'].map((label) => <button key={label} type="button">{label} <ChevronDown size={15} /></button>)}<div className="vanta-spacer" /><GhostButton><SlidersHorizontal size={18} /></GhostButton></div>
            <div className="vanta-modern-table vanta-deactivated-table">
              <div className="vanta-modern-header"><MiniCheckbox /><span>Name</span><span>Category</span><span>Owner</span><span>Type</span><span>Deactivated until</span><span>Frameworks</span></div>
              {rows.map(([name, category, type, until, framework], index) => <div className="vanta-modern-row" key={name}><MiniCheckbox /><strong>{index > 1 ? <Zap size={16} fill="#777" /> : null}{name}</strong><span>{category}</span><span>{index === 3 ? <span className="vanta-owner-bubble">JT</span> : <span className="vanta-spinner" />}</span><span>{type}</span><span>{until}</span><span>{framework === '-' ? '-' : <Tag>{framework}</Tag>}</span></div>)}
            </div>
          </main>
        </div>
      </section>
    </SimpleVantaShell>
  );
}

const riskRows = [
  ['AI cost benefit analysis is not completed thoroughly leading to AI being implemented in situations where other technologies would likely provide better outcomes.', 'Software development and acquisition', '+1'],
  ['AI model is not tested appropriately using TEVV criteria leading to unknown failure states, poor performance, and unvalidated/untrusted outputs being more common.', 'Software development and acquisition', '+2'],
  ['AI system change management and maintenance processes are not well documented, followed and enforced leading to increasingly opaque function over time and a loss of trust from users and support staff.', 'Software development and acquisition', '+2'],
  ['Appropriate contacts are not maintained resulting in delays in breach response and reporting.', 'Information security operations', ''],
  ['Appropriate contacts with interest groups are not maintained resulting in a lack of understanding of current threats.', 'Information security operations', ''],
  ['Assets are not identified and protected according to company requirements.', 'Asset management', ''],
  ['Background verification checks are not carried out on all candidates or are not proportional to the business requirements or the classification of the information to be accessed by the role resulting in increased risk of malicious insider threats.', 'People operations', ''],
] as const;

function RiskLibraryContent() {
  return (
    <section className="vanta-risk-library-page">
      <h1>Vanta risk library</h1>
      <p>Select the risks that apply to your business and track them on your risk register. For SOC 2, scenarios that consider fraud are required.</p>
      <div className="vanta-filter-bar"><div className="vanta-input-like"><Search size={18} /><span>Search</span></div><button type="button">Categories <ChevronDown size={15} /></button><button type="button">Register <ChevronDown size={15} /></button></div>
      <div className="vanta-modern-table vanta-risk-library-table">
        <div className="vanta-modern-header"><span>Scenario</span><span>Category</span><span className="vanta-pink-column">Add to register</span></div>
        {riskRows.map(([scenario, category, more]) => <div className="vanta-modern-row" key={scenario}><strong>{scenario}</strong><span><FlatPill>{category}</FlatPill>{more ? <FlatPill>{more}</FlatPill> : null}</span><span className="vanta-pink-column"><GhostButton>Add</GhostButton></span></div>)}
      </div>
    </section>
  );
}

export function RiskLibraryScreen() {
  return (
    <SimpleVantaShell active="Risk" child="Risk library">
      <RiskLibraryContent />
    </SimpleVantaShell>
  );
}

export function AddRiskScenarioModalScreen() {
  return (
    <>
      <SimpleVantaShell active="Risk" child="Risk register" dim>
        <RiskLibraryContent />
      </SimpleVantaShell>
      <div className="vanta-modal-backdrop" />
      <section className="vanta-risk-scenario-modal">
        <header><h2>Add risk scenario</h2><button type="button" aria-label="Close"><X size={32} /></button></header>
        <div className="vanta-risk-scenario-body">
          <label className="vanta-sensitive-check"><MiniCheckbox /> Is sensitive <Info size={20} /></label>
          {['Likelihood', 'Impact'].map((label) => (
            <section key={label} className="vanta-score-panel">
              <h3>{label}</h3>
              <p>{label === 'Likelihood' ? 'Select a score that represents how likely it is that an intentional or accidental incident will take place based on this risk.' : "Select a score that represents how much the exploitation of this risk would harm your organization's ability to continue to operate."}</p>
              <div className="vanta-score-scale"><div /><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><strong>No score</strong></div>
            </section>
          ))}
          <label className="vanta-notes-label">Notes <Info size={19} /> <span>Optional</span><textarea /></label>
        </div>
        <footer><GhostButton>Cancel</GhostButton><button type="button" className="vanta-create-risk-button">Create risk scenario</button></footer>
      </section>
    </>
  );
}

const usersRows = [
  ['A.J. Forkner', 'Amalgamated Widgets', 'aj.forkner@vantapartner.io', 'Admin'],
  ['A.J. Forkner', 'Tiger Labs App', 'aj.forkner@vantapartner.io', 'Admin'],
  ['A.J. Forkner', 'VelocirAPPtor', 'aj.forkner@vantapartner.io', 'Employee'],
  ['Accounts Payable', 'Tiger Labs App', 'accounting@tigerlabs.app', 'Employee'],
  ['Ahmad El-Asmar', 'Tiger Labs App', 'ahmad.elasmar@vanta.com', 'Employees'],
  ['Ahmad El-Asmar', 'VelocirAPPtor', 'ahmad.elasmar@vanta.com', 'Admin'],
  ['AJ Forkner', 'Tiger Labs App', 'aj.forkner@vanta.com', 'Admin'],
  ['Alejandro Ocampo', 'Tiger Labs App', 'alejandro@vanta.com', 'Employee'],
  ['Alejandro Ocampo', 'Amalgamated Widgets', 'ale@vantapartner.io', 'Employee'],
] as const;

function UsersTable({ selected = false, faded = false }: { selected?: boolean; faded?: boolean }) {
  const rows = selected
    ? [
        ['abc testing', 'Acme Inc.', 'abc@test.com', 'Admin', true],
        ['Adam Lee', 'Acme Inc.', 'adam.lee@acme.com', 'Editor', false],
        ['Adam Lee', 'Acme Inc.', 'a.le@globex.com', 'Admin', false],
        ['Adam Lee', 'Factio LLC', 'asdlk@lee.com', 'Employee', true],
        ['Adam Lee', 'Globex LLC', 'a.le@globex.com', 'Editor', false],
        ['Admin Empsec', 'Acme Inc.', 'empsecdemo@vantaroo.com', 'Editor', false],
      ]
    : usersRows.map((row) => [...row, false]);

  return (
    <div className={cx('vanta-modern-table vanta-users-table', faded && 'is-faded')}>
      <div className="vanta-modern-header">
        <MiniCheckbox />
        <span>Name</span>
        <span>Workspace</span>
        <span>Email</span>
        <span>Role <Info size={13} /></span>
        <span />
      </div>
      {rows.map(([name, workspace, email, role, isChecked], index) => (
        <div className="vanta-modern-row" key={`${name}-${workspace}-${index}`}>
          <MiniCheckbox checked={Boolean(isChecked)} />
          <strong>{name}</strong>
          <span>
            <Glyph label={String(workspace)[0]} tone={String(workspace).includes('Tiger') ? 'orange' : String(workspace).includes('Veloc') ? 'green' : 'purple'} />
            {workspace}
          </span>
          <span>{email}</span>
          <GhostButton>
            {role} <ChevronDown size={15} />
          </GhostButton>
          <MoreHorizontal size={17} />
        </div>
      ))}
    </div>
  );
}

function UsersPageChrome({
  children,
  selected = false,
}: {
  children: ReactNode;
  selected?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <FlatShell active="Users" workspace="Workspace cons..." compactSidebar staging avatar="u">
      <section className="vanta-users-page">
        <div className="vanta-page-action-row">
          <div>
            <h1>Users</h1>
            <p>This page shows people internal to your organization who have access to Vanta and lets you manage their access to Workspaces.</p>
          </div>
          <GhostButton onClick={() => navigate('/vanta-clone/users/add')}>
            <Plus size={18} /> Add user
          </GhostButton>
        </div>
        <div className="vanta-filter-bar users">
          <div className="vanta-input-like">
            <Search size={18} />
            <span>Search people</span>
          </div>
          {selected ? (
            <>
              <span>2 selected</span>
              <button className="vanta-link-button" type="button">
                Deselect
              </button>
              <GhostButton>Link users</GhostButton>
              <span className="vanta-pink-arrow link-users" />
            </>
          ) : (
            <>
              <button type="button">
                Workspace <ChevronDown size={16} />
              </button>
              <button type="button">
                Role <ChevronDown size={16} />
              </button>
            </>
          )}
        </div>
        {children}
      </section>
    </FlatShell>
  );
}

export function UsersAccessScreen({ mode = 'default' }: { mode?: 'default' | 'add' | 'selected' | 'plain' }) {
  const accessCards: Array<{ label: string; letter: string; checked: boolean; tone: 'purple' | 'green' | 'black' | 'orange' }> = [
    { label: 'Amalgamated Widgets', letter: 'A', checked: false, tone: 'black' },
    { label: 'Tiger Labs App', letter: 'T', checked: true, tone: 'orange' },
    { label: 'VelocirAPPtor', letter: 'V', checked: false, tone: 'green' },
    { label: 'Vendor Guard', letter: 'G', checked: false, tone: 'black' },
    { label: 'Workspace console', letter: 'C', checked: false, tone: 'purple' },
  ];

  if (mode === 'selected') {
    return (
      <UsersPageChrome selected>
        <UsersTable selected />
      </UsersPageChrome>
    );
  }
  if (mode === 'plain') {
    return (
      <UsersPageChrome>
        <UsersTable />
      </UsersPageChrome>
    );
  }
  if (mode === 'add') {
    return (
      <UsersPageChrome>
        <UsersTable faded />
        <div className="vanta-modal-backdrop" />
        <section className="vanta-add-user-modal">
          <button className="vanta-modal-close" type="button" aria-label="Close">
            <X size={18} />
          </button>
          <h2>Add user</h2>
          <p>Add users who are not already in Vanta through an identity provider integration.</p>
          <h3>Access</h3>
          {accessCards.map(({ label, letter, checked, tone }, index) => (
            <div className={cx('vanta-access-card', checked && 'is-expanded')} key={label}>
              <div>
                <MiniCheckbox checked={checked} />
                <Glyph label={letter} tone={tone} />
                <strong>{label}</strong>
              </div>
              {index === 1 ? (
                <div className="vanta-access-role-row">
                  <span>Role</span>
                  <GhostButton>Admin <ChevronDown size={15} /></GhostButton>
                </div>
              ) : null}
            </div>
          ))}
          <footer>
            <GhostButton>Cancel</GhostButton>
            <PurpleButton>Save</PurpleButton>
          </footer>
        </section>
      </UsersPageChrome>
    );
  }
  return (
    <UsersPageChrome>
      <UsersTable />
    </UsersPageChrome>
  );
}
