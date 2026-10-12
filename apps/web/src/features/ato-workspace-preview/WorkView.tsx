import { useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, ExternalLink, FileText, Inbox, Search, TriangleAlert, X } from 'lucide-react';
import { Badge, Button, EmptyState, Tabs } from './primitives';
import type { WorkItem, WorkViewProps } from './types';
import './work.css';

type WorkTab = 'assigned' | 'review';
type WorkSort = 'assigned' | 'oldest' | 'newest';

function dateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function WorkIcon({ kind }: { kind: WorkItem['kind'] }) {
  return kind === 'remediation' ? <TriangleAlert aria-hidden="true" /> : <FileText aria-hidden="true" />;
}

export function WorkView({ system, evidence, work, controls, selectedId, onSelect, onNavigate, onOpenArea, onReviewEvidence }: WorkViewProps) {
  const [tab, setTab] = useState<WorkTab>('assigned');
  const [sort, setSort] = useState<WorkSort>('assigned');
  const [query, setQuery] = useState('');
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentWork = useMemo(() => work.map((item) => {
    const linkedEvidence = item.evidenceId ? evidence.find((record) => record.id === item.evidenceId) : null;
    if (!linkedEvidence) return item;
    return {
      ...item,
      status: linkedEvidence.status,
      tone: linkedEvidence.status === 'Accepted' ? 'success' as const : linkedEvidence.status === 'Changes requested' ? 'warning' as const : 'purple' as const,
    };
  }), [evidence, work]);
  const pendingWork = currentWork.filter((item) => !['Accepted', 'Completed', 'Closed'].includes(item.status));
  const reviewWork = pendingWork.filter((item) => item.kind === 'evidence' || item.status.toLowerCase().includes('review'));
  const pendingEvidenceCount = evidence.filter((record) => record.status !== 'Accepted').length;
  const visibleWork = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = currentWork.filter((item) => {
      if (['Accepted', 'Completed', 'Closed'].includes(item.status)) return false;
      if (tab === 'review' && item.kind !== 'evidence' && !item.status.toLowerCase().includes('review')) return false;
      return !search || [item.title, item.description, item.reference, item.category, item.owner, item.ownerRole, item.status, system.name].join(' ').toLowerCase().includes(search);
    });
    if (sort !== 'assigned') {
      filtered.sort((left, right) => (sort === 'oldest' ? 1 : -1) * (dateValue(left.date) - dateValue(right.date)));
    }
    return filtered;
  }, [currentWork, query, sort, system.name, tab]);
  const selectedItem = currentWork.find((item) => item.id === selectedId) ?? null;
  const selectedEvidence = selectedItem?.evidenceId ? evidence.find((record) => record.id === selectedItem.evidenceId) ?? null : null;
  const selectedControl = controls.find((control) => control.id === selectedItem?.controlId || selectedEvidence?.controlIds.includes(control.id));
  const firstName = system.isso.split(' ')[0] || 'Jordan';

  function selectWork(id: string) {
    onSelect(id);
    if (window.matchMedia('(max-width: 760px)').matches) {
      window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  }

  function showReviewWork() {
    setTab('review');
    setQuery('');
    const nextItem = reviewWork.find((item) => item.kind === 'evidence') ?? reviewWork[0];
    onSelect(nextItem?.id ?? null);
    listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function runSelectedAction() {
    if (!selectedItem) return;
    if (selectedItem.kind === 'evidence' && selectedItem.evidenceId) onReviewEvidence(selectedItem.evidenceId);
    else if (selectedItem.kind === 'control' && selectedItem.controlId) onNavigate('controls', selectedItem.controlId);
    else onOpenArea('risk');
  }

  const reviewNotes = selectedEvidence?.reviewNote || (selectedEvidence?.id === 'account-inventory' && selectedEvidence.status !== 'Accepted'
    ? 'Human review required. Confirm all privileged accounts are included and inactive accounts are removed.'
    : selectedItem?.description);

  return (
    <div className={`aw-work-view${selectedItem ? '' : ' aw-work-view--no-detail'}`}>
      <section className="aw-work-main" aria-labelledby="aw-work-heading">
        <header className="aw-work-heading">
          <p className="aw-work-date aw-muted">Sunday, October 11, 2026</p>
          <h1 className="aw-title" id="aw-work-heading">Good morning, {firstName}</h1>
          <p className="aw-work-intro aw-muted">Review the work that can delay {system.name} authorization.</p>
        </header>

        <div className="aw-work-toolbar" ref={listRef}>
          <Tabs
            label="My work views"
            active={tab}
            onChange={(next) => setTab(next as WorkTab)}
            items={[
              { id: 'assigned', label: `Assigned to me (${pendingWork.length})` },
              { id: 'review', label: `Needs review (${reviewWork.length})` },
            ]}
          />
          <label className="aw-work-sort">
            <span className="aw-muted">Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as WorkSort)} aria-label="Sort work items">
              <option value="assigned">Assigned order</option>
              <option value="oldest">Due date (oldest)</option>
              <option value="newest">Due date (newest)</option>
            </select>
          </label>
        </div>

        <div className="aw-work-filter">
          <label className="aw-work-search">
            <Search aria-hidden="true" />
            <input aria-label="Filter work items" type="search" placeholder="Filter work items" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {query ? <button type="button" className="aw-link" onClick={() => setQuery('')}>Clear filter</button> : null}
        </div>

        {visibleWork.length ? (
          <div className="aw-work-table-scroll">
            <table className="aw-work-table" aria-label={tab === 'assigned' ? 'Assigned work items' : 'Work items needing review'}>
              <thead>
                <tr><th scope="col">Work item</th><th scope="col">System</th><th scope="col">Owner</th><th scope="col">Date / status</th><th scope="col"><span className="aw-work-visually-hidden">Open details</span></th></tr>
              </thead>
              <tbody>
                {visibleWork.map((item) => (
                  <tr key={item.id} className={item.id === selectedId ? 'aw-work-row aw-work-row--selected' : 'aw-work-row'} onClick={() => selectWork(item.id)}>
                    <td>
                      <button type="button" className="aw-work-item-button" aria-pressed={item.id === selectedId} onClick={(event) => { event.stopPropagation(); selectWork(item.id); }}>
                        <span className={`aw-work-item-icon aw-work-item-icon--${item.tone}`}><WorkIcon kind={item.kind} /></span>
                        <span className="aw-work-item-copy">
                          <span className="aw-work-item-title">{item.title}</span>
                          <span className="aw-work-item-description aw-muted">{item.description}</span>
                          <span className="aw-work-item-tags"><Badge>{item.reference}</Badge><Badge tone="neutral">{item.category}</Badge></span>
                        </span>
                      </button>
                    </td>
                    <td><span className="aw-work-mobile-label">System</span>{system.name}</td>
                    <td><span className="aw-work-mobile-label">Owner</span><span className="aw-work-owner">{item.owner}</span><span className="aw-work-owner-role aw-muted">{item.ownerRole}</span></td>
                    <td><span className="aw-work-mobile-label">Date / status</span><span className="aw-work-item-date aw-muted">{item.dateLabel}</span><Badge tone={item.tone}>{item.status}</Badge></td>
                    <td className="aw-work-row-chevron"><ChevronRight aria-hidden="true" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="aw-work-empty">
            <Inbox aria-hidden="true" />
            <EmptyState
              title={query ? 'No matching work items' : tab === 'review' ? 'No work needs review' : 'No assigned work'}
              description={query ? 'Try another reference, owner, or work item.' : `There are no ${tab === 'review' ? 'pending review' : 'assigned'} items for ${system.name}.`}
            />
            {query ? <Button onClick={() => setQuery('')}>Clear filter</Button> : <Button onClick={() => onNavigate('system')}>View system</Button>}
          </div>
        )}
      </section>

      {selectedItem ? (
        <aside className="aw-work-detail" ref={detailRef} aria-labelledby="aw-work-detail-title">
          <button type="button" className="aw-work-close" aria-label="Close work item details" onClick={() => onSelect(null)}><X aria-hidden="true" /></button>
          <div className="aw-work-detail-header">
            <div><p className="aw-eyebrow">{selectedItem.kind === 'evidence' ? 'Evidence' : selectedItem.kind === 'remediation' ? 'Remediation' : selectedItem.kind === 'control' ? 'Control review' : 'System change'}</p><h2 id="aw-work-detail-title">{selectedEvidence?.name ?? selectedItem.title}</h2></div>
            <Badge tone={selectedItem.tone}>{selectedItem.status}</Badge>
          </div>
          <dl className="aw-work-detail-facts">
            {selectedEvidence ? <><dt>Source</dt><dd>{selectedEvidence.source}</dd><dt>Collected</dt><dd>{selectedEvidence.collectedAt}</dd></> : <><dt>Reference</dt><dd>{selectedItem.reference}</dd><dt>Date</dt><dd>{selectedItem.dateLabel}</dd></>}
            <dt>Control</dt><dd>{selectedControl ? <button type="button" className="aw-work-control-link" onClick={() => onNavigate('controls', selectedControl.id)}><span>{selectedControl.ref}</span><span className="aw-muted">{selectedControl.name}</span></button> : selectedItem.reference}</dd>
            <dt>System</dt><dd>{system.name}</dd>
            <dt>Owner</dt><dd>{selectedItem.owner} ({selectedItem.ownerRole})</dd>
          </dl>
          <div className="aw-work-review-notes"><h3>{selectedEvidence?.status === 'Accepted' ? 'Review record' : 'Review notes'}</h3><p className="aw-muted">{reviewNotes}</p></div>
          <div className="aw-work-detail-actions">
            <Button variant="primary" disabled={selectedEvidence?.status === 'Accepted'} onClick={runSelectedAction}>
              {selectedItem.kind === 'evidence' ? selectedEvidence?.status === 'Accepted' ? 'Evidence accepted' : 'Review evidence' : selectedItem.kind === 'remediation' ? 'Review remediation' : selectedItem.kind === 'control' ? 'Open control' : 'Review change'}<ArrowRight aria-hidden="true" />
            </Button>
            <Button onClick={() => onNavigate('system')}><ExternalLink aria-hidden="true" />View in system</Button>
          </div>
        </aside>
      ) : null}

      <section className="aw-work-summary aw-panel" aria-labelledby="aw-work-summary-title">
        <header><h2 id="aw-work-summary-title">Authorization summary</h2><button type="button" className="aw-link" onClick={() => onNavigate('system')}>View system <ArrowRight aria-hidden="true" /></button></header>
        <div className="aw-work-summary-grid">
          <div className="aw-work-summary-item">
            <span className={`aw-work-summary-icon ${system.decisionDate ? 'aw-work-summary-icon--success' : 'aw-work-summary-icon--neutral'}`}><FileText aria-hidden="true" /></span>
            <div><h3>{system.decisionDate ? 'Agency decision on file' : 'No agency decision recorded'}</h3><p className="aw-muted">{system.decisionDate ? `Authorization to Operate (ATO) on file for ${system.name}.` : `View the authorization work for ${system.name}.`}</p><button type="button" className="aw-link" onClick={() => onOpenArea('authorization')}>View authorization details <ArrowRight aria-hidden="true" /></button></div>
          </div>
          <div className="aw-work-summary-item">
            <span className="aw-work-summary-icon aw-work-summary-icon--info"><CalendarDays aria-hidden="true" /></span>
            <div><h3>Next review</h3><strong className="aw-work-review-date">{system.nextReview || 'Not scheduled'}</strong><p className="aw-muted">{system.nextReview ? 'Next scheduled review date.' : 'No review date has been recorded.'}</p><button type="button" className="aw-link" onClick={() => onOpenArea('monitoring')}>View monitoring <ArrowRight aria-hidden="true" /></button></div>
          </div>
          <div className="aw-work-summary-item">
            <span className={`aw-work-summary-icon ${pendingEvidenceCount ? 'aw-work-summary-icon--danger' : evidence.length ? 'aw-work-summary-icon--success' : 'aw-work-summary-icon--neutral'}`}><TriangleAlert aria-hidden="true" /></span>
            <div><h3>{pendingEvidenceCount ? `${pendingEvidenceCount} evidence check${pendingEvidenceCount === 1 ? '' : 's'} need${pendingEvidenceCount === 1 ? 's' : ''} attention` : evidence.length ? 'No pending evidence reviews' : 'No evidence supplied'}</h3><p className="aw-muted">{pendingEvidenceCount ? 'Items may delay your next review.' : evidence.length ? 'All current evidence reviews are accepted.' : 'Evidence is needed for the next review.'}</p><button type="button" className="aw-link" onClick={evidence.length ? showReviewWork : () => onOpenArea('evidence')}>{evidence.length ? 'View in work queue' : 'View evidence'} <ArrowRight aria-hidden="true" /></button></div>
          </div>
        </div>
      </section>
    </div>
  );
}
