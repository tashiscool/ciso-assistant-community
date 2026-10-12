import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Processing } from './types';

const client = new ApiClient();
type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

function statusTone(value: string): PillTone {
  const normalized = value.toLowerCase();
  if (normalized.includes('approved') || normalized.includes('done') || normalized.includes('complete')) {
    return 'success';
  }
  if (normalized.includes('deprecated') || normalized.includes('breach') || normalized.includes('risk')) {
    return 'danger';
  }
  if (normalized.includes('review') || normalized.includes('progress') || normalized.includes('hold')) {
    return 'warning';
  }
  if (normalized.includes('draft') || normalized.includes('new') || normalized.includes('discovered')) {
    return 'info';
  }
  return 'neutral';
}

export function ProcessingDetailPage() {
  const { identity } = useEdgeIdentity();
  const navigate = useNavigate();
  const { processingId = '' } = useParams();
  const [processing, setProcessing] = useState<Processing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRefId, setEditRefId] = useState('');
  const [editStatus, setEditStatus] = useState('privacy_draft');
  const [editDescription, setEditDescription] = useState('');
  const [editInformationChannel, setEditInformationChannel] = useState('');
  const [editUsageChannel, setEditUsageChannel] = useState('');
  const [editDpiaRequired, setEditDpiaRequired] = useState(false);
  const [editDpiaReference, setEditDpiaReference] = useState('');

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

  useEffect(() => {
    if (processingId) {
      void loadDetail();
    }
  }, [processingId, identity.tenantId]);

  function openEdit() {
    if (!processing) return;
    setEditName(processing.name);
    setEditRefId(processing.refId ?? '');
    setEditStatus(processing.status);
    setEditDescription(processing.description ?? '');
    setEditInformationChannel(processing.informationChannel ?? '');
    setEditUsageChannel(processing.usageChannel ?? '');
    setEditDpiaRequired(processing.dpiaRequired);
    setEditDpiaReference(processing.dpiaReference ?? '');
    setEditing(true);
  }

  async function updateProcessing() {
    if (!processing) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.put<{ data: Processing }>(`/core/processings/${processing.id}`, {
        refId: editRefId,
        name: editName,
        description: editDescription,
        status: editStatus,
        informationChannel: editInformationChannel,
        usageChannel: editUsageChannel,
        dpiaRequired: editDpiaRequired,
        dpiaReference: editDpiaReference,
        perimeters: processing.perimeters,
      });
      setProcessing(response.data);
      setEditing(false);
      setNotice('Processing register entry updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteProcessing() {
    if (!processing) return;
    try {
      setActionBusy(true);
      setError(null);
      await client.delete(`/core/processings/${processing.id}`);
      navigate('/privacy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading processing detail...</div>;
  }

  if (!processing) {
    return <div className="notice-error">{error ?? 'Processing detail is unavailable.'}</div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/privacy">
          Back to privacy workspace
        </Link>
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Processing</div>
            <h1 className="mt-2 break-words text-3xl font-semibold text-[#241232]">{processing.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RegStatusPill tone={statusTone(processing.status)}>{processing.status}</RegStatusPill>
            <RegActionMenu
              actions={[
                {
                  icon: Pencil,
                  label: 'Edit',
                  onSelect: openEdit,
                },
                {
                  destructive: true,
                  icon: Trash2,
                  label: 'Delete',
                  onSelect: () => setDeleteOpen(true),
                },
              ]}
              label={`Open actions for ${processing.name}`}
            />
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#4f435c]">
          {processing.description || 'No processing description provided.'}
        </p>
        <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
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
        <div className="mt-5 grid min-w-0 gap-3 text-sm text-[#4f435c] sm:grid-cols-2 2xl:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Folder</div>
            <div className="mt-2 font-medium text-[#241232]">{processing.folderName}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Reference</div>
            <div className="mt-2 font-medium text-[#241232]">{processing.refId ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">DPIA</div>
            <div className="mt-2 font-medium text-[#241232]">
              {processing.dpiaRequired ? processing.dpiaReference ?? 'Required' : 'Not required'}
            </div>
          </div>
          <div className="panel-subtle">
            <div className="label">Sensitive data</div>
            <div className="mt-2 font-medium text-[#241232]">
              {processing.hasSensitivePersonalData ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 gap-6 2xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Purposes & Lawful Basis</div>
          <div className="mt-4 space-y-3">
            {processing.purposes.map((purpose) => (
              <div className="panel-subtle" key={purpose.id}>
                <div className="text-sm font-medium text-[#241232]">{purpose.name}</div>
                <div className="mt-2 text-sm text-[#6f6578]">Legal basis: {purpose.legalBasis}</div>
                {purpose.article9Condition && (
                  <div className="mt-1 text-xs text-[#62576a]">
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
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{item.name}</div>
                  <RegStatusPill tone={item.isSensitive ? 'danger' : 'neutral'}>
                    {item.isSensitive ? 'Sensitive' : 'Standard'}
                  </RegStatusPill>
                </div>
                <div className="mt-2 text-sm text-[#6f6578]">{item.category}</div>
                <div className="mt-2 text-xs text-[#62576a]">
                  Retention {item.retention ?? 'n/a'} · {item.deletionPolicy ?? 'No deletion policy'}
                </div>
              </div>
            ))}
            <div className="panel-subtle">
              <div className="label">Data subjects</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {processing.dataSubjects.map((subject) => (
                  <RegStatusPill key={subject.id} tone="neutral">
                    {subject.name}
                  </RegStatusPill>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="grid min-w-0 gap-6 2xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Recipients & Contractors</div>
          <div className="mt-4 space-y-3">
            {processing.dataRecipients.map((recipient) => (
              <div className="panel-subtle" key={recipient.id}>
                <div className="text-sm font-medium text-[#241232]">{recipient.name}</div>
                <div className="mt-2 text-xs text-[#62576a]">{recipient.category}</div>
              </div>
            ))}
            {processing.dataContractors.map((contractor) => (
              <div className="panel-subtle" key={contractor.id}>
                <div className="text-sm font-medium text-[#241232]">{contractor.name}</div>
                <div className="mt-2 text-sm text-[#6f6578]">
                  {contractor.relationshipType} · {contractor.country ?? 'n/a'}
                </div>
                <div className="mt-2 text-xs text-[#62576a]">
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
                <div className="text-sm font-medium text-[#241232]">{transfer.name}</div>
                <div className="mt-2 text-sm text-[#6f6578]">
                  {transfer.country ?? 'n/a'} · {transfer.transferMechanism ?? 'No mechanism'}
                </div>
                <div className="mt-2 text-xs leading-5 text-[#62576a]">
                  {transfer.guarantees ?? 'No safeguard notes recorded.'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <RegRightDrawer
        description="Update processing metadata and DPIA tracking fields."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditing(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={actionBusy || !editName.trim()}
              form="processing-detail-edit-form"
              type="submit"
            >
              {actionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={setEditing}
        open={editing}
        title="Edit processing"
      >
        <form
          className="space-y-4"
          id="processing-detail-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void updateProcessing();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input className="input" onChange={(event) => setEditName(event.target.value)} value={editName} />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input className="input" onChange={(event) => setEditRefId(event.target.value)} value={editRefId} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setEditDescription(event.target.value)}
              value={editDescription}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Status</span>
            <select className="input" onChange={(event) => setEditStatus(event.target.value)} value={editStatus}>
              <option value="privacy_draft">Draft</option>
              <option value="privacy_in_review">In review</option>
              <option value="privacy_approved">Approved</option>
              <option value="privacy_deprecated">Deprecated</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Information channel</span>
              <input className="input" onChange={(event) => setEditInformationChannel(event.target.value)} value={editInformationChannel} />
            </label>
            <label className="space-y-1">
              <span className="label">Usage channel</span>
              <input className="input" onChange={(event) => setEditUsageChannel(event.target.value)} value={editUsageChannel} />
            </label>
          </div>
          <label className="panel-subtle flex items-center gap-3">
            <input
              checked={editDpiaRequired}
              className="h-4 w-4 accent-[#8b35e6]"
              onChange={(event) => setEditDpiaRequired(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm text-[#4f435c]">DPIA required</span>
          </label>
          <label className="space-y-1">
            <span className="label">DPIA reference</span>
            <input className="input" onChange={(event) => setEditDpiaReference(event.target.value)} value={editDpiaReference} />
          </label>
        </form>
      </RegRightDrawer>

      <RegModal
        description="This removes the processing register entry from the current tenant."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setDeleteOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-danger" disabled={actionBusy} onClick={() => void deleteProcessing()} type="button">
              {actionBusy ? 'Deleting...' : 'Delete processing'}
            </button>
          </div>
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={`Delete ${processing.name}?`}
      >
        <div className="notice-warning">Review this destructive action before continuing.</div>
      </RegModal>
    </div>
  );
}
