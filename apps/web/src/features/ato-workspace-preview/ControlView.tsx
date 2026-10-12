import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bold, BookOpen, CheckCircle2, Clock3, FileText, Italic, Link2, List, ListOrdered, Plus, Save, Send } from 'lucide-react';
import { Badge, Button, EmptyState, Tabs } from './primitives';
import type { ControlStatus, ControlViewProps, EvidenceRecord } from './types';
import './control.css';

type ControlTab = 'implementation' | 'evidence' | 'assessment' | 'history';
type ReviewChecks = { narrative: boolean; boundary: boolean; revisions: boolean };

const tabs = [
  { id: 'implementation', label: 'Implementation' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'history', label: 'History' },
];

function controlTone(status: ControlStatus): 'success' | 'warning' | 'purple' {
  return status === 'Approved' ? 'success' : status === 'Needs review' ? 'warning' : 'purple';
}

function evidenceTone(status: EvidenceRecord['status']): 'success' | 'warning' | 'danger' {
  return status === 'Accepted' ? 'success' : status === 'Changes requested' ? 'danger' : 'warning';
}

function savedTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ControlView({
  system,
  controls,
  evidence,
  selectedControlId,
  drafts,
  savedAt,
  savedDrafts,
  reviewRequested,
  onEditDraft,
  onSaveDraft,
  onRequestReview,
  onNavigate,
  onOpenArea,
  onReviewEvidence,
}: ControlViewProps) {
  const control = controls.find((item) => item.id === selectedControlId) ?? controls[0];
  const [activeTab, setActiveTab] = useState<ControlTab>('implementation');
  const [family, setFamily] = useState('all');
  const [checks, setChecks] = useState<ReviewChecks>({ narrative: false, boundary: false, revisions: false });
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const linkRange = useRef({ start: 0, end: 0 });
  const [markdown, setMarkdown] = useState(true);
  const [heading, setHeading] = useState('normal');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    setActiveTab('implementation');
    setChecks({ narrative: false, boundary: false, revisions: false });
    setLinkOpen(false);
    setLinkError('');
    setHeading('normal');
  }, [control?.id, system.id]);

  useEffect(() => {
    setFamily((current) => current !== 'all' && control && current !== control.family ? 'all' : current);
  }, [control?.id, control?.family]);

  if (!control) {
    return (
      <section className="aw-control-empty aw-panel">
        <EmptyState title="No controls in this system" description="Choose another system to explore its control implementation." />
        <Button onClick={() => onNavigate('system')}>Open system</Button>
      </section>
    );
  }

  const draft = drafts[control.id] ?? control.narrative;
  const linkedEvidence = evidence.filter((item) => control.evidenceIds.includes(item.id));
  const pendingEvidence = linkedEvidence.filter((item) => item.status !== 'Accepted').length;
  const visibleControls = controls.filter((item) => family === 'all' || item.family === family);
  const families = [...new Set(controls.map((item) => item.family))];
  const hasText = draft.trim().length > 0;
  const hasChanges = draft !== (savedDrafts[control.id] ?? control.narrative);
  const hasDraftRevision = draft !== control.narrative;
  const allChecksComplete = Object.values(checks).every(Boolean);
  const requested = Boolean(reviewRequested[control.id]);
  const requestDisabled = !hasText || !allChecksComplete || requested;
  const reviewGuidanceId = `aw-control-review-guidance-${control.id}`;
  const headerStatus = requested
    ? 'Draft review requested'
    : hasDraftRevision || control.status === 'Needs review'
      ? 'Draft revision · Needs review'
      : control.status;
  const headerTone = requested || hasDraftRevision ? 'warning' : controlTone(control.status);

  function updateCheck(key: keyof ReviewChecks, checked: boolean) {
    setChecks((current) => ({ ...current, [key]: checked }));
  }

  function editNarrative(text: string) {
    onEditDraft(control.id, text);
    setChecks((current) => ({ ...current, narrative: false }));
  }

  function replaceSelection(start: number, end: number, text: string, selectStart = start, selectEnd = start + text.length) {
    editNarrative(`${draft.slice(0, start)}${text}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(selectStart, selectEnd);
    });
  }

  function wrapSelection(marker: string, placeholder: string) {
    const start = editorRef.current?.selectionStart ?? draft.length;
    const end = editorRef.current?.selectionEnd ?? start;
    const text = draft.slice(start, end) || placeholder;
    replaceSelection(start, end, `${marker}${text}${marker}`, start + marker.length, start + marker.length + text.length);
  }

  function formatLines(format: 'normal' | 'h2' | 'unordered' | 'ordered') {
    const start = editorRef.current?.selectionStart ?? draft.length;
    const end = editorRef.current?.selectionEnd ?? start;
    const lineStart = start === 0 ? 0 : draft.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = draft.indexOf('\n', end);
    const lineEnd = nextBreak < 0 ? draft.length : nextBreak;
    const lines = draft.slice(lineStart, lineEnd).split('\n');
    const text = lines.map((line, index) => {
      if (format === 'h2' || format === 'normal') return `${format === 'h2' ? '## ' : ''}${line.replace(/^#{1,6}\s+/, '')}`;
      const item = line.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, '') || 'List item';
      return `${format === 'ordered' ? `${index + 1}. ` : '- '}${item}`;
    }).join('\n');
    replaceSelection(lineStart, lineEnd, text);
  }

  function openLinkEditor() {
    const start = editorRef.current?.selectionStart ?? draft.length;
    const end = editorRef.current?.selectionEnd ?? start;
    linkRange.current = { start, end };
    setLinkText(draft.slice(start, end) || 'Link text');
    setLinkUrl('');
    setLinkError('');
    setLinkOpen(true);
  }

  function insertLink() {
    let url: URL;
    try {
      url = new URL(linkUrl.trim());
    } catch {
      setLinkError('Enter a valid http or https URL.');
      return;
    }
    if (!['https:', 'http:'].includes(url.protocol)) { setLinkError('Use an http or https URL.'); return; }
    if (!linkText.trim()) { setLinkError('Enter the text for this link.'); return; }
    const label = linkText.trim().replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    const text = `[${label}](${url.href.replace(/\)/g, '%29')})`;
    replaceSelection(linkRange.current.start, linkRange.current.end, text);
    setLinkOpen(false);
  }

  function renderEvidenceTable() {
    if (linkedEvidence.length === 0) {
      return <EmptyState title="No supporting evidence yet" description="Open Evidence & Tests to find the evidence this control needs." />;
    }

    return (
      <div className="aw-control-evidence-scroll">
        <table className="aw-control-evidence-table">
          <caption className="aw-control-sr-only">Supporting evidence for {control.ref}</caption>
          <thead>
            <tr>
              <th scope="col">Evidence</th>
              <th scope="col">Source</th>
              <th scope="col">Collected</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="aw-control-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {linkedEvidence.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="aw-control-evidence-name">
                    <FileText size={20} aria-hidden="true" />
                    <div>
                      <button type="button" className="aw-link aw-control-evidence-link" onClick={() => onReviewEvidence(item.id)}>{item.name}</button>
                      <span className="aw-muted aw-control-evidence-description">{item.description}</span>
                    </div>
                  </div>
                </td>
                <td>{item.source}</td>
                <td>{item.collectedAt}</td>
                <td><Badge tone={evidenceTone(item.status)}>{item.status === 'Accepted' ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{item.status}</Badge></td>
                <td><Button variant="ghost" className="aw-control-evidence-action" aria-label={`Inspect ${item.name}`} onClick={() => onReviewEvidence(item.id)}><ArrowUpRight size={17} aria-hidden="true" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSupportingEvidence() {
    return (
      <section className="aw-control-supporting" aria-label="Supporting evidence">
        <div className="aw-control-supporting-header">
          <div>
            <h2>Supporting evidence</h2>
            <p className="aw-muted">Link evidence that supports this control’s implementation.</p>
          </div>
          <Button className="aw-control-add-evidence" onClick={() => onOpenArea('evidence')}><Plus size={17} aria-hidden="true" />Add evidence</Button>
        </div>
        {renderEvidenceTable()}
      </section>
    );
  }

  return (
    <div className="aw-control-view">
      <nav className="aw-control-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><button type="button" onClick={() => onNavigate('system')}>{system.name}</button></li>
          <li>Controls</li>
          <li aria-current="page">{control.ref}</li>
        </ol>
      </nav>

      <header className="aw-control-header">
        <h1 className="aw-title">{control.ref} · {control.name}</h1>
        <div className="aw-control-meta"><span className="aw-muted">Owner: {control.owner}</span><Badge tone={headerTone}>{headerTone === 'success' ? <CheckCircle2 size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}{headerStatus}</Badge></div>
      </header>

      <div className="aw-control-layout">
        <aside className="aw-panel aw-control-family" aria-label="Control list">
          <div className="aw-control-family-header">
            <label htmlFor="aw-control-family-filter" className="aw-control-sr-only">Filter control family</label>
            <select id="aw-control-family-filter" value={family} onChange={(event) => setFamily(event.target.value)}>
              <option value="all">All control families</option>
              {families.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="aw-control-list">
            {visibleControls.map((item) => (
              <button type="button" key={item.id} aria-pressed={item.id === control.id} className={`aw-control-row${item.id === control.id ? ' aw-control-row--selected' : ''}`} onClick={() => onNavigate('controls', item.id)}>
                <strong>{item.ref}</strong>
                <span className="aw-control-row-name">{item.name}</span>
                <span className={`aw-control-status aw-control-status--${reviewRequested[item.id] ? 'warning' : controlTone(item.status)}`}>
                  {reviewRequested[item.id] ? <Clock3 size={18} aria-hidden="true" /> : item.status === 'Approved' ? <CheckCircle2 size={18} aria-hidden="true" /> : item.status === 'Needs review' ? <Clock3 size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}
                  {reviewRequested[item.id] ? 'Review requested' : item.status}
                </span>
              </button>
            ))}
            {visibleControls.length === 0 ? <EmptyState title="No controls in this family" /> : null}
          </div>
        </aside>

        <section className="aw-panel aw-control-workbench" aria-label={`${control.ref} control workbench`}>
          <Tabs items={tabs} active={activeTab} onChange={(id) => setActiveTab(id as ControlTab)} label="Control details" />
          <div className="aw-control-tabpanel" role="tabpanel" aria-label={`${tabs.find((item) => item.id === activeTab)?.label} for ${control.ref}`} tabIndex={0}>
            {activeTab === 'implementation' ? (
              <>
                <section className="aw-control-implementation">
                  <h2>Implementation guidance and narrative</h2>
                  <p className="aw-muted">Describe how this control is implemented in your system, including roles, tools, and processes.</p>
                  <details className="aw-control-requirement"><summary><BookOpen size={16} aria-hidden="true" />View requirement</summary><p>{control.requirement}</p></details>
                  <div className="aw-control-editor">
                    <div className="aw-control-editor-toolbar">
                      <div className="aw-control-format-actions" role="group" aria-label="Narrative formatting">
                        <label className="aw-control-sr-only" htmlFor="aw-control-heading">Paragraph style</label>
                        <select id="aw-control-heading" value={heading} disabled={!markdown} onChange={(event) => { setHeading(event.target.value); formatLines(event.target.value as 'normal' | 'h2'); }}><option value="normal">Normal</option><option value="h2">Heading 2</option></select>
                        <Button variant="ghost" disabled={!markdown} aria-label="Bold" title="Bold" onClick={() => wrapSelection('**', 'Bold text')}><Bold size={16} aria-hidden="true" /></Button>
                        <Button variant="ghost" disabled={!markdown} aria-label="Italic" title="Italic" onClick={() => wrapSelection('_', 'Italic text')}><Italic size={16} aria-hidden="true" /></Button>
                        <Button variant="ghost" disabled={!markdown} aria-label="Unordered list" title="Unordered list" onClick={() => formatLines('unordered')}><List size={17} aria-hidden="true" /></Button>
                        <Button variant="ghost" disabled={!markdown} aria-label="Ordered list" title="Ordered list" onClick={() => formatLines('ordered')}><ListOrdered size={17} aria-hidden="true" /></Button>
                        <Button variant="ghost" disabled={!markdown} aria-label="Insert link" title="Insert link" onClick={openLinkEditor}><Link2 size={16} aria-hidden="true" /></Button>
                      </div>
                      <label className="aw-control-markdown-toggle"><input type="checkbox" checked={markdown} onChange={(event) => { setMarkdown(event.target.checked); setLinkOpen(false); }} />Markdown</label>
                    </div>
                    {linkOpen ? <form className="aw-control-link-form" onSubmit={(event) => { event.preventDefault(); insertLink(); }}>
                      <label>Link text<input value={linkText} onChange={(event) => setLinkText(event.target.value)} autoFocus /></label>
                      <label>URL<input type="url" value={linkUrl} placeholder="https://example.com/evidence" onChange={(event) => setLinkUrl(event.target.value)} required /></label>
                      {linkError ? <p className="aw-control-link-error" role="alert">{linkError}</p> : null}
                      <div><Button type="submit" variant="primary">Insert link</Button><Button onClick={() => { setLinkOpen(false); editorRef.current?.focus(); }}>Cancel</Button></div>
                    </form> : null}
                    <label className="aw-control-sr-only" htmlFor={`aw-control-narrative-${control.id}`}>{control.ref} implementation narrative</label>
                    <textarea ref={editorRef} id={`aw-control-narrative-${control.id}`} value={draft} readOnly={linkOpen} onChange={(event) => editNarrative(event.target.value)} aria-describedby={markdown ? 'aw-control-markdown-help' : undefined} spellCheck />
                    {markdown ? <p id="aw-control-markdown-help" className="aw-control-markdown-help">Select text to format. Markdown marks stay visible in your draft.</p> : null}
                  </div>
                  <div className="aw-control-save-meta" aria-live="polite"><span>{savedAt[control.id] ? `Last saved ${savedTime(savedAt[control.id])}` : 'Not yet saved'}</span>{hasChanges ? <span className="aw-control-unsaved">Unsaved changes</span> : savedAt[control.id] ? <span><CheckCircle2 size={14} aria-hidden="true" />Draft saved</span> : null}</div>
                </section>
                {renderSupportingEvidence()}
              </>
            ) : null}

            {activeTab === 'evidence' ? (
              <>
                <section className="aw-control-detail-intro"><span className="aw-eyebrow">{control.ref}</span><h2>Evidence for this control</h2><p className="aw-muted">Inspect the source and review state of the evidence linked to {system.name}.</p></section>
                {renderSupportingEvidence()}
              </>
            ) : null}

            {activeTab === 'assessment' ? (
              <section className="aw-control-detail-intro aw-control-assessment"><span className="aw-eyebrow">Assessment</span><h2>Current assessment record</h2><div className="aw-control-assessment-result"><FileText size={22} aria-hidden="true" /><p>{control.assessment}</p></div><h3>Control requirement</h3><p>{control.requirement}</p><Button onClick={() => onOpenArea('authorization')}>Open authorization workspace<ArrowUpRight size={16} aria-hidden="true" /></Button></section>
            ) : null}

            {activeTab === 'history' ? (
              <section className="aw-control-detail-intro aw-control-history"><span className="aw-eyebrow">History</span><h2>Control activity</h2>{control.history.length ? <ol>{control.history.map((entry, index) => <li key={`${control.id}-${index}`}><Clock3 size={17} aria-hidden="true" /><p>{entry}</p></li>)}</ol> : <EmptyState title="No control activity yet" />}</section>
            ) : null}
          </div>
        </section>

        <aside className="aw-panel aw-control-checklist" aria-labelledby="aw-control-checklist-title">
          <h2 id="aw-control-checklist-title">Review checklist</h2>
          <p className="aw-muted">Confirm the following before requesting review.</p>
          <div className="aw-control-checks">
            <label><input type="checkbox" checked={checks.narrative} onChange={(event) => updateCheck('narrative', event.target.checked)} /><span><strong>Implementation answers the requirement</strong><span className="aw-muted">The narrative describes how {control.ref} is implemented in this system.</span></span></label>
            <label><input type="checkbox" checked={checks.boundary} onChange={(event) => updateCheck('boundary', event.target.checked)} /><span><strong>Source evidence matches the system boundary</strong><span className="aw-muted">Evidence is for {system.name} and within the defined boundary.</span></span></label>
            <label><input type="checkbox" checked={checks.revisions} onChange={(event) => updateCheck('revisions', event.target.checked)} /><span><strong>{pendingEvidence ? `${pendingEvidence} evidence ${pendingEvidence === 1 ? 'item needs' : 'items need'} confirmation` : linkedEvidence.length ? 'Supporting evidence has been checked' : 'Missing evidence is identified'}</strong><span className="aw-muted">{pendingEvidence ? 'Review the outstanding evidence and identify any updates needed.' : linkedEvidence.length ? 'Confirm the linked evidence is relevant to this narrative.' : 'Identify the evidence still needed before this control can be assessed.'}</span></span></label>
          </div>
          <div className="aw-control-review-note"><Clock3 size={18} aria-hidden="true" /><p>Draft content must be reviewed before use in the authorization package.</p></div>
          <div className="aw-control-review-actions">
            <Button variant="primary" disabled={requestDisabled} aria-describedby={reviewGuidanceId} onClick={() => { if (!requestDisabled) onRequestReview(control.id); }}><Send size={18} aria-hidden="true" />{requested ? 'Review requested' : 'Request review'}</Button>
            <Button disabled={!hasText} onClick={() => onSaveDraft(control.id)}><Save size={18} aria-hidden="true" />Save draft</Button>
          </div>
          <p id={reviewGuidanceId} className="aw-control-review-guidance aw-muted" aria-live="polite">{requested ? 'This draft is waiting for review.' : !hasText ? 'Write a narrative before saving or requesting review.' : !allChecksComplete ? 'Complete the three checks to request review.' : 'Ready to request review of this draft.'}</p>
          <div className="aw-control-updated"><span className="aw-muted">Last saved</span><span>{savedAt[control.id] ? savedTime(savedAt[control.id]) : 'Not yet saved'}</span><span className="aw-muted">Jordan Lee</span></div>
        </aside>
      </div>
    </div>
  );
}
