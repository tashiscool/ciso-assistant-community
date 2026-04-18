import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { EbiosStudy, EbiosWorkshopStep } from './types';

const client = new ApiClient();

export function EbiosStudyDetailPage() {
  const { identity } = useEdgeIdentity();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<EbiosStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStudy() {
    if (!studyId) {
      setError('EBIOS study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: EbiosStudy }>(`/ops/ebios-studies/${studyId}`);
      setStudy(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudy();
  }, [identity.tenantId, identity.userId, studyId]);

  async function updateStep(workshopId: string, step: EbiosWorkshopStep, status: EbiosWorkshopStep['status']) {
    if (!studyId) {
      return;
    }

    try {
      setBusyId(step.id);
      setError(null);
      await client.post(`/ops/ebios-studies/${studyId}/workshops/${workshopId}/${step.id}`, {
        status,
      });
      await loadStudy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading EBIOS study...</div>;
  }

  if (!study) {
    return <div className="notice-error">EBIOS study not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/advanced-risk/ebios">
            Back to EBIOS workspace
          </Link>
          <div className="eyebrow mt-4">{study.refId ?? 'EBIOS RM'}</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{study.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {study.description || 'No EBIOS RM study description provided.'}
          </p>
        </div>
        <div className="panel-subtle grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Perimeter</div>
            <div className="mt-3 text-sm font-semibold text-white">{study.perimeterName ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Reference entity</div>
            <div className="mt-3 text-sm font-semibold text-white">{study.referenceEntityName ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Status</div>
            <div className="mt-3 text-sm font-semibold capitalize text-white">{study.status.replace(/_/g, ' ')}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Workshop progress</div>
            <div className="metric-value">{study.metrics.workshopProgress}%</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          {study.workshops.map((workshop) => (
            <section key={workshop.id} className="panel">
              <div className="eyebrow">{workshop.label}</div>
              <div className="mt-4 space-y-3">
                {workshop.steps.map((step) => (
                  <div key={step.id} className="panel-subtle flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{step.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{step.status.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['to_do', 'in_progress', 'done'] as const).map((status) => (
                        <button
                          key={status}
                          className={status === step.status ? 'button-primary' : 'button-secondary'}
                          disabled={busyId === step.id}
                          onClick={() => void updateStep(workshop.id, step, status)}
                          type="button"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Feared Events</div>
            <div className="mt-4 space-y-3">
              {study.fearedEvents.map((item) => (
                <div key={item.id} className="panel-subtle">
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="mt-2 text-sm text-slate-300">Gravity: {item.gravity}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.assets.map((asset) => (
                      <span key={asset} className="badge-neutral">
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Stakeholders and Scenarios</div>
            <div className="mt-4 space-y-3">
              {study.stakeholders.map((stakeholder) => (
                <div key={stakeholder.id} className="panel-subtle">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{stakeholder.name}</div>
                    <span className="badge-neutral">{stakeholder.category}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">Dependency rating: {stakeholder.dependency}</div>
                </div>
              ))}
              {study.strategicScenarios.map((scenario) => (
                <div key={scenario.id} className="panel-subtle">
                  <div className="font-medium text-white">{scenario.name}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    Attacker: {scenario.attacker} · Priority: {scenario.priority}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
    </div>
  );
}
