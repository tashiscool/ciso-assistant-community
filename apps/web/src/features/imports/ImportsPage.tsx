import { useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { ImportJob } from './types';

const client = new ApiClient();

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ImportsPage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [folderId, setFolderId] = useState('');
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState('spreadsheet');
  const [targetKind, setTargetKind] = useState('risk_scenarios');
  const [rowCount, setRowCount] = useState('3');

  async function loadImports() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, importResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: ImportJob[] }>('/ops/imports'),
      ]);
      setFolders(folderResponse.data);
      setJobs(importResponse.data);
      if (!folderId && folderResponse.data[0]?.id) {
        setFolderId(folderResponse.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadImports();
  }, [identity.tenantId, identity.userId]);

  async function createImport() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: ImportJob }>('/ops/imports', {
        folderId,
        name,
        sourceType,
        targetKind,
        rowCount: Number(rowCount),
      });
      setName('');
      setNotice(`Import completed: ${response.data.name}`);
      await loadImports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading import pipelines...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Imports</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Import Pipelines</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Stage incoming workbook-style imports into the Cloudflare workspace and keep a durable
          audit trail of what was created.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="panel">
          <div className="eyebrow">New Import</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createImport();
            }}
          >
            <label className="space-y-1">
              <span className="label">Domain</span>
              <select className="input" onChange={(event) => setFolderId(event.target.value)} value={folderId}>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Job name</span>
              <input className="input" onChange={(event) => setName(event.target.value)} value={name} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">Source</span>
                <select className="input" onChange={(event) => setSourceType(event.target.value)} value={sourceType}>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Target</span>
                <select className="input" onChange={(event) => setTargetKind(event.target.value)} value={targetKind}>
                  <option value="risk_scenarios">Risk scenarios</option>
                  <option value="entities">Third-party entities</option>
                  <option value="processings">Privacy processings</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Rows</span>
                <input className="input" onChange={(event) => setRowCount(event.target.value)} value={rowCount} />
              </label>
            </div>
            <button className="button-primary" disabled={busy} type="submit">
              {busy ? 'Running...' : 'Run Import'}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          {jobs.map((job) => (
            <section key={job.id} className="panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{job.targetKind.replace(/_/g, ' ')}</div>
                  <h2 className="mt-2 text-xl font-semibold text-white">{job.name}</h2>
                  <div className="mt-2 text-sm text-slate-400">
                    {job.folderName} · {job.sourceType} · {formatDate(job.createdAt)}
                  </div>
                </div>
                <span className="badge-neutral">{job.status}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="metric-card">
                  <div className="metric-label">Rows</div>
                  <div className="metric-value">{job.rowCount}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Imported</div>
                  <div className="metric-value">{job.importedCount}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Errors</div>
                  <div className="metric-value">{job.errorCount}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="panel-subtle">
                  <div className="label">Pipeline steps</div>
                  <div className="mt-3 space-y-2">
                    {job.steps.map((step) => (
                      <div key={step.key} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>{step.label}</span>
                        <span className="badge-neutral">{step.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Created objects</div>
                  <div className="mt-3 space-y-2">
                    {job.createdObjects.map((item) => (
                      <div key={item.id} className="text-sm text-slate-300">
                        {item.name}
                      </div>
                    ))}
                    {job.createdObjects.length === 0 && (
                      <div className="text-sm text-slate-400">No objects were created for this run.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </section>
      </section>
    </div>
  );
}
