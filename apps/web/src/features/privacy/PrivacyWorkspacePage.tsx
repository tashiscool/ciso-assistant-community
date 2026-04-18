import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { DataBreach, Processing, RightRequest } from './types';

const client = new ApiClient();

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
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
      setNotice('Data breach record created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBreachBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading privacy workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Privacy</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Privacy Operations</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Keep processing records, rights requests, and breach workflows in one place so privacy
          reviews can follow the same operational rhythm as the rest of the workspace.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-6 xl:grid-cols-3">
        <section className="panel">
          <div className="eyebrow">New Processing</div>
          <form
            className="mt-4 space-y-3"
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
                <input className="input" onChange={(event) => setProcessingName(event.target.value)} value={processingName} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setProcessingRefId(event.target.value)} value={processingRefId} />
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[92px]"
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
                  className="h-4 w-4 accent-cyan-400"
                  onChange={(event) => setProcessingDpiaRequired(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm text-slate-300">DPIA required</span>
              </label>
            </div>
            <button className="button-primary" disabled={processingBusy} type="submit">
              {processingBusy ? 'Creating...' : 'Create Processing'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">New Right Request</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createRightRequest();
            }}
          >
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
                <input className="input" onChange={(event) => setRequestName(event.target.value)} value={requestName} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setRequestRefId(event.target.value)} value={requestRefId} />
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
            <button className="button-primary" disabled={requestBusy} type="submit">
              {requestBusy ? 'Creating...' : 'Create Right Request'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">New Breach Record</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createBreach();
            }}
          >
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
                <input className="input" onChange={(event) => setBreachName(event.target.value)} value={breachName} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setBreachRefId(event.target.value)} value={breachRefId} />
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
            <button className="button-primary" disabled={breachBusy} type="submit">
              {breachBusy ? 'Creating...' : 'Create Breach Record'}
            </button>
          </form>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel">
          <div className="eyebrow">Processing Register</div>
          <div className="mt-4 space-y-3">
            {processings.map((processing) => (
              <Link
                key={processing.id}
                className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={`/privacy/processings/${processing.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-white">{processing.name}</div>
                  <span className="badge-neutral">{processing.status}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {processing.description || 'No processing description provided.'}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Rights Requests</div>
            <div className="mt-4 space-y-3">
              {rightRequests.map((request) => (
                <div className="panel-subtle" key={request.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{request.name}</div>
                    <span className="badge-neutral">{request.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {request.requestType} · requested {formatDate(request.requestedOn)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
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
                <div className="panel-subtle" key={breach.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{breach.name}</div>
                    <span className="badge-neutral">{breach.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {breach.riskLevel} · discovered {formatDateTime(breach.discoveredOn)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {breach.affectedSubjectsCount} subjects · {breach.affectedProcessings.map((item) => item.name).join(', ') || 'No linked processing'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
