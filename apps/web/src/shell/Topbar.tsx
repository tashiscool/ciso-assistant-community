import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Search, LogOut, Settings, SlidersHorizontal, User as UserIcon } from 'lucide-react';
import { ApiClient } from '../shared/api/client';
import { canUseHeaderIdentity, resetEdgeIdentity, useEdgeIdentity } from '../shared/session/identity';
import type { WorkspaceUser } from '../features/iam/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../lib/utils';
import type { ShellAccessProfile } from './shellAccess';

const client = new ApiClient();

type TopbarProps = {
  sessionReady: boolean;
  sessionSyncing: boolean;
  access: ShellAccessProfile;
  profileName?: string | null;
  profileEmail?: string | null;
};

/** Map route segments to human-readable breadcrumb labels. */
const ROUTE_LABELS: Record<string, string> = {
  '': 'Home',
  program: 'Program',
  'quick-start': 'Guided Setup',
  analytics: 'Analytics',
  search: 'Search',
  setup: 'Setup',
  workspace: 'Workspace',
  me: 'My Access',
  domains: 'Domains',
  team: 'Team',
  access: 'Permissions',
  libraries: 'Libraries',
  frameworks: 'Frameworks',
  assessments: 'Assessments',
  'risk-scenarios': 'Risk Scenarios',
  'third-party': 'Third Party',
  privacy: 'Privacy',
  resilience: 'Resilience',
  reports: 'Reports',
  chat: 'Chat',
  imports: 'Imports',
  portal: 'External Portal',
  'advanced-risk': 'Advanced Risk',
  ebios: 'EBIOS RM',
  quantitative: 'Quantitative',
  conmon: 'ConMon',
  profiles: 'Profiles',
  executions: 'Runs',
  evidence: 'Evidence',
  'evidence-management': 'Evidence Workspace',
  sources: 'Sources',
  jobs: 'Jobs',
  assurance: 'Assurance',
  tracker: 'Tracker',
  packages: 'Packages',
  reviews: 'Reviews',
  'agent-runs': 'Agent Runs',
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Home', href: '/' }];
  }

  return segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));
}

function getInitials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Topbar({ sessionReady, sessionSyncing, access, profileName, profileEmail }: TopbarProps) {
  const { identity, authMode, setIdentity, setAuthMode } = useEdgeIdentity();
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState(identity.tenantId);
  const [userId, setUserId] = useState(identity.userId);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasNotification] = useState(true);
  const [previewToolsOpen, setPreviewToolsOpen] = useState(false);

  const breadcrumbs = useBreadcrumbs();
  const showIdentityControls = access.canViewAdminNavigation && (canUseHeaderIdentity() || authMode === 'headers');

  useEffect(() => {
    setTenantId(identity.tenantId);
    setUserId(identity.userId);
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    void (async () => {
      if (!sessionReady || authMode === 'anonymous' || !showIdentityControls) {
        setUsers([]);
        setLoadError(null);
        return;
      }

      try {
        setLoadError(null);
        const response = await client.get<{ data: WorkspaceUser[] }>('/iam/users');
        setUsers(response.data);
      } catch (err) {
        setUsers([]);
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();
  }, [authMode, identity.tenantId, identity.userId, sessionReady, showIdentityControls]);

  const currentUser = users.find((u) => u.id === userId);
  const displayName = profileName?.trim() || currentUser?.displayName || userId || 'User';
  const displayEmail = profileEmail?.trim() || currentUser?.email || '';
  const initials = getInitials(displayName);
  const settingsTarget = access.canViewInternalTools
    ? '/settings'
    : access.canViewAdminNavigation
      ? '/setup/general'
      : null;
  const settingsLabel = access.canViewInternalTools ? 'Platform settings' : 'Workspace settings';

  function applyIdentityChange(nextTenantId: string, nextUserId: string) {
    if (nextTenantId === identity.tenantId && nextUserId === identity.userId) {
      return;
    }

    if (canUseHeaderIdentity()) {
      setAuthMode('headers');
    }
    setIdentity({ tenantId: nextTenantId, userId: nextUserId });
  }

  function handleApplyIdentity() {
    applyIdentityChange(tenantId, userId);
  }

  function handleResetPreviewIdentity() {
    const nextIdentity = resetEdgeIdentity('headers');
    setIdentity(nextIdentity);
    setTenantId(nextIdentity.tenantId);
    setUserId(nextIdentity.userId);
    setPreviewToolsOpen(false);
  }

  async function handleSignOut() {
    try {
      await fetch('/_api/core/session', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {}

    const nextIdentity = resetEdgeIdentity('anonymous');
    setIdentity(nextIdentity);
    setUsers([]);
    setLoadError(null);
    navigate('/login');
  }

  return (
    <header className="glass-panel sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-white/10 px-5 gap-4">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
            <span
              className={cn(
                'truncate text-sm',
                i === breadcrumbs.length - 1
                  ? 'font-medium text-white'
                  : 'text-slate-500',
              )}
            >
              {crumb.label}
            </span>
          </div>
        ))}
      </div>

      {/* Right: identity controls + search + notifications + user menu */}
      <div className="flex items-center gap-2 shrink-0">
        {showIdentityControls ? (
          <Dialog open={previewToolsOpen} onOpenChange={setPreviewToolsOpen}>
            <DialogTrigger asChild>
              <Button className="hidden lg:inline-flex" size="sm" variant="secondary">
                <SlidersHorizontal className="h-4 w-4" />
                Preview tools
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Loopback preview tools</DialogTitle>
                <DialogDescription>
                  These controls are only for local preview and review. They stay out of the main shell so the product chrome remains focused on normal users.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current preview identity</div>
                  <div className="mt-2 text-sm font-medium text-white">{displayName}</div>
                  <div className="mt-1 text-xs text-cyan-200">{displayEmail || 'Workspace account'}</div>
                  <div className="mt-3 text-xs text-slate-500">
                    {tenantId} / {userId}
                  </div>
                </div>
                <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.04] px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">Why this is hidden</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    Tenant switching and identity overrides are preview-only mechanics. Regular users should never have to understand them to use Regovise.
                  </div>
                </div>
              </div>

              {loadError ? <div className="notice-warning">{loadError}</div> : null}

              <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Tenant</span>
                  <Input
                    className="h-10 text-sm"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyIdentity()}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">User</span>
                  {users.length > 0 ? (
                    <Select value={userId} onValueChange={(val) => setUserId(val)}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.displayName} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-10 text-sm"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyIdentity()}
                    />
                  )}
                </label>
              </div>

              <DialogFooter className="gap-2">
                <Button onClick={handleResetPreviewIdentity} size="sm" type="button" variant="ghost">
                  Reset to demo identity
                </Button>
                <Button
                  onClick={() => {
                    handleApplyIdentity();
                    setPreviewToolsOpen(false);
                  }}
                  size="sm"
                  type="button"
                  variant="default"
                >
                  Switch preview identity
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        {sessionSyncing ? (
          <div className="hidden lg:flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Syncing session
          </div>
        ) : null}

        {/* Search trigger */}
        {access.canUseSearch ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-400 hover:text-white"
            aria-label="Search (Cmd+K)"
            onClick={() => navigate('/search')}
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : null}

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-slate-400 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {hasNotification && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.8)]" />
          )}
        </Button>

        {/* User avatar menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-2xl px-2 py-1.5 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">{initials || 'U'}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-white leading-none">{displayName}</div>
                <div className="mt-0.5 text-[10px] text-slate-500 leading-none truncate max-w-[140px]">
                  {displayEmail || 'Workspace account'}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex-col items-start gap-0.5 cursor-default focus:bg-transparent">
              <span className="text-xs text-slate-400">Signed in as</span>
              <span className="text-xs text-cyan-300 truncate w-full">{displayName}</span>
            </DropdownMenuItem>
            {displayEmail ? (
              <DropdownMenuItem className="flex-col items-start gap-0.5 cursor-default focus:bg-transparent">
                <span className="text-xs text-slate-400">Email</span>
                <span className="text-xs text-cyan-300 truncate w-full">{displayEmail}</span>
              </DropdownMenuItem>
            ) : null}
            {showIdentityControls ? (
              <DropdownMenuItem className="flex-col items-start gap-0.5 cursor-default focus:bg-transparent">
                <span className="text-xs text-slate-400">Debug identity</span>
                <span className="font-mono text-xs text-cyan-300 truncate w-full">
                  {tenantId} / {userId}
                </span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/workspace/me')}>
              <UserIcon className="h-4 w-4 text-slate-400" />
              Profile
            </DropdownMenuItem>
            {settingsTarget ? (
              <DropdownMenuItem onSelect={() => navigate(settingsTarget)}>
                <Settings className="h-4 w-4 text-slate-400" />
                {settingsLabel}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10"
              onSelect={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
