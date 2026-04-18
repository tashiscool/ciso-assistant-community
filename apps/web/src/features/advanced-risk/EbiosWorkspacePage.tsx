import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { Perimeter } from '../assessments/types';
import type { ThirdPartyEntity } from '../tprm/types';
import type { EbiosStudy } from './types';

const client = new ApiClient();

export function EbiosWorkspacePage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [perimeters, setPerimeters] = useState<Perimeter[]>([]);
  const [entities, setEntities] = useState<ThirdPartyEntity[]>([]);
  const [studies, setStudies] = useState<EbiosStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [folderId, setFolderId] = useState('');
  const [perimeterId, setPerimeterId] = useState('');
  const [referenceEntityId, setReferenceEntityId] = useState('');
  const [name, setName] = useState('');
  const [refId, setRefId] = useState('');
  const [description, setDescription] = useState('');

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, perimeterResponse, entityResponse, studyResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: Perimeter[] }>('/core/perimeters'),
        client.get<{ data: ThirdPartyEntity[] }>('/core/entities'),
        client.get<{ data: EbiosStudy[] }>('/ops/ebios-studies'),
      ]);
      setFolders(folderResponse.data);
      setPerimeters(perimeterResponse.data);
      setEntities(entityResponse.data);
      setStudies(studyResponse.data);
      if (!folderId && folderResponse.data[0]?.id) {
        setFolderId(folderResponse.data[0].id);
      }
      if (!perimeterId && perimeterResponse.data[0]?.id) {
        setPerimeterId(perimeterResponse.data[0].id);
      }
      if (!referenceEntityId && entityResponse.data[0]?.id) {
        setReferenceEntityId(entityResponse.data[0].id);
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

  async function createStudy() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/ops/ebios-studies', {
        folderId,
        perimeterId,
        referenceEntityId,
        name,
        refId,
        description,
      });
      setName('');
      setRefId('');
      setDescription('');
      setNotice('EBIOS RM study created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading EBIOS workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Advanced Risk</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">EBIOS RM</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Facilitate workshop progression, feared events, strategic scenarios, and operational
          attack paths from the Cloudflare-native workspace.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <div className="eyebrow">New Study</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createStudy();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
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
                <span className="label">Perimeter</span>
                <select className="input" onChange={(event) => setPerimeterId(event.target.value)} value={perimeterId}>
                  {perimeters.map((perimeter) => (
                    <option key={perimeter.id} value={perimeter.id}>
                      {perimeter.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Reference entity</span>
              <select className="input" onChange={(event) => setReferenceEntityId(event.target.value)} value={referenceEntityId}>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Name</span>
                <input className="input" onChange={(event) => setName(event.target.value)} value={name} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setRefId(event.target.value)} value={refId} />
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea className="input min-h-[110px]" onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            <button className="button-primary" disabled={busy} type="submit">
              {busy ? 'Creating...' : 'Create EBIOS Study'}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          {studies.map((study) => (
            <Link
              key={study.id}
              className="panel block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
              to={`/advanced-risk/ebios/${study.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">{study.refId ?? 'EBIOS RM'}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{study.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {study.description || 'No EBIOS RM study description provided.'}
                  </p>
                </div>
                <span className="badge-neutral">{study.status}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Workshop progress</div>
                  <div className="metric-value">{study.metrics.workshopProgress}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Feared events</div>
                  <div className="metric-value">{study.metrics.fearedEvents}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Strategic scenarios</div>
                  <div className="metric-value">{study.metrics.strategicScenarios}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Operational scenarios</div>
                  <div className="metric-value">{study.metrics.operationalScenarios}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </section>
    </div>
  );
}
