import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
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
  const [studyDrawerOpen, setStudyDrawerOpen] = useState(false);

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
      setStudyDrawerOpen(false);
      setNotice('EBIOS RM study created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading EBIOS workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="eyebrow">Advanced Risk</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">EBIOS RM</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Facilitate workshop progression, feared events, strategic scenarios, and operational
              attack paths from the Cloudflare-native workspace.
            </p>
          </div>
          <button className="button-primary shrink-0" onClick={() => setStudyDrawerOpen(true)} type="button">
            <Plus className="mr-2 h-4 w-4" />
            Create EBIOS study
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="space-y-4">
          {studies.map((study) => (
            <Link
              key={study.id}
              className="panel block transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
              to={`/advanced-risk/ebios/${study.id}`}
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="eyebrow">{study.refId ?? 'EBIOS RM'}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{study.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                    {study.description || 'No EBIOS RM study description provided.'}
                  </p>
                </div>
                <RegStatusPill tone="neutral" className="shrink-0 capitalize">
                  {study.status}
                </RegStatusPill>
              </div>
              <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <RegRightDrawer
        description="Start a workshop-backed EBIOS RM study while keeping the existing perimeter, domain, and third-party entity mappings intact."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setStudyDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busy} form="ebios-create-study" type="submit">
              {busy ? 'Creating...' : 'Create EBIOS study'}
            </button>
          </div>
        }
        onOpenChange={setStudyDrawerOpen}
        open={studyDrawerOpen}
        title="Create EBIOS study"
      >
        <form
          className="space-y-4"
          id="ebios-create-study"
          onSubmit={(event) => {
            event.preventDefault();
            void createStudy();
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
            <span className="label">Perimeter</span>
            <select className="input" onChange={(event) => setPerimeterId(event.target.value)} value={perimeterId}>
              {perimeters.map((perimeter) => (
                <option key={perimeter.id} value={perimeter.id}>
                  {perimeter.name}
                </option>
              ))}
            </select>
          </label>
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
          <label className="space-y-1">
            <span className="label">Name</span>
            <input className="input" onChange={(event) => setName(event.target.value)} placeholder="Critical supplier continuity" value={name} />
          </label>
          <label className="space-y-1">
            <span className="label">Reference</span>
            <input className="input" onChange={(event) => setRefId(event.target.value)} placeholder="EBIOS-001" value={refId} />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea className="input min-h-[110px]" onChange={(event) => setDescription(event.target.value)} value={description} />
          </label>
        </form>
      </RegRightDrawer>
    </div>
  );
}
