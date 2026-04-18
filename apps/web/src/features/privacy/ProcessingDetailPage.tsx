import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Processing } from './types';

const client = new ApiClient();

export function ProcessingDetailPage() {
  const { identity } = useEdgeIdentity();
  const { processingId = '' } = useParams();
  const [processing, setProcessing] = useState<Processing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{ data: Processing }>(`/core/processings/${processingId}`);
        setProcessing(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (processingId) {
      void loadDetail();
    }
  }, [processingId, identity.tenantId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading processing detail...</div>;
  }

  if (!processing) {
    return <div className="notice-error">{error ?? 'Processing detail is unavailable.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/privacy">
          Back to privacy workspace
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">Processing</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{processing.name}</h1>
          </div>
          <span className="badge-neutral">{processing.status}</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
          {processing.description || 'No processing description provided.'}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Purposes</div>
            <div className="metric-value">{processing.purposeCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Personal data</div>
            <div className="metric-value">{processing.personalDataCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Recipients</div>
            <div className="metric-value">{processing.dataRecipients.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Transfers</div>
            <div className="metric-value">{processing.transferCount}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Folder</div>
            <div className="mt-2 font-medium text-white">{processing.folderName}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Reference</div>
            <div className="mt-2 font-medium text-white">{processing.refId ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">DPIA</div>
            <div className="mt-2 font-medium text-white">
              {processing.dpiaRequired ? processing.dpiaReference ?? 'Required' : 'Not required'}
            </div>
          </div>
          <div className="panel-subtle">
            <div className="label">Sensitive data</div>
            <div className="mt-2 font-medium text-white">
              {processing.hasSensitivePersonalData ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Purposes & Lawful Basis</div>
          <div className="mt-4 space-y-3">
            {processing.purposes.map((purpose) => (
              <div className="panel-subtle" key={purpose.id}>
                <div className="text-sm font-medium text-white">{purpose.name}</div>
                <div className="mt-2 text-sm text-slate-400">Legal basis: {purpose.legalBasis}</div>
                {purpose.article9Condition && (
                  <div className="mt-1 text-xs text-slate-500">
                    Article 9 condition: {purpose.article9Condition}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Personal Data & Subjects</div>
          <div className="mt-4 space-y-3">
            {processing.personalData.map((item) => (
              <div className="panel-subtle" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <span className={item.isSensitive ? 'badge-danger' : 'badge-neutral'}>
                    {item.isSensitive ? 'Sensitive' : 'Standard'}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-400">{item.category}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Retention {item.retention ?? 'n/a'} · {item.deletionPolicy ?? 'No deletion policy'}
                </div>
              </div>
            ))}
            <div className="panel-subtle">
              <div className="label">Data subjects</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {processing.dataSubjects.map((subject) => (
                  <span className="badge-neutral" key={subject.id}>
                    {subject.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Recipients & Contractors</div>
          <div className="mt-4 space-y-3">
            {processing.dataRecipients.map((recipient) => (
              <div className="panel-subtle" key={recipient.id}>
                <div className="text-sm font-medium text-white">{recipient.name}</div>
                <div className="mt-2 text-xs text-slate-500">{recipient.category}</div>
              </div>
            ))}
            {processing.dataContractors.map((contractor) => (
              <div className="panel-subtle" key={contractor.id}>
                <div className="text-sm font-medium text-white">{contractor.name}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {contractor.relationshipType} · {contractor.country ?? 'n/a'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Linked entity: {contractor.entity?.name ?? 'None'} ·{' '}
                  {contractor.documentationLink ?? 'No documentation link'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Transfers</div>
          <div className="mt-4 space-y-3">
            {processing.dataTransfers.map((transfer) => (
              <div className="panel-subtle" key={transfer.id}>
                <div className="text-sm font-medium text-white">{transfer.name}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {transfer.country ?? 'n/a'} · {transfer.transferMechanism ?? 'No mechanism'}
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {transfer.guarantees ?? 'No safeguard notes recorded.'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
