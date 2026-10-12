import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Archive, ArrowRight, Bell, Check, ChevronDown, ClipboardCheck, Database, FileText, Home, Menu, Search, Settings2, ShieldCheck, TriangleAlert, X, ChartNoAxesColumn } from 'lucide-react';
import { exampleSystems } from './data';
import { Badge, Button, EmptyState } from './primitives';
import { WorkView } from './WorkView';
import { SystemView } from './SystemView';
import { ControlView } from './ControlView';
import type { ContextArea, EvidenceRecord, WorkItem, WorkspaceView } from './types';
import './workspace.css';

const nav = [
  { id: 'work', label: 'My Work', icon: Home }, { id: 'system', label: 'Systems', icon: Database },
  { id: 'controls', label: 'Controls', icon: FileText }, { id: 'evidence', label: 'Evidence & Tests', icon: Archive },
  { id: 'risk', label: 'Risk & POA&M', icon: TriangleAlert }, { id: 'authorization', label: 'Authorization', icon: ShieldCheck },
  { id: 'monitoring', label: 'Monitoring', icon: ChartNoAxesColumn },
] as const;
const areaTitles: Record<ContextArea, string> = { evidence: 'Evidence & Tests', risk: 'Risk & POA&M', authorization: 'Authorization case', monitoring: 'Monitoring', tools: 'Workspace tools', administration: 'Administration' };
function initialContext() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  return { view: (['work', 'system', 'controls'].includes(view ?? '') ? view : 'work') as WorkspaceView, systemId: params.get('system') === 'orion' ? 'orion' : 'atlas', controlId: params.get('control') ?? 'ac-2' };
}
export function AtoWorkspace() {
  const [context, setContext] = useState(initialContext);
  const [evidenceBySystem, setEvidenceBySystem] = useState<Record<string, EvidenceRecord[]>>(() => Object.fromEntries(exampleSystems.map((system) => [system.id, system.evidence])));
  const [workBySystem, setWorkBySystem] = useState<Record<string, WorkItem[]>>(() => Object.fromEntries(exampleSystems.map((system) => [system.id, system.work])));
  const [draftsBySystem, setDraftsBySystem] = useState<Record<string, Record<string, string>>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [savedDraftsBySystem, setSavedDraftsBySystem] = useState<Record<string, Record<string, string>>>({});
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [area, setArea] = useState<ContextArea | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedWork, setSelectedWork] = useState<string | null>('review-accounts');
  const [caseLens, setCaseLens] = useState('current');
  const focusReturn = useRef<HTMLElement | null>(null);
  const system = exampleSystems.find((item) => item.id === context.systemId) ?? exampleSystems[0];
  const evidence = evidenceBySystem[system.id];
  const work = workBySystem[system.id];
  const controls = system.controls.map((control) => requested[`${system.id}:${control.id}`] || (draftsBySystem[system.id]?.[control.id] !== undefined && draftsBySystem[system.id][control.id] !== control.narrative) ? { ...control, status: 'Needs review' as const } : control);
  const review = evidence.find((record) => record.id === reviewId);
  const drafts = draftsBySystem[system.id] ?? {};

  useEffect(() => {
    const onPop = () => { setContext(initialContext()); setCaseLens('current'); setArea(null); setReviewId(null); setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); focusReturn.current = document.activeElement as HTMLElement; setSearchOpen((open) => !open); } };
    window.addEventListener('popstate', onPop); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 4200); return () => window.clearTimeout(id); }, [notice]);
  function navigate(view: WorkspaceView, controlId = context.controlId, systemId = context.systemId) {
    const next = { view, controlId, systemId };
    const params = new URLSearchParams({ view, system: systemId }); if (view === 'controls') params.set('control', controlId);
    window.history.pushState(next, '', `${window.location.pathname}?${params}`);
    setContext(next); window.scrollTo({ top: 0, left: 0 }); setArea(null); setReviewId(null); setSearchOpen(false); setMenuOpen(false);
  }
  function openArea(next: ContextArea) { focusReturn.current = menuOpen ? document.querySelector<HTMLElement>('.aw-mobile-menu') : document.activeElement as HTMLElement; setArea(next); setMenuOpen(false); }
  function openReview(id: string) { focusReturn.current = document.activeElement as HTMLElement; setArea(null); setReviewId(id); setReviewConfirmed(false); setReviewNote(''); setReviewError(''); }
  function closeDialog() { setArea(null); setReviewId(null); setSearchOpen(false); }
  function restoreFocus() { const target = focusReturn.current; if (target?.isConnected && !(target instanceof HTMLButtonElement && target.disabled)) target.focus(); else document.getElementById('workspace-main')?.focus(); }
  function decideEvidence(status: EvidenceRecord['status']) {
    if (!review) return;
    if (status === 'Accepted' && !reviewConfirmed) { setReviewError('Confirm the evidence scope before accepting it.'); return; }
    if (status === 'Changes requested' && !reviewNote.trim()) { setReviewError('Add a note describing the changes needed.'); return; }
    setEvidenceBySystem((all) => ({ ...all, [system.id]: all[system.id].map((record) => record.id === review.id ? { ...record, status, reviewNote: reviewNote.trim() } : record) }));
    setWorkBySystem((all) => ({ ...all, [system.id]: all[system.id].map((item) => item.evidenceId === review.id ? { ...item, status: status === 'Accepted' ? 'Reviewed' : 'Changes requested', tone: status === 'Accepted' ? 'success' : 'warning' } : item) }));
    setNotice(status === 'Accepted' ? 'Evidence review recorded.' : 'Changes requested.'); closeDialog();
  }
  function saveDraft(id: string) {
    setSavedDraftsBySystem((all) => ({ ...all, [system.id]: { ...all[system.id], [id]: drafts[id] ?? controls.find((control) => control.id === id)?.narrative ?? '' } }));
    setSavedAt((all) => ({ ...all, [`${system.id}:${id}`]: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }));
    setNotice('Draft saved.');
  }
  function requestReview(id: string) {
    if (!(drafts[id] ?? controls.find((c) => c.id === id)?.narrative ?? '').trim()) { setNotice('Add an implementation narrative before requesting review.'); return; }
    saveDraft(id); setRequested((all) => ({ ...all, [`${system.id}:${id}`]: true }));
    const control = controls.find((item) => item.id === id);
    if (control) setWorkBySystem((all) => ({ ...all, [system.id]: [...all[system.id].filter((item) => item.id !== `draft-${id}`), { id: `draft-${id}`, kind: 'control', title: `Review ${control.ref} implementation draft`, description: control.name, reference: control.ref, category: 'Control review', systemId: system.id, owner: system.isso, ownerRole: 'ISSO', date: '2026-10-11', dateLabel: 'Requested Oct 11, 2026', status: 'Needs review', tone: 'purple', controlId: id }] }));
    setNotice('Review requested for the current draft.');
  }
  const viewProps = { system, evidence, work, controls, onNavigate: navigate, onOpenArea: openArea, onReviewEvidence: openReview };
  const selectedControlId = controls.some((c) => c.id === context.controlId) ? context.controlId : controls[0].id;
  function navItems() { return <>
    <nav aria-label="Workspace navigation">{nav.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`aw-nav-item ${context.view === id ? 'aw-nav-item--active' : ''}`} aria-current={context.view === id ? 'page' : undefined} onClick={() => ['work', 'system', 'controls'].includes(id) ? navigate(id as WorkspaceView) : openArea(id as ContextArea)}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</nav>
    <div className="aw-nav-bottom"><button className="aw-nav-item" type="button" onClick={() => openArea('tools')}><Settings2 size={20} aria-hidden="true" />Tools</button><button className="aw-nav-item" type="button" onClick={() => openArea('administration')}><Settings2 size={20} aria-hidden="true" />Administration</button></div>
  </>; }
  const searchItems = [
    ...nav.map((item) => ({ id: `nav-${item.id}`, label: item.label, detail: 'Workspace', action: () => ['work', 'system', 'controls'].includes(item.id) ? navigate(item.id as WorkspaceView) : (setSearchOpen(false), openArea(item.id as ContextArea)) })),
    ...controls.map((control) => ({ id: `control-${control.id}`, label: `${control.ref} · ${control.name}`, detail: system.name, action: () => navigate('controls', control.id) })),
    ...exampleSystems.map((item) => ({ id: `system-${item.id}`, label: item.name, detail: 'System', action: () => navigate('system', item.controls[0].id, item.id) })),
  ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="ato-preview">
    <a className="aw-skip" href="#workspace-main">Skip to content</a>
    <header className="aw-topbar">
      <div className="aw-brand-wrap"><button className="aw-mobile-menu aw-icon-button" aria-label="Open navigation" type="button" onClick={() => { focusReturn.current = document.activeElement as HTMLElement; setMenuOpen(true); }}><Menu size={20} /></button><button className="aw-brand" type="button" onClick={() => navigate('work')}>Regovise</button></div>
      <div className="aw-context"><label className="aw-context-select"><Database size={19} aria-hidden="true" /><span className="aw-sr-only">Select system</span><select aria-label="Select system" value={system.id} onChange={(event) => { setSelectedWork(null); setCaseLens('current'); navigate(context.view, 'ac-2', event.target.value); }}>{exampleSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></label>
      <label className="aw-context-select aw-case-select"><ShieldCheck size={19} aria-hidden="true" /><span className="aw-sr-only">Authorization case</span><select aria-label="Authorization case" value="current" onChange={(event) => { setCaseLens(event.target.value); openArea('authorization'); }}><option value="current">{system.profile}</option><option value="decision">Decision record</option></select><ChevronDown size={15} aria-hidden="true" /></label><span className="aw-example-label">Example workspace</span></div>
      <div className="aw-header-actions"><button type="button" className="aw-search-trigger" aria-label="Search workspace" onClick={() => { focusReturn.current = document.activeElement as HTMLElement; setSearchOpen(true); }}><Search size={17} aria-hidden="true" /><span>Search systems, controls, evidence…</span><kbd>⌘ K</kbd></button><button type="button" className="aw-icon-button" aria-label="Notifications" onClick={() => openArea('monitoring')}><Bell size={20} /></button><button type="button" className="aw-user" aria-label="Jordan Lee account" onClick={() => openArea('administration')}><span className="aw-avatar">JL</span><span>Jordan Lee · ISSO</span><ChevronDown size={14} /></button></div>
    </header>
    <div className="aw-shell"><aside className="aw-sidebar">{navItems()}</aside><main id="workspace-main" className="aw-main" tabIndex={-1}>
      {context.view === 'work' ? <WorkView key={system.id} {...viewProps} selectedId={selectedWork} onSelect={setSelectedWork} /> : context.view === 'system' ? <SystemView key={system.id} {...viewProps} /> : <ControlView key={system.id} {...viewProps} selectedControlId={selectedControlId} drafts={drafts} onEditDraft={(id, text) => { setDraftsBySystem((all) => ({ ...all, [system.id]: { ...all[system.id], [id]: text } })); setRequested((all) => ({ ...all, [`${system.id}:${id}`]: false }));  }} onSaveDraft={saveDraft} onRequestReview={requestReview} savedAt={Object.fromEntries(controls.flatMap((control) => savedAt[`${system.id}:${control.id}`] ? [[control.id, savedAt[`${system.id}:${control.id}`]]] : []))} savedDrafts={savedDraftsBySystem[system.id] ?? {}} reviewRequested={Object.fromEntries(controls.map((control) => [control.id, requested[`${system.id}:${control.id}`] ?? false]))} />}
    </main></div>
    {notice ? <div className="aw-toast" role="status"><Check size={18} aria-hidden="true" />{notice}</div> : null}
    <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}><Dialog.Portal><Dialog.Overlay className="aw-overlay" /><Dialog.Content className="aw-mobile-drawer" onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}><Dialog.Title className="aw-mobile-brand">Regovise</Dialog.Title><Dialog.Description className="aw-sr-only">Workspace navigation</Dialog.Description><Dialog.Close className="aw-icon-button aw-dialog-close" aria-label="Close navigation"><X size={20} /></Dialog.Close>{navItems()}</Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={Boolean(area || reviewId || searchOpen)} onOpenChange={(open) => { if (!open) closeDialog(); }}><Dialog.Portal><Dialog.Overlay className="aw-overlay" /><Dialog.Content className={`aw-dialog ${searchOpen ? 'aw-search-dialog' : ''}`} onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}><Dialog.Close className="aw-icon-button aw-dialog-close" aria-label="Close dialog"><X size={20} /></Dialog.Close>
      <Dialog.Title>{searchOpen ? 'Find workspace content' : review ? 'Review evidence' : area ? areaTitles[area] : 'Workspace'}</Dialog.Title>
      <Dialog.Description className="aw-dialog-description">{searchOpen ? 'Systems, controls and workspace areas' : review ? `${review.name} · ${system.name}` : `${system.name} · ${system.profile}`}</Dialog.Description>
      {searchOpen ? <><label className="aw-sr-only" htmlFor="aw-search-input">Search workspace</label><input id="aw-search-input" className="aw-input" placeholder="Search workspace…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus /><div className="aw-search-results">{searchItems.length ? searchItems.map((item) => <button key={item.id} type="button" onClick={item.action}><span>{item.label}</span><span className="aw-muted">{item.detail}</span><ArrowRight size={16} /></button>) : <EmptyState title="No matching content" description="Try a system name, control identifier or workspace area." />}</div></> : review ? <>
        <dl className="aw-review-metadata"><dt>Source</dt><dd>{review.source}</dd><dt>Collected</dt><dd>{review.collectedAt}</dd><dt>Control</dt><dd>{review.controlIds.map((id) => controls.find((control) => control.id === id)?.ref).join(', ')}</dd><dt>Status</dt><dd><Badge tone={review.status === 'Accepted' ? 'success' : 'purple'}>{review.status}</Badge></dd></dl>
        <div className="aw-evidence-preview"><h3>Review notes</h3><p>Confirm all privileged accounts are included and inactive accounts have been removed.</p><p className="aw-muted">{review.description}</p></div>
        <label className="aw-check"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /><span>I checked this evidence against the system boundary and control.</span></label>
        <label className="aw-field">Reviewer note<textarea className="aw-input" rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Add a review note or describe the changes needed." /></label>
        {reviewError ? <p className="aw-error" role="alert">{reviewError}</p> : null}<div className="aw-dialog-actions"><Button onClick={() => decideEvidence('Changes requested')}>Request changes</Button><Button variant="primary" onClick={() => decideEvidence('Accepted')}>Accept evidence</Button></div>
      </> : area === 'evidence' ? <div className="aw-area-list">{evidence.length ? evidence.map((record) => <button type="button" key={record.id} onClick={() => openReview(record.id)}><FileText size={20} /><span><strong>{record.name}</strong><small>{record.source} · {record.collectedAt}</small></span><Badge tone={record.status === 'Accepted' ? 'success' : 'purple'}>{record.status}</Badge><ArrowRight size={16} /></button>) : <EmptyState title="No evidence linked" description="This system has no supporting evidence records yet." />}</div> : area === 'authorization' ? <>
        <div className="aw-decision-state"><Badge tone={system.decisionDate ? 'success' : 'neutral'}>{system.decisionDate ? 'Decision on file' : 'No decision recorded'}</Badge><h3>{caseLens === 'decision' ? 'Decision record' : system.caseStage}</h3></div>
        <dl className="aw-review-metadata"><dt>System</dt><dd>{system.name}</dd><dt>Profile</dt><dd>{system.profile}</dd><dt>Decision date</dt><dd>{system.decisionDate || 'Not recorded'}</dd><dt>Next review</dt><dd>{system.nextReview}</dd><dt>Case stage</dt><dd>{system.caseStage}</dd></dl><p className="aw-muted">Example decision record for this workspace.</p><Button variant="primary" onClick={() => navigate('system')}>Open system overview <ArrowRight size={16} /></Button>
      </> : area === 'risk' ? <div className="aw-area-list">{work.filter((item) => item.kind === 'remediation' || item.kind === 'change').map((item) => <div className="aw-area-record" key={item.id}><TriangleAlert size={20} /><div><h3>{item.reference} · {item.title}</h3><p>{item.description}</p><p className="aw-muted">{item.owner} · {item.dateLabel}</p></div><Badge tone={item.tone}>{item.status}</Badge></div>)}{work.every((item) => item.kind !== 'remediation' && item.kind !== 'change') ? <EmptyState title="No open remediation or change work" /> : null}<Button onClick={() => { setSelectedWork(work.find((item) => item.kind !== 'evidence')?.id ?? null); navigate('work'); }}>Open work queue <ArrowRight size={16} /></Button></div> : area === 'monitoring' ? <>
        <div className="aw-area-record"><ClipboardCheck size={24} /><div><h3>Scheduled system review</h3><p>Next review {system.nextReview}</p><p className="aw-muted">Owner: {system.isso}</p></div></div><div className="aw-area-record"><Archive size={24} /><div><h3>{evidence.filter((record) => record.status !== 'Accepted').length} evidence records need attention</h3><p>Open each record to inspect the source and review status.</p></div></div><Button variant="primary" onClick={() => { closeDialog(); openArea('evidence'); }}>Review evidence <ArrowRight size={16} /></Button>
      </> : area === 'tools' ? <div className="aw-area-list"><Button onClick={() => navigate('controls')}>Control implementation workspace <ArrowRight size={16} /></Button><Button onClick={() => { closeDialog(); openArea('evidence'); }}>Evidence review workspace <ArrowRight size={16} /></Button></div> : <><div className="aw-area-record"><span className="aw-avatar">JL</span><div><h3>Jordan Lee</h3><p>ISSO · Example workspace</p></div></div><Button onClick={() => navigate('system')}>View system overview <ArrowRight size={16} /></Button></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
