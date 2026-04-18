import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { ThirdPartyEntityDetail } from './types';

const client = new ApiClient();

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatMoney(amount: number | null | undefined, currency = 'USD') {
  if (amount == null) {
    return 'n/a';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function EntityDetailPage() {
  const { identity } = useEdgeIdentity();
  const { entityId = '' } = useParams();
  const [detail, setDetail] = useState<ThirdPartyEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{ data: ThirdPartyEntityDetail }>(`/core/entities/${entityId}`);
        setDetail(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (entityId) {
      void loadDetail();
    }
  }, [entityId, identity.tenantId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading entity detail...</div>;
  }

  if (!detail) {
    return <div className="notice-error">{error ?? 'Entity detail is unavailable.'}</div>;
  }

  const { entity, solutions, contracts, assessments } = detail;

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/third-party">
          Back to third-party workspace
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">Entity</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{entity.name}</h1>
          </div>
          <span className={entity.isActive ? 'badge-success' : 'badge-neutral'}>
            {entity.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
          {entity.description || 'No entity description provided for this third-party record.'}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Default criticality</div>
            <div className="metric-value">{entity.defaultCriticality}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Solutions</div>
            <div className="metric-value">{solutions.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Contracts</div>
            <div className="metric-value">{contracts.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Assessments</div>
            <div className="metric-value">{assessments.length}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Relationship</div>
            <div className="mt-2 font-medium text-white">{entity.relationship ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Country / Currency</div>
            <div className="mt-2 font-medium text-white">
              {entity.country ?? 'n/a'} / {entity.currency ?? 'n/a'}
            </div>
          </div>
          <div className="panel-subtle">
            <div className="label">Parent entity</div>
            <div className="mt-2 font-medium text-white">{entity.parentEntityName ?? 'None'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Reference</div>
            <div className="mt-2 font-medium text-white">{entity.refId ?? 'n/a'}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Solutions</div>
          <div className="mt-4 space-y-3">
            {solutions.map((solution) => (
              <div className="panel-subtle" key={solution.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{solution.name}</div>
                  <span className="badge-neutral">Criticality {solution.criticality}</span>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {solution.recipientEntityName ?? 'No recipient'} · {solution.doraIctServiceType ?? 'n/a'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Assets: {solution.assetRefs.join(', ') || 'None listed'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Contracts</div>
          <div className="mt-4 space-y-3">
            {contracts.map((contract) => (
              <div className="panel-subtle" key={contract.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{contract.name}</div>
                  <span className="badge-neutral">{contract.status}</span>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {formatMoney(contract.annualExpense, contract.currency ?? 'USD')} · ends{' '}
                  {formatDate(contract.endDate)}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Solutions: {contract.solutions.map((solution) => solution.name).join(', ') || 'None'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="eyebrow">Assessment Coverage</div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {assessments.map((assessment) => (
            <div className="panel-subtle" key={assessment.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white">{assessment.name}</div>
                <span className="badge-neutral">{assessment.conclusion ?? assessment.status}</span>
              </div>
              <div className="mt-2 text-sm text-slate-400">
                {assessment.perimeterName ?? 'No perimeter'} · linked review{' '}
                {assessment.complianceAssessmentName ?? 'none'}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Dependency</div>
                  <div className="metric-value">{assessment.dependency}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Penetration</div>
                  <div className="metric-value">{assessment.penetration}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Maturity</div>
                  <div className="metric-value">{assessment.maturity}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Trust</div>
                  <div className="metric-value">{assessment.trust}</div>
                </div>
              </div>
              {assessment.notes && <p className="mt-3 text-sm leading-6 text-slate-300">{assessment.notes}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
