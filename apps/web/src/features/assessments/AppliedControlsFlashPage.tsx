import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { AppliedControl } from './types';

const client = new ApiClient();

function formatCurrency(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toString() : '';
}

export function AppliedControlsFlashPage() {
  const { identity } = useEdgeIdentity();
  const { assessmentId: routeAssessmentId } = useParams<{ assessmentId?: string }>();
  const [searchParams] = useSearchParams();
  const complianceAssessmentId =
    searchParams.get('complianceAssessmentId') ?? routeAssessmentId ?? '';
  const backUrl =
    searchParams.get('backUrl') ||
    (routeAssessmentId ? `/compliance-assessments/${routeAssessmentId}` : '/assessments');
  const backLabel =
    searchParams.get('backLabel') || (routeAssessmentId ? 'Back to compliance review' : 'Back');
  const [controls, setControls] = useState<AppliedControl[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState('to_do');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [csfFunction, setCsfFunction] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [eta, setEta] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [controlImpact, setControlImpact] = useState('');
  const [effort, setEffort] = useState('');
  const [annualCost, setAnnualCost] = useState('');
  const [notes, setNotes] = useState('');

  const current = controls[index] ?? null;

  async function loadControls() {
    try {
      setLoading(true);
      setError(null);
      const suffix = complianceAssessmentId
        ? `?complianceAssessmentId=${encodeURIComponent(complianceAssessmentId)}`
        : '';
      const response = await client.get<{ data: AppliedControl[] }>(`/core/applied-controls${suffix}`);
      setControls(response.data);
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadControls();
  }, [identity.tenantId, identity.userId, complianceAssessmentId]);

  useEffect(() => {
    if (!current) {
      return;
    }

    setStatus(current.status);
    setPriority(current.priority ?? '');
    setCategory(current.category ?? '');
    setCsfFunction(current.csfFunction ?? '');
    setOwnerName(current.ownerName ?? '');
    setEta(current.eta ? current.eta.slice(0, 10) : '');
    setExpiryDate(current.expiryDate ? current.expiryDate.slice(0, 10) : '');
    setControlImpact(current.controlImpact === null ? '' : String(current.controlImpact));
    setEffort(current.effort ?? '');
    setAnnualCost(current.annualCost === null ? '' : formatCurrency(String(current.annualCost)));
    setNotes(current.notes ?? '');
  }, [current]);

  async function saveCurrent() {
    if (!current) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: AppliedControl }>(`/core/applied-controls/${current.id}`, {
        status,
        priority: priority || null,
        category: category || null,
        csfFunction: csfFunction || null,
        ownerName: ownerName || null,
        eta: eta ? new Date(`${eta}T00:00:00.000Z`).toISOString() : null,
        expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`).toISOString() : null,
        controlImpact: controlImpact ? Number(controlImpact) : null,
        effort: effort || null,
        annualCost: annualCost ? Number(annualCost) : null,
        notes: notes || null,
      });
      setControls((currentControls) =>
        currentControls.map((item) => (item.id === response.data.id ? response.data : item)),
      );
      setNotice('Applied control updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading flash workspace...</div>;
  }

  if (!current) {
    return <div className="panel text-sm text-slate-400">No applied controls are available for this view.</div>;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="panel w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={backUrl}>
            {backLabel}
          </Link>
          <div className="badge-neutral">
            {index + 1} / {controls.length}
          </div>
        </div>

        <div className="text-center">
          <div className="eyebrow">Flash Mode</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {current.refId ? `${current.refId} ` : ''}
            {current.name}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {current.description || 'No applied control description available.'}
          </p>
        </div>

        {notice && <div className="notice-success">{notice}</div>}
        {error && <div className="notice-error">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="label">Status</span>
            <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="--">Tracking</option>
              <option value="to_do">To do</option>
              <option value="in_progress">In progress</option>
              <option value="on_hold">On hold</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Priority</span>
            <select className="input" onChange={(event) => setPriority(event.target.value)} value={priority}>
              <option value="">--</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Category</span>
            <input className="input" onChange={(event) => setCategory(event.target.value)} value={category} />
          </label>
          <label className="space-y-1">
            <span className="label">CSF function</span>
            <select className="input" onChange={(event) => setCsfFunction(event.target.value)} value={csfFunction}>
              <option value="">--</option>
              <option value="govern">Govern</option>
              <option value="identify">Identify</option>
              <option value="protect">Protect</option>
              <option value="detect">Detect</option>
              <option value="respond">Respond</option>
              <option value="recover">Recover</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Owner</span>
            <input className="input" onChange={(event) => setOwnerName(event.target.value)} value={ownerName} />
          </label>
          <label className="space-y-1">
            <span className="label">Effort</span>
            <select className="input" onChange={(event) => setEffort(event.target.value)} value={effort}>
              <option value="">--</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">ETA</span>
            <input className="input" onChange={(event) => setEta(event.target.value)} type="date" value={eta} />
          </label>
          <label className="space-y-1">
            <span className="label">Expiry date</span>
            <input
              className="input"
              onChange={(event) => setExpiryDate(event.target.value)}
              type="date"
              value={expiryDate}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Control impact</span>
            <input
              className="input"
              max="5"
              min="1"
              onChange={(event) => setControlImpact(event.target.value)}
              type="number"
              value={controlImpact}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Annual cost</span>
            <input
              className="input"
              min="0"
              onChange={(event) => setAnnualCost(event.target.value)}
              step="1000"
              type="number"
              value={annualCost}
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="label">Notes</span>
          <textarea
            className="input min-h-[160px]"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="button-secondary"
            disabled={index <= 0}
            onClick={() => setIndex((currentIndex) => Math.max(0, currentIndex - 1))}
            type="button"
          >
            Previous
          </button>
          <button className="button-primary" disabled={busy} onClick={() => void saveCurrent()} type="button">
            {busy ? 'Saving...' : 'Save Control'}
          </button>
          <button
            className="button-secondary"
            disabled={index >= controls.length - 1}
            onClick={() => setIndex((currentIndex) => Math.min(controls.length - 1, currentIndex + 1))}
            type="button"
          >
            Next
          </button>
          {current.requirementAssessment && (
            <div className="ml-auto text-xs text-cyan-200">
              Requirement: {current.requirementAssessment.ref} {current.requirementAssessment.name}
            </div>
          )}
          {current.assessmentPlanItem && (
            <div className="ml-auto text-xs text-cyan-200">
              Line of inquiry: {current.assessmentPlanItem.ref} {current.assessmentPlanItem.prompt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
