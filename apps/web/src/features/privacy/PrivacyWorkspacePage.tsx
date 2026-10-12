import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { DataBreach, Processing, RightRequest } from './types';

const client = new ApiClient();
type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function formatDateForInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function formatDateTimeForInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
}

function toIsoTimestamp(value: string) {
  return value ? new Date(value).toISOString() : '';
}

function numericInputValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

export function PrivacyWorkspacePage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [processings, setProcessings] = useState<Processing[]>([]);
  const [rightRequests, setRightRequests] = useState<RightRequest[]>([]);
  const [breaches, setBreaches] = useState<DataBreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingBusy, setProcessingBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [breachBusy, setBreachBusy] = useState(false);
  const [processingDrawerOpen, setProcessingDrawerOpen] = useState(false);
  const [requestDrawerOpen, setRequestDrawerOpen] = useState(false);
  const [breachDrawerOpen, setBreachDrawerOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [inspectedProcessing, setInspectedProcessing] = useState<Processing | null>(null);
  const [editingProcessing, setEditingProcessing] = useState<Processing | null>(null);
  const [processingToDelete, setProcessingToDelete] = useState<Processing | null>(null);
  const [inspectedRequest, setInspectedRequest] = useState<RightRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<RightRequest | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<RightRequest | null>(null);
  const [inspectedBreach, setInspectedBreach] = useState<DataBreach | null>(null);
  const [editingBreach, setEditingBreach] = useState<DataBreach | null>(null);
  const [breachToDelete, setBreachToDelete] = useState<DataBreach | null>(null);

  const [processingFolderId, setProcessingFolderId] = useState('');
  const [processingName, setProcessingName] = useState('');
  const [processingRefId, setProcessingRefId] = useState('');
  const [processingStatus, setProcessingStatus] = useState('privacy_draft');
  const [processingDescription, setProcessingDescription] = useState('');
  const [processingDpiaRequired, setProcessingDpiaRequired] = useState(false);

  const [requestFolderId, setRequestFolderId] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestRefId, setRequestRefId] = useState('');
  const [requestType, setRequestType] = useState('access');
  const [requestStatus, setRequestStatus] = useState('new');
  const [requestedOn, setRequestedOn] = useState(new Date().toISOString().slice(0, 10));
  const [requestDueDate, setRequestDueDate] = useState('');
  const [requestProcessingId, setRequestProcessingId] = useState('');

  const [breachFolderId, setBreachFolderId] = useState('');
  const [breachName, setBreachName] = useState('');
  const [breachRefId, setBreachRefId] = useState('');
  const [breachType, setBreachType] = useState('privacy_other');
  const [breachRiskLevel, setBreachRiskLevel] = useState('privacy_risk');
  const [breachStatus, setBreachStatus] = useState('privacy_discovered');
  const [breachDiscoveredOn, setBreachDiscoveredOn] = useState(new Date().toISOString().slice(0, 16));
  const [breachProcessingId, setBreachProcessingId] = useState('');

  const [editProcessingName, setEditProcessingName] = useState('');
  const [editProcessingRefId, setEditProcessingRefId] = useState('');
  const [editProcessingStatus, setEditProcessingStatus] = useState('privacy_draft');
  const [editProcessingDescription, setEditProcessingDescription] = useState('');
  const [editProcessingInformationChannel, setEditProcessingInformationChannel] = useState('');
  const [editProcessingUsageChannel, setEditProcessingUsageChannel] = useState('');
  const [editProcessingDpiaRequired, setEditProcessingDpiaRequired] = useState(false);
  const [editProcessingDpiaReference, setEditProcessingDpiaReference] = useState('');

  const [editRequestName, setEditRequestName] = useState('');
  const [editRequestRefId, setEditRequestRefId] = useState('');
  const [editRequestType, setEditRequestType] = useState('access');
  const [editRequestStatus, setEditRequestStatus] = useState('new');
  const [editRequestedOn, setEditRequestedOn] = useState('');
  const [editRequestDueDate, setEditRequestDueDate] = useState('');
  const [editRequestProcessingId, setEditRequestProcessingId] = useState('');
  const [editRequestObservation, setEditRequestObservation] = useState('');

  const [editBreachName, setEditBreachName] = useState('');
  const [editBreachRefId, setEditBreachRefId] = useState('');
  const [editBreachType, setEditBreachType] = useState('privacy_other');
  const [editBreachRiskLevel, setEditBreachRiskLevel] = useState('privacy_risk');
  const [editBreachStatus, setEditBreachStatus] = useState('privacy_discovered');
  const [editBreachDiscoveredOn, setEditBreachDiscoveredOn] = useState('');
  const [editBreachProcessingId, setEditBreachProcessingId] = useState('');
  const [editBreachAffectedSubjectsCount, setEditBreachAffectedSubjectsCount] = useState('0');
  const [editBreachAffectedPersonalDataCount, setEditBreachAffectedPersonalDataCount] = useState('0');
  const [editBreachAuthorityNotifiedOn, setEditBreachAuthorityNotifiedOn] = useState('');
  const [editBreachSubjectsNotifiedOn, setEditBreachSubjectsNotifiedOn] = useState('');
  const [editBreachConsequences, setEditBreachConsequences] = useState('');
  const [editBreachObservation, setEditBreachObservation] = useState('');

  const domainFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'domain'),
    [folders],
  );

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, processingResponse, requestResponse, breachResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: Processing[] }>('/core/processings'),
        client.get<{ data: RightRequest[] }>('/core/right-requests'),
        client.get<{ data: DataBreach[] }>('/core/data-breaches'),
      ]);

      setFolders(folderResponse.data);
      setProcessings(processingResponse.data);
      setRightRequests(requestResponse.data);
      setBreaches(breachResponse.data);

      if (!processingFolderId && folderResponse.data[0]?.id) {
        setProcessingFolderId(folderResponse.data[0].id);
      }
      if (!requestFolderId && folderResponse.data[0]?.id) {
        setRequestFolderId(folderResponse.data[0].id);
      }
      if (!breachFolderId && folderResponse.data[0]?.id) {
        setBreachFolderId(folderResponse.data[0].id);
      }
      if (!requestProcessingId && processingResponse.data[0]?.id) {
        setRequestProcessingId(processingResponse.data[0].id);
      }
      if (!breachProcessingId && processingResponse.data[0]?.id) {
        setBreachProcessingId(processingResponse.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  function processingReference(processingId: string) {
    const selectedProcessing = processings.find((processing) => processing.id === processingId);
    return selectedProcessing ? [{ id: selectedProcessing.id, name: selectedProcessing.name }] : [];
  }

  function openProcessingEdit(processing: Processing) {
    setEditProcessingName(processing.name);
    setEditProcessingRefId(processing.refId ?? '');
    setEditProcessingStatus(processing.status);
    setEditProcessingDescription(processing.description ?? '');
    setEditProcessingInformationChannel(processing.informationChannel ?? '');
    setEditProcessingUsageChannel(processing.usageChannel ?? '');
    setEditProcessingDpiaRequired(processing.dpiaRequired);
    setEditProcessingDpiaReference(processing.dpiaReference ?? '');
    setEditingProcessing(processing);
  }

  function openRequestEdit(request: RightRequest) {
    setEditRequestName(request.name);
    setEditRequestRefId(request.refId ?? '');
    setEditRequestType(request.requestType);
    setEditRequestStatus(request.status);
    setEditRequestedOn(formatDateForInput(request.requestedOn));
    setEditRequestDueDate(formatDateForInput(request.dueDate));
    setEditRequestProcessingId(request.processings[0]?.id ?? '');
    setEditRequestObservation(request.observation ?? '');
    setEditingRequest(request);
  }

  function openBreachEdit(breach: DataBreach) {
    setEditBreachName(breach.name);
    setEditBreachRefId(breach.refId ?? '');
    setEditBreachType(breach.breachType);
    setEditBreachRiskLevel(breach.riskLevel);
    setEditBreachStatus(breach.status);
    setEditBreachDiscoveredOn(formatDateTimeForInput(breach.discoveredOn));
    setEditBreachProcessingId(breach.affectedProcessings[0]?.id ?? '');
    setEditBreachAffectedSubjectsCount(String(breach.affectedSubjectsCount));
    setEditBreachAffectedPersonalDataCount(String(breach.affectedPersonalDataCount));
    setEditBreachAuthorityNotifiedOn(formatDateTimeForInput(breach.authorityNotifiedOn));
    setEditBreachSubjectsNotifiedOn(formatDateTimeForInput(breach.subjectsNotifiedOn));
    setEditBreachConsequences(breach.potentialConsequences ?? '');
    setEditBreachObservation(breach.observation ?? '');
    setEditingBreach(breach);
  }

  async function createProcessing() {
    try {
      setProcessingBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/processings', {
        folderId: processingFolderId,
        refId: processingRefId,
        name: processingName,
        description: processingDescription,
        status: processingStatus,
        dpiaRequired: processingDpiaRequired,
      });
      setProcessingName('');
      setProcessingRefId('');
      setProcessingDescription('');
      setProcessingStatus('privacy_draft');
      setProcessingDpiaRequired(false);
      setProcessingDrawerOpen(false);
      setNotice('Processing register entry created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessingBusy(false);
    }
  }

  async function createRightRequest() {
    try {
      setRequestBusy(true);
      setError(null);
      setNotice(null);
      const selectedProcessing = processings.find((processing) => processing.id === requestProcessingId);
      await client.post('/core/right-requests', {
        folderId: requestFolderId,
        refId: requestRefId,
        name: requestName,
        requestType,
        status: requestStatus,
        requestedOn,
        dueDate: requestDueDate || null,
        processings: selectedProcessing
          ? [{ id: selectedProcessing.id, name: selectedProcessing.name }]
          : [],
      });
      setRequestName('');
      setRequestRefId('');
      setRequestType('access');
      setRequestStatus('new');
      setRequestDueDate('');
      setRequestDrawerOpen(false);
      setNotice('Right request created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRequestBusy(false);
    }
  }

  async function createBreach() {
    try {
      setBreachBusy(true);
      setError(null);
      setNotice(null);
      const selectedProcessing = processings.find((processing) => processing.id === breachProcessingId);
      await client.post('/core/data-breaches', {
        folderId: breachFolderId,
        refId: breachRefId,
        name: breachName,
        breachType,
        riskLevel: breachRiskLevel,
        status: breachStatus,
        discoveredOn: new Date(breachDiscoveredOn).toISOString(),
        affectedProcessings: selectedProcessing
          ? [{ id: selectedProcessing.id, name: selectedProcessing.name }]
          : [],
      });
      setBreachName('');
      setBreachRefId('');
      setBreachType('privacy_other');
      setBreachRiskLevel('privacy_risk');
      setBreachStatus('privacy_discovered');
      setBreachDrawerOpen(false);
      setNotice('Data breach record created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBreachBusy(false);
    }
  }

  async function updateProcessing() {
    if (!editingProcessing) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      await client.put(`/core/processings/${editingProcessing.id}`, {
        refId: editProcessingRefId,
        name: editProcessingName,
        description: editProcessingDescription,
        status: editProcessingStatus,
        informationChannel: editProcessingInformationChannel,
        usageChannel: editProcessingUsageChannel,
        dpiaRequired: editProcessingDpiaRequired,
        dpiaReference: editProcessingDpiaReference,
        perimeters: editingProcessing.perimeters,
      });
      setEditingProcessing(null);
      setNotice('Processing register entry updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  async function updateRightRequest() {
    if (!editingRequest) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      await client.put(`/core/right-requests/${editingRequest.id}`, {
        refId: editRequestRefId,
        name: editRequestName,
        requestType: editRequestType,
        status: editRequestStatus,
        requestedOn: editRequestedOn,
        dueDate: editRequestDueDate || null,
        observation: editRequestObservation,
        processings: processingReference(editRequestProcessingId),
      });
      setEditingRequest(null);
      setNotice('Right request updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  async function updateBreach() {
    if (!editingBreach) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      await client.put(`/core/data-breaches/${editingBreach.id}`, {
        refId: editBreachRefId,
        name: editBreachName,
        breachType: editBreachType,
        riskLevel: editBreachRiskLevel,
        status: editBreachStatus,
        discoveredOn: toIsoTimestamp(editBreachDiscoveredOn),
        affectedSubjectsCount: numericInputValue(editBreachAffectedSubjectsCount),
        affectedPersonalDataCount: numericInputValue(editBreachAffectedPersonalDataCount),
        affectedProcessings: processingReference(editBreachProcessingId),
        authorityNotifiedOn: editBreachAuthorityNotifiedOn ? toIsoTimestamp(editBreachAuthorityNotifiedOn) : null,
        subjectsNotifiedOn: editBreachSubjectsNotifiedOn ? toIsoTimestamp(editBreachSubjectsNotifiedOn) : null,
        potentialConsequences: editBreachConsequences,
        observation: editBreachObservation,
      });
      setEditingBreach(null);
      setNotice('Data breach record updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  async function deletePrivacyRecord(kind: 'processing' | 'request' | 'breach') {
    const target =
      kind === 'processing' ? processingToDelete : kind === 'request' ? requestToDelete : breachToDelete;
    if (!target) return;

    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      const resource =
        kind === 'processing' ? 'processings' : kind === 'request' ? 'right-requests' : 'data-breaches';
      await client.delete(`/core/${resource}/${target.id}`);
      setProcessingToDelete(null);
      setRequestToDelete(null);
      setBreachToDelete(null);
      setNotice(
        kind === 'processing'
          ? 'Processing register entry deleted.'
          : kind === 'request'
            ? 'Right request deleted.'
            : 'Data breach record deleted.',
      );
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading privacy workspace...</div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Privacy</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Privacy Operations</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Keep processing records, rights requests, and breach workflows in one place so privacy
              reviews can follow the same operational rhythm as the rest of the workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setRequestDrawerOpen(true)} type="button">
              New right request
            </button>
            <button className="button-secondary" onClick={() => setBreachDrawerOpen(true)} type="button">
              New breach record
            </button>
            <button className="button-primary" onClick={() => setProcessingDrawerOpen(true)} type="button">
              New processing
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Processings</div>
          <div className="metric-value">{processings.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Rights requests</div>
          <div className="metric-value">{rightRequests.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Breaches</div>
          <div className="metric-value">{breaches.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Sensitive registers</div>
          <div className="metric-value">
            {processings.filter((processing) => processing.hasSensitivePersonalData).length}
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel">
          <div className="eyebrow">Processing Register</div>
          <div className="mt-4 space-y-3">
            {processings.map((processing) => (
              <div
                key={processing.id}
                className="panel-subtle block min-w-0 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <Link
                    className="min-w-0 break-words text-lg font-semibold text-[#241232] transition hover:text-[#6d28d9]"
                    to={`/privacy/processings/${processing.id}`}
                  >
                    {processing.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <RegStatusPill tone={statusTone(processing.status)}>{processing.status}</RegStatusPill>
                    <RegActionMenu
                      actions={[
                        {
                          icon: Eye,
                          label: 'Open detail',
                          to: `/privacy/processings/${processing.id}`,
                        },
                        {
                          icon: Eye,
                          label: 'Inspect',
                          onSelect: () => setInspectedProcessing(processing),
                        },
                        {
                          icon: Pencil,
                          label: 'Edit',
                          onSelect: () => openProcessingEdit(processing),
                        },
                        {
                          destructive: true,
                          icon: Trash2,
                          label: 'Delete',
                          onSelect: () => setProcessingToDelete(processing),
                        },
                      ]}
                      label={`Open actions for ${processing.name}`}
                    />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#4f435c]">
                  {processing.description || 'No processing description provided.'}
                </p>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <div className="metric-card">
                    <div className="metric-label">Purposes</div>
                    <div className="metric-value">{processing.purposeCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Data types</div>
                    <div className="metric-value">{processing.personalDataCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Contractors</div>
                    <div className="metric-value">{processing.contractorCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Transfers</div>
                    <div className="metric-value">{processing.transferCount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <section className="panel">
            <div className="eyebrow">Rights Requests</div>
            <div className="mt-4 space-y-3">
              {rightRequests.map((request) => (
                <div className="panel-subtle min-w-0" key={request.id}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{request.name}</div>
                    <div className="flex shrink-0 items-center gap-2">
                      <RegStatusPill tone={statusTone(request.status)}>{request.status}</RegStatusPill>
                      <RegActionMenu
                        actions={[
                          {
                            icon: Eye,
                            label: 'Inspect',
                            onSelect: () => setInspectedRequest(request),
                          },
                          {
                            icon: Pencil,
                            label: 'Edit',
                            onSelect: () => openRequestEdit(request),
                          },
                          {
                            destructive: true,
                            icon: Trash2,
                            label: 'Delete',
                            onSelect: () => setRequestToDelete(request),
                          },
                        ]}
                        label={`Open actions for ${request.name}`}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[#6f6578]">
                    {request.requestType} · requested {formatDate(request.requestedOn)}
                  </div>
                  <div className="mt-2 text-xs text-[#62576a]">
                    Due {formatDate(request.dueDate)} · {request.processings.map((item) => item.name).join(', ') || 'No linked processing'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Breach Handling</div>
            <div className="mt-4 space-y-3">
              {breaches.map((breach) => (
                <div className="panel-subtle min-w-0" key={breach.id}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{breach.name}</div>
                    <div className="flex shrink-0 items-center gap-2">
                      <RegStatusPill tone={statusTone(breach.status)}>{breach.status}</RegStatusPill>
                      <RegActionMenu
                        actions={[
                          {
                            icon: Eye,
                            label: 'Inspect',
                            onSelect: () => setInspectedBreach(breach),
                          },
                          {
                            icon: Pencil,
                            label: 'Edit',
                            onSelect: () => openBreachEdit(breach),
                          },
                          {
                            destructive: true,
                            icon: Trash2,
                            label: 'Delete',
                            onSelect: () => setBreachToDelete(breach),
                          },
                        ]}
                        label={`Open actions for ${breach.name}`}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[#6f6578]">
                    {breach.riskLevel} · discovered {formatDateTime(breach.discoveredOn)}
                  </div>
                  <div className="mt-2 text-xs text-[#62576a]">
                    {breach.affectedSubjectsCount} subjects · {breach.affectedProcessings.map((item) => item.name).join(', ') || 'No linked processing'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <RegRightDrawer
        description="Create a processing register record in the selected privacy scope."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setProcessingDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={processingBusy || !processingName.trim()}
              form="privacy-processing-form"
              type="submit"
            >
              {processingBusy ? 'Creating...' : 'Create processing'}
            </button>
          </div>
        }
        onOpenChange={setProcessingDrawerOpen}
        open={processingDrawerOpen}
        title="New processing"
      >
        <form
          className="space-y-4"
          id="privacy-processing-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createProcessing();
          }}
        >
          <label className="space-y-1">
            <span className="label">Domain folder</span>
            <select className="input" onChange={(event) => setProcessingFolderId(event.target.value)} value={processingFolderId}>
              {domainFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input
                className="input"
                onChange={(event) => setProcessingName(event.target.value)}
                placeholder="Employee onboarding records"
                value={processingName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input
                className="input"
                onChange={(event) => setProcessingRefId(event.target.value)}
                placeholder="PROC-001"
                value={processingRefId}
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setProcessingDescription(event.target.value)}
              value={processingDescription}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setProcessingStatus(event.target.value)} value={processingStatus}>
                <option value="privacy_draft">Draft</option>
                <option value="privacy_in_review">In review</option>
                <option value="privacy_approved">Approved</option>
                <option value="privacy_deprecated">Deprecated</option>
              </select>
            </label>
            <label className="panel-subtle flex items-center gap-3 self-end">
              <input
                checked={processingDpiaRequired}
                className="h-4 w-4 accent-[#8b35e6]"
                onChange={(event) => setProcessingDpiaRequired(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm text-[#4f435c]">DPIA required</span>
            </label>
          </div>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Track a data subject request and link it to a processing record when applicable."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setRequestDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={requestBusy || !requestName.trim()}
              form="privacy-right-request-form"
              type="submit"
            >
              {requestBusy ? 'Creating...' : 'Create right request'}
            </button>
          </div>
        }
        onOpenChange={setRequestDrawerOpen}
        open={requestDrawerOpen}
        title="New right request"
      >
        <form
          className="space-y-4"
          id="privacy-right-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createRightRequest();
          }}
        >
          <label className="space-y-1">
            <span className="label">Domain folder</span>
            <select className="input" onChange={(event) => setRequestFolderId(event.target.value)} value={requestFolderId}>
              {domainFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Processing</span>
            <select className="input" onChange={(event) => setRequestProcessingId(event.target.value)} value={requestProcessingId}>
              <option value="">None linked</option>
              {processings.map((processing) => (
                <option key={processing.id} value={processing.id}>
                  {processing.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input
                className="input"
                onChange={(event) => setRequestName(event.target.value)}
                placeholder="Access request"
                value={requestName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input
                className="input"
                onChange={(event) => setRequestRefId(event.target.value)}
                placeholder="DSR-001"
                value={requestRefId}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Type</span>
              <select className="input" onChange={(event) => setRequestType(event.target.value)} value={requestType}>
                <option value="access">Access</option>
                <option value="deletion">Deletion</option>
                <option value="rectification">Rectification</option>
                <option value="portability">Portability</option>
                <option value="restriction">Restriction</option>
                <option value="objection">Objection</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setRequestStatus(event.target.value)} value={requestStatus}>
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="on_hold">On hold</option>
                <option value="done">Done</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Requested on</span>
              <input className="input" onChange={(event) => setRequestedOn(event.target.value)} type="date" value={requestedOn} />
            </label>
            <label className="space-y-1">
              <span className="label">Due date</span>
              <input className="input" onChange={(event) => setRequestDueDate(event.target.value)} type="date" value={requestDueDate} />
            </label>
          </div>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Record a privacy incident or data breach and link it to affected processing records."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setBreachDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={breachBusy || !breachName.trim()}
              form="privacy-breach-form"
              type="submit"
            >
              {breachBusy ? 'Creating...' : 'Create breach record'}
            </button>
          </div>
        }
        onOpenChange={setBreachDrawerOpen}
        open={breachDrawerOpen}
        title="New breach record"
      >
        <form
          className="space-y-4"
          id="privacy-breach-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createBreach();
          }}
        >
          <label className="space-y-1">
            <span className="label">Domain folder</span>
            <select className="input" onChange={(event) => setBreachFolderId(event.target.value)} value={breachFolderId}>
              {domainFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Linked processing</span>
            <select className="input" onChange={(event) => setBreachProcessingId(event.target.value)} value={breachProcessingId}>
              <option value="">None linked</option>
              {processings.map((processing) => (
                <option key={processing.id} value={processing.id}>
                  {processing.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input
                className="input"
                onChange={(event) => setBreachName(event.target.value)}
                placeholder="Unauthorized disclosure"
                value={breachName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input
                className="input"
                onChange={(event) => setBreachRefId(event.target.value)}
                placeholder="BREACH-001"
                value={breachRefId}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Type</span>
              <input className="input" onChange={(event) => setBreachType(event.target.value)} value={breachType} />
            </label>
            <label className="space-y-1">
              <span className="label">Risk</span>
              <input className="input" onChange={(event) => setBreachRiskLevel(event.target.value)} value={breachRiskLevel} />
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <input className="input" onChange={(event) => setBreachStatus(event.target.value)} value={breachStatus} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Discovered on</span>
            <input
              className="input"
              onChange={(event) => setBreachDiscoveredOn(event.target.value)}
              type="datetime-local"
              value={breachDiscoveredOn}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Review processing scope, DPIA state, and linked privacy metadata."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setInspectedProcessing(null)} type="button">
              Close
            </button>
            {inspectedProcessing ? (
              <Link className="button-primary" to={`/privacy/processings/${inspectedProcessing.id}`}>
                Open detail
              </Link>
            ) : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedProcessing(null);
        }}
        open={Boolean(inspectedProcessing)}
        title={inspectedProcessing?.name ?? 'Processing'}
      >
        {inspectedProcessing ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="label">Description</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedProcessing.description || 'No processing description provided.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Folder</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedProcessing.folderName}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Reference</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedProcessing.refId ?? 'n/a'}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">DPIA</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">
                  {inspectedProcessing.dpiaRequired ? inspectedProcessing.dpiaReference || 'Required' : 'Not required'}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Perimeters</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">
                  {inspectedProcessing.perimeters.map((item) => item.name).join(', ') || 'None'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Update register metadata without changing underlying privacy objects."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditingProcessing(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={actionBusy || !editProcessingName.trim()}
              form="privacy-processing-edit-form"
              type="submit"
            >
              {actionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setEditingProcessing(null);
        }}
        open={Boolean(editingProcessing)}
        title="Edit processing"
      >
        <form
          className="space-y-4"
          id="privacy-processing-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void updateProcessing();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input className="input" onChange={(event) => setEditProcessingName(event.target.value)} value={editProcessingName} />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input className="input" onChange={(event) => setEditProcessingRefId(event.target.value)} value={editProcessingRefId} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setEditProcessingDescription(event.target.value)}
              value={editProcessingDescription}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Status</span>
            <select className="input" onChange={(event) => setEditProcessingStatus(event.target.value)} value={editProcessingStatus}>
              <option value="privacy_draft">Draft</option>
              <option value="privacy_in_review">In review</option>
              <option value="privacy_approved">Approved</option>
              <option value="privacy_deprecated">Deprecated</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Information channel</span>
              <input
                className="input"
                onChange={(event) => setEditProcessingInformationChannel(event.target.value)}
                value={editProcessingInformationChannel}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Usage channel</span>
              <input
                className="input"
                onChange={(event) => setEditProcessingUsageChannel(event.target.value)}
                value={editProcessingUsageChannel}
              />
            </label>
          </div>
          <label className="panel-subtle flex items-center gap-3">
            <input
              checked={editProcessingDpiaRequired}
              className="h-4 w-4 accent-[#8b35e6]"
              onChange={(event) => setEditProcessingDpiaRequired(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm text-[#4f435c]">DPIA required</span>
          </label>
          <label className="space-y-1">
            <span className="label">DPIA reference</span>
            <input
              className="input"
              onChange={(event) => setEditProcessingDpiaReference(event.target.value)}
              value={editProcessingDpiaReference}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Review request timing, status, and linked processing."
        footer={
          <div className="flex justify-end">
            <button className="button-secondary" onClick={() => setInspectedRequest(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedRequest(null);
        }}
        open={Boolean(inspectedRequest)}
        title={inspectedRequest?.name ?? 'Right request'}
      >
        {inspectedRequest ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Type</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedRequest.requestType}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Reference</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedRequest.refId ?? 'n/a'}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Requested</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{formatDate(inspectedRequest.requestedOn)}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Due</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{formatDate(inspectedRequest.dueDate)}</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Linked processing</div>
              <p className="mt-2 text-sm text-[#4f435c]">
                {inspectedRequest.processings.map((item) => item.name).join(', ') || 'No linked processing'}
              </p>
            </div>
            <div className="panel-subtle">
              <div className="label">Observation</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedRequest.observation || 'No observations recorded.'}
              </p>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Update the right request status and tracking metadata."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditingRequest(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={actionBusy || !editRequestName.trim() || !editRequestedOn}
              form="privacy-right-request-edit-form"
              type="submit"
            >
              {actionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setEditingRequest(null);
        }}
        open={Boolean(editingRequest)}
        title="Edit right request"
      >
        <form
          className="space-y-4"
          id="privacy-right-request-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void updateRightRequest();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input className="input" onChange={(event) => setEditRequestName(event.target.value)} value={editRequestName} />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input className="input" onChange={(event) => setEditRequestRefId(event.target.value)} value={editRequestRefId} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Processing</span>
            <select className="input" onChange={(event) => setEditRequestProcessingId(event.target.value)} value={editRequestProcessingId}>
              <option value="">None linked</option>
              {processings.map((processing) => (
                <option key={processing.id} value={processing.id}>
                  {processing.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Type</span>
              <select className="input" onChange={(event) => setEditRequestType(event.target.value)} value={editRequestType}>
                <option value="access">Access</option>
                <option value="deletion">Deletion</option>
                <option value="rectification">Rectification</option>
                <option value="portability">Portability</option>
                <option value="restriction">Restriction</option>
                <option value="objection">Objection</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setEditRequestStatus(event.target.value)} value={editRequestStatus}>
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="on_hold">On hold</option>
                <option value="done">Done</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Requested on</span>
              <input className="input" onChange={(event) => setEditRequestedOn(event.target.value)} type="date" value={editRequestedOn} />
            </label>
            <label className="space-y-1">
              <span className="label">Due date</span>
              <input className="input" onChange={(event) => setEditRequestDueDate(event.target.value)} type="date" value={editRequestDueDate} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Observation</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setEditRequestObservation(event.target.value)}
              value={editRequestObservation}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Review breach status, notifications, and affected processing."
        footer={
          <div className="flex justify-end">
            <button className="button-secondary" onClick={() => setInspectedBreach(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedBreach(null);
        }}
        open={Boolean(inspectedBreach)}
        title={inspectedBreach?.name ?? 'Data breach'}
      >
        {inspectedBreach ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Risk level</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedBreach.riskLevel}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Type</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedBreach.breachType}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Discovered</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{formatDateTime(inspectedBreach.discoveredOn)}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Reference</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedBreach.refId ?? 'n/a'}</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Affected subjects</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedBreach.affectedSubjectsCount}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Affected data types</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedBreach.affectedPersonalDataCount}</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Affected processing</div>
              <p className="mt-2 text-sm text-[#4f435c]">
                {inspectedBreach.affectedProcessings.map((item) => item.name).join(', ') || 'No linked processing'}
              </p>
            </div>
            <div className="panel-subtle">
              <div className="label">Consequences</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedBreach.potentialConsequences || 'No consequences recorded.'}
              </p>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Update the breach record and notification trail."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditingBreach(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={actionBusy || !editBreachName.trim() || !editBreachDiscoveredOn}
              form="privacy-breach-edit-form"
              type="submit"
            >
              {actionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setEditingBreach(null);
        }}
        open={Boolean(editingBreach)}
        title="Edit breach record"
      >
        <form
          className="space-y-4"
          id="privacy-breach-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void updateBreach();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input className="input" onChange={(event) => setEditBreachName(event.target.value)} value={editBreachName} />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input className="input" onChange={(event) => setEditBreachRefId(event.target.value)} value={editBreachRefId} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Affected processing</span>
            <select className="input" onChange={(event) => setEditBreachProcessingId(event.target.value)} value={editBreachProcessingId}>
              <option value="">None linked</option>
              {processings.map((processing) => (
                <option key={processing.id} value={processing.id}>
                  {processing.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Type</span>
              <input className="input" onChange={(event) => setEditBreachType(event.target.value)} value={editBreachType} />
            </label>
            <label className="space-y-1">
              <span className="label">Risk</span>
              <input className="input" onChange={(event) => setEditBreachRiskLevel(event.target.value)} value={editBreachRiskLevel} />
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <input className="input" onChange={(event) => setEditBreachStatus(event.target.value)} value={editBreachStatus} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Discovered on</span>
              <input
                className="input"
                onChange={(event) => setEditBreachDiscoveredOn(event.target.value)}
                type="datetime-local"
                value={editBreachDiscoveredOn}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Subjects</span>
              <input
                className="input"
                min="0"
                onChange={(event) => setEditBreachAffectedSubjectsCount(event.target.value)}
                type="number"
                value={editBreachAffectedSubjectsCount}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Data types</span>
              <input
                className="input"
                min="0"
                onChange={(event) => setEditBreachAffectedPersonalDataCount(event.target.value)}
                type="number"
                value={editBreachAffectedPersonalDataCount}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Authority notified</span>
              <input
                className="input"
                onChange={(event) => setEditBreachAuthorityNotifiedOn(event.target.value)}
                type="datetime-local"
                value={editBreachAuthorityNotifiedOn}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Subjects notified</span>
              <input
                className="input"
                onChange={(event) => setEditBreachSubjectsNotifiedOn(event.target.value)}
                type="datetime-local"
                value={editBreachSubjectsNotifiedOn}
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Potential consequences</span>
            <textarea
              className="input min-h-[100px]"
              onChange={(event) => setEditBreachConsequences(event.target.value)}
              value={editBreachConsequences}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Observation</span>
            <textarea
              className="input min-h-[100px]"
              onChange={(event) => setEditBreachObservation(event.target.value)}
              value={editBreachObservation}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegModal
        description="This removes the processing register entry from the current tenant. Related history is not recreated by the UI."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setProcessingToDelete(null)} type="button">
              Cancel
            </button>
            <button className="button-danger" disabled={actionBusy} onClick={() => void deletePrivacyRecord('processing')} type="button">
              {actionBusy ? 'Deleting...' : 'Delete processing'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setProcessingToDelete(null);
        }}
        open={Boolean(processingToDelete)}
        title={`Delete ${processingToDelete?.name ?? 'processing'}?`}
      >
        <div className="notice-warning">Review this destructive action before continuing.</div>
      </RegModal>

      <RegModal
        description="This removes the rights request from the current tenant."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setRequestToDelete(null)} type="button">
              Cancel
            </button>
            <button className="button-danger" disabled={actionBusy} onClick={() => void deletePrivacyRecord('request')} type="button">
              {actionBusy ? 'Deleting...' : 'Delete right request'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setRequestToDelete(null);
        }}
        open={Boolean(requestToDelete)}
        title={`Delete ${requestToDelete?.name ?? 'right request'}?`}
      >
        <div className="notice-warning">The request will no longer appear in privacy operations.</div>
      </RegModal>

      <RegModal
        description="This removes the breach record from the current tenant."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setBreachToDelete(null)} type="button">
              Cancel
            </button>
            <button className="button-danger" disabled={actionBusy} onClick={() => void deletePrivacyRecord('breach')} type="button">
              {actionBusy ? 'Deleting...' : 'Delete breach record'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setBreachToDelete(null);
        }}
        open={Boolean(breachToDelete)}
        title={`Delete ${breachToDelete?.name ?? 'breach record'}?`}
      >
        <div className="notice-warning">The incident timeline entry will no longer be visible in this workspace.</div>
      </RegModal>
    </div>
  );
}
