import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  Clock3,
  Database,
  FileText,
  GitBranch,
  Layers3,
  Network,
  Server,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { Badge, Button, EmptyState, Tabs } from './primitives';
import type { SystemViewProps } from './types';
import './system.css';

const systemTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'boundary', label: 'Boundary' },
  { id: 'assets', label: 'Assets' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'team', label: 'Team' },
];

type LocalDetail = { kind: 'asset' | 'dependency'; index: number } | null;
type AttentionItem = {
  id: string;
  kind: 'evidence' | 'remediation' | 'change' | 'control';
  title: string;
  description: string;
  date: string;
  action: string;
  onAction: () => void;
};

function recentDate(values: string[]) {
  return [...values].sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? '';
}

function displayDate(value: string) {
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

export function SystemView({ system, evidence, work, controls, onNavigate, onOpenArea, onReviewEvidence }: SystemViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [localDetail, setLocalDetail] = useState<LocalDetail>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    setActiveTab('overview');
    setLocalDetail(null);
    setShowAllHistory(false);
  }, [system.id]);

  const systemWork = useMemo(() => work.filter((item) => item.systemId === system.id), [work, system.id]);
  const pendingEvidence = useMemo(
    () => evidence.filter((item) => item.systemId === system.id && item.status !== 'Accepted'),
    [evidence, system.id],
  );
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];
    if (pendingEvidence.length > 0) {
      const affectedControls = new Set(pendingEvidence.flatMap((item) => item.controlIds));
      const needsChanges = pendingEvidence.some((item) => item.status === 'Changes requested');
      items.push({
        id: 'pending-evidence',
        kind: 'evidence',
        title: affectedControls.size > 0
          ? `Evidence ${needsChanges ? 'needs changes' : 'changed'} for ${affectedControls.size} control${affectedControls.size === 1 ? '' : 's'}`
          : `${pendingEvidence.length} evidence ${pendingEvidence.length === 1 ? 'record needs' : 'records need'} review`,
        description: needsChanges ? 'Follow up on requested evidence changes' : 'Review updated evidence',
        date: recentDate(pendingEvidence.map((item) => item.collectedAt)),
        action: 'Review',
        onAction: () => onReviewEvidence(pendingEvidence[0].id),
      });
    }
    for (const item of systemWork) {
      if (item.kind === 'evidence') continue;
      if (['completed', 'closed', 'resolved', 'approved'].includes(item.status.toLowerCase())) continue;
      items.push({
        id: item.id,
        kind: item.kind,
        title: item.title,
        description: item.kind === 'remediation' ? `Owner: ${item.owner}` : item.description,
        date: item.date,
        action: item.kind === 'remediation' ? 'View' : 'Review',
        onAction: () => {
          if (item.kind === 'remediation') onOpenArea('risk');
          else if (item.controlId && controls.some((control) => control.id === item.controlId)) onNavigate('controls', item.controlId);
          else onNavigate('work');
        },
      });
    }
    return items;
  }, [pendingEvidence, systemWork, controls, onNavigate, onOpenArea, onReviewEvidence]);

  const hasDecision = Boolean(system.decisionDate);
  const reviewLabel = system.caseStage === 'Preparing review package' ? 'In preparation' : system.caseStage;
  const selectedAsset = localDetail?.kind === 'asset' ? system.assets[localDetail.index] : null;
  const selectedDependency = localDetail?.kind === 'dependency' ? system.dependencies[localDetail.index] : null;

  function changeTab(id: string) {
    setActiveTab(id);
    setLocalDetail(null);
    setShowAllHistory(false);
  }

  function renderHistory(all = false) {
    const activities = all ? system.activities : system.activities.slice(0, 2);
    if (activities.length === 0) return <EmptyState title="No operating history yet" description="Activity for this system will appear here." />;
    return (
      <div className="aw-system-table-scroll">
        <table className="aw-system-table aw-system-history-table">
          <caption className="aw-system-sr-only">{all ? 'Complete' : 'Recent'} operating history for {system.name}</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Details</th><th scope="col">Actor</th></tr></thead>
          <tbody>{activities.map((activity, index) => (
            <tr key={`${activity.date}-${activity.event}-${index}`}>
              <td className="aw-system-date">{activity.date}</td>
              <td><span className="aw-system-history-event">{index === 0 ? <FileText size={17} aria-hidden="true" /> : <GitBranch size={17} aria-hidden="true" />}{activity.event}</span></td>
              <td className="aw-muted">{activity.detail}</td>
              <td className="aw-muted">{activity.actor}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="aw-system-view" aria-labelledby="aw-system-title">
      <div className="aw-system-page-meta"><div className="aw-system-breadcrumb" aria-label="Breadcrumb"><span>Systems</span><ChevronRight size={15} aria-hidden="true" /><span>{system.name}</span></div><time dateTime="2026-10-11">Sunday, October 11, 2026</time></div>
      <header className="aw-system-heading">
        <span className="aw-system-heading-icon"><Database size={31} strokeWidth={1.8} aria-hidden="true" /></span>
        <div><h1 id="aw-system-title" className="aw-title">{system.name}</h1><p>System owner: {system.owner}<span className="aw-system-owner-divider"> · </span>ISSO: {system.isso}</p></div>
      </header>

      <div className="aw-system-statuses">
        <div className={`aw-system-status aw-system-decision${hasDecision ? '' : ' aw-system-decision--empty'}`}>
          <FileText size={27} strokeWidth={1.8} aria-hidden="true" />
          <div><strong>{hasDecision ? 'Agency authorization on file' : 'No decision recorded'}</strong>
            <button type="button" className="aw-link aw-system-inline-action" onClick={() => onOpenArea('authorization')}>{hasDecision ? 'View signed decision' : 'Open authorization case'}<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="aw-system-status aw-system-review">
          <CircleDashed size={27} aria-hidden="true" />
          <div><strong>Current review: {reviewLabel}</strong><p>Assembling evidence and updates for the next review.</p></div>
        </div>
      </div>

      <div className="aw-system-tabs"><Tabs items={systemTabs} active={activeTab} onChange={changeTab} label="System views" /></div>

      {activeTab === 'overview' && <>
        <div className="aw-system-overview-grid">
          <section className="aw-panel aw-system-attention" aria-labelledby="aw-system-attention-title">
            <header className="aw-system-panel-heading">
              <div className="aw-system-panel-title"><FileText size={22} aria-hidden="true" /><div><h2 id="aw-system-attention-title">What needs attention</h2><p className="aw-muted">Key items to address for the upcoming review.</p></div></div>
              <Button variant="primary" onClick={() => onNavigate('work')}><ArrowUpRight size={18} aria-hidden="true" />Open review work</Button>
            </header>
            {attentionItems.length > 0 ? <div className="aw-system-table-scroll">
              <table className="aw-system-table aw-system-attention-table">
                <caption className="aw-system-sr-only">Work requiring attention for {system.name}</caption>
                <thead><tr><th scope="col">Item</th><th scope="col">Details</th><th scope="col">Date</th><th scope="col">Action</th></tr></thead>
                <tbody>{attentionItems.map((item) => <tr key={item.id}>
                  <td><span className={`aw-system-attention-item aw-system-attention-item--${item.kind}`}>{item.kind === 'remediation' ? <TriangleAlert size={21} aria-hidden="true" /> : item.kind === 'change' ? <UserRound size={21} aria-hidden="true" /> : <FileText size={21} aria-hidden="true" />}<span>{item.title}</span></span></td>
                  <td className="aw-muted">{item.description}</td><td className="aw-system-date aw-muted">{displayDate(item.date)}</td>
                  <td><button type="button" className="aw-link aw-system-row-action" onClick={item.onAction} aria-label={`${item.action}: ${item.title}`}>{item.action}<ArrowRight size={17} aria-hidden="true" /></button></td>
                </tr>)}</tbody>
              </table>
            </div> : <EmptyState title="No review work listed" description="Open Controls to inspect implementation and evidence requirements for this system." />}
          </section>

          <aside className="aw-panel aw-system-case" aria-labelledby="aw-system-case-title">
            <div className="aw-system-panel-title"><FileText size={23} aria-hidden="true" /><h2 id="aw-system-case-title">Authorization case</h2></div>
            <h3>{system.profile}</h3>
            <dl className="aw-system-case-facts">
              <div><dt>Stage</dt><dd><CircleDashed size={17} aria-hidden="true" />{system.caseStage}</dd></div>
              <div><dt>Decision record</dt><dd><FileText size={17} aria-hidden="true" />{hasDecision ? 'On file' : 'Not recorded'}</dd></div>
              <div><dt>Next scheduled review</dt><dd><CalendarDays size={17} aria-hidden="true" />{system.nextReview || 'Not scheduled'}</dd></div>
              <div><dt>Items awaiting attention</dt><dd><Layers3 size={17} aria-hidden="true" />{attentionItems.length}</dd></div>
            </dl>
            <button type="button" className="aw-link aw-system-inline-action" onClick={() => onOpenArea('authorization')}>Open case<ArrowRight size={18} aria-hidden="true" /></button>
          </aside>
        </div>

        <section className="aw-panel aw-system-history" aria-labelledby="aw-system-history-title">
          <header className="aw-system-panel-heading">
            <div className="aw-system-panel-title"><Clock3 size={23} aria-hidden="true" /><div><h2 id="aw-system-history-title">Operating history</h2><p className="aw-muted">Recent activity for this system.</p></div></div>
            <button type="button" className="aw-link aw-system-inline-action" onClick={() => setShowAllHistory(!showAllHistory)} aria-expanded={showAllHistory} aria-controls="aw-system-all-history">{showAllHistory ? 'Show recent activity' : 'View all activity'}<ArrowRight size={17} aria-hidden="true" /></button>
          </header>
          {renderHistory()}
        </section>
        {showAllHistory && <section id="aw-system-all-history" className="aw-panel aw-system-history aw-system-detail" aria-labelledby="aw-system-all-history-title">
          <header className="aw-system-panel-heading"><div className="aw-system-panel-title"><Clock3 size={22} aria-hidden="true" /><h2 id="aw-system-all-history-title">All operating activity</h2></div><Button variant="ghost" onClick={() => setShowAllHistory(false)} aria-label="Close full operating history"><X size={18} aria-hidden="true" />Close</Button></header>
          {renderHistory(true)}
        </section>}
      </>}

      {activeTab === 'boundary' && <section className="aw-panel aw-system-tab-panel" aria-labelledby="aw-system-boundary-title">
        <header className="aw-system-panel-heading"><div className="aw-system-panel-title"><ShieldCheck size={23} aria-hidden="true" /><div><h2 id="aw-system-boundary-title">System boundary</h2><p className="aw-muted">Scope and ownership for {system.name}.</p></div></div><Button variant="secondary" onClick={() => onNavigate('work')}>Review boundary work<ArrowRight size={17} aria-hidden="true" /></Button></header>
        <div className="aw-system-boundary-content"><h3>System purpose</h3><p>{system.description}</p><h3>Boundary</h3><p>{system.boundary}</p>
          <dl className="aw-system-boundary-facts"><div><dt>System owner</dt><dd>{system.owner}</dd></div><div><dt>ISSO</dt><dd>{system.isso}</dd></div><div><dt>Authorization profile</dt><dd>{system.profile}</dd></div></dl>
        </div>
      </section>}

      {activeTab === 'assets' && <section className="aw-panel aw-system-tab-panel" aria-labelledby="aw-system-assets-title">
        <header className="aw-system-panel-heading"><div className="aw-system-panel-title"><Server size={23} aria-hidden="true" /><div><h2 id="aw-system-assets-title">Assets &amp; components</h2><p className="aw-muted">Inventory within {system.name}.</p></div></div><Badge tone="purple">{system.assets.length} {system.assets.length === 1 ? 'asset' : 'assets'}</Badge></header>
        {system.assets.length > 0 ? <div className="aw-system-table-scroll"><table className="aw-system-table aw-system-register-table"><caption className="aw-system-sr-only">Assets and components for {system.name}</caption><thead><tr><th scope="col">Asset</th><th scope="col">Type</th><th scope="col">Owner</th><th scope="col">Details</th></tr></thead><tbody>{system.assets.map((asset, index) => <tr key={`${asset.name}-${index}`}><td><span className="aw-system-register-name"><Server size={18} aria-hidden="true" />{asset.name}</span></td><td className="aw-muted">{asset.type}</td><td>{asset.owner}</td><td><button type="button" className="aw-link aw-system-row-action" onClick={() => setLocalDetail({ kind: 'asset', index })} aria-label={`View ${asset.name} asset`}>View<ArrowRight size={17} aria-hidden="true" /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No assets listed" description="There are no asset records for this system." />}
      </section>}

      {activeTab === 'dependencies' && <section className="aw-panel aw-system-tab-panel" aria-labelledby="aw-system-dependencies-title">
        <header className="aw-system-panel-heading"><div className="aw-system-panel-title"><Network size={23} aria-hidden="true" /><div><h2 id="aw-system-dependencies-title">Dependencies</h2><p className="aw-muted">Services and shared responsibilities for {system.name}.</p></div></div></header>
        {system.dependencies.length > 0 ? <div className="aw-system-table-scroll"><table className="aw-system-table aw-system-register-table"><caption className="aw-system-sr-only">Dependencies for {system.name}</caption><thead><tr><th scope="col">Service</th><th scope="col">Responsibility</th><th scope="col">Status</th><th scope="col">Details</th></tr></thead><tbody>{system.dependencies.map((dependency, index) => <tr key={`${dependency.name}-${index}`}><td><span className="aw-system-register-name"><Network size={18} aria-hidden="true" />{dependency.name}</span></td><td className="aw-muted">{dependency.responsibility}</td><td><Badge tone={/review|pending/i.test(dependency.status) ? 'purple' : /approved|accepted|current/i.test(dependency.status) ? 'success' : 'neutral'}>{dependency.status}</Badge></td><td><button type="button" className="aw-link aw-system-row-action" onClick={() => setLocalDetail({ kind: 'dependency', index })} aria-label={`View ${dependency.name} dependency`}>View<ArrowRight size={17} aria-hidden="true" /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No dependencies listed" description="There are no dependency records for this system." />}
      </section>}

      {activeTab === 'team' && <section className="aw-panel aw-system-tab-panel" aria-labelledby="aw-system-team-title">
        <header className="aw-system-panel-heading"><div className="aw-system-panel-title"><UsersRound size={23} aria-hidden="true" /><div><h2 id="aw-system-team-title">System team</h2><p className="aw-muted">People responsible for {system.name}.</p></div></div></header>
        {system.team.length > 0 ? <div className="aw-system-table-scroll"><table className="aw-system-table aw-system-team-table"><caption className="aw-system-sr-only">Team members for {system.name}</caption><thead><tr><th scope="col">Name</th><th scope="col">Role</th></tr></thead><tbody>{system.team.map((member, index) => <tr key={`${member.name}-${member.role}-${index}`}><td><span className="aw-system-register-name"><span className="aw-system-avatar" aria-hidden="true">{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>{member.name}</span></td><td className="aw-muted">{member.role}</td></tr>)}</tbody></table></div> : <EmptyState title="No team members listed" description="There are no assigned team records for this system." />}
      </section>}

      {(selectedAsset || selectedDependency) && <section className="aw-panel aw-system-detail" aria-labelledby="aw-system-detail-title">
        <header className="aw-system-panel-heading"><div className="aw-system-panel-title">{selectedAsset ? <Server size={23} aria-hidden="true" /> : <Network size={23} aria-hidden="true" />}<h2 id="aw-system-detail-title">{selectedAsset?.name ?? selectedDependency?.name}</h2></div><Button variant="ghost" onClick={() => setLocalDetail(null)} aria-label="Close record details"><X size={18} aria-hidden="true" />Close</Button></header>
        <dl className="aw-system-detail-facts"><div><dt>System</dt><dd>{system.name}</dd></div>{selectedAsset ? <><div><dt>Type</dt><dd>{selectedAsset.type}</dd></div><div><dt>Owner</dt><dd>{selectedAsset.owner}</dd></div><div><dt>Boundary</dt><dd>{system.boundary}</dd></div></> : <><div><dt>Responsibility</dt><dd>{selectedDependency?.responsibility}</dd></div><div><dt>Status</dt><dd>{selectedDependency?.status}</dd></div></>}</dl>
      </section>}
    </section>
  );
}
