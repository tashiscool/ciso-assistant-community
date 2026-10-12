import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { RiskRegister } from '../assessments/types';
import type { QuantitativeStudy } from './types';

const client = new ApiClient();

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function QuantitativeWorkspacePage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [registers, setRegisters] = useState<RiskRegister[]>([]);
  const [studies, setStudies] = useState<QuantitativeStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studyDrawerOpen, setStudyDrawerOpen] = useState(false);

  const [folderId, setFolderId] = useState('');
  const [riskRegisterId, setRiskRegisterId] = useState('');
  const [name, setName] = useState('');
  const [refId, setRefId] = useState('');
  const [description, setDescription] = useState('');
  const [lossThreshold, setLossThreshold] = useState('400000');

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, registerResponse, studyResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: RiskRegister[] }>('/core/risk-registers'),
        client.get<{ data: QuantitativeStudy[] }>('/ops/quantitative-studies'),
      ]);
      setFolders(folderResponse.data);
      setRegisters(registerResponse.data);
      setStudies(studyResponse.data);
      if (!folderId && folderResponse.data[0]?.id) {
        setFolderId(folderResponse.data[0].id);
      }
      if (!riskRegisterId && registerResponse.data[0]?.id) {
        setRiskRegisterId(registerResponse.data[0].id);
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
      await client.post('/ops/quantitative-studies', {
        folderId,
        riskRegisterId,
        name,
        refId,
        description,
        lossThreshold: Number(lossThreshold),
      });
      setName('');
      setRefId('');
      setDescription('');
      setStudyDrawerOpen(false);
      setNotice('Quantitative study created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading quantitative risk workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="eyebrow">Advanced Risk</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Quantitative Studies</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Model ALE, compare current and residual exposure, and turn economic scenarios into an
              executable treatment roadmap.
            </p>
          </div>
          <button className="button-primary shrink-0" onClick={() => setStudyDrawerOpen(true)} type="button">
            <Plus className="mr-2 h-4 w-4" />
            Create quantitative study
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
              to={`/advanced-risk/quantitative/${study.id}`}
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="eyebrow">{study.refId ?? 'Quantitative Study'}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{study.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                    {study.description || 'No quantitative study description provided.'}
                  </p>
                </div>
                <RegStatusPill tone="neutral" className="shrink-0 capitalize">
                  {study.status}
                </RegStatusPill>
              </div>
              <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Current ALE</div>
                  <div className="mt-3 text-sm font-semibold text-[#241232]">
                    {formatCurrency(study.metrics.currentAleCombined, study.currency)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Residual ALE</div>
                  <div className="mt-3 text-sm font-semibold text-[#241232]">
                    {formatCurrency(study.metrics.residualAleCombined, study.currency)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Risk reduction</div>
                  <div className="mt-3 text-sm font-semibold text-[#241232]">
                    {formatCurrency(study.metrics.riskReduction, study.currency)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Scenarios</div>
                  <div className="metric-value">{study.metrics.totalScenarios}</div>
                </div>
              </div>
            </Link>
          ))}
      </section>

      <RegRightDrawer
        description="Start a quantitative risk study while preserving the existing domain, register, and loss-threshold model."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setStudyDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busy} form="quantitative-create-study" type="submit">
              {busy ? 'Creating...' : 'Create quantitative study'}
            </button>
          </div>
        }
        onOpenChange={setStudyDrawerOpen}
        open={studyDrawerOpen}
        title="Create quantitative study"
      >
        <form
          className="space-y-4"
          id="quantitative-create-study"
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
            <span className="label">Risk register</span>
            <select className="input" onChange={(event) => setRiskRegisterId(event.target.value)} value={riskRegisterId}>
              {registers.map((register) => (
                <option key={register.id} value={register.id}>
                  {register.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Name</span>
            <input className="input" onChange={(event) => setName(event.target.value)} placeholder="Annualized loss exposure model" value={name} />
          </label>
          <label className="space-y-1">
            <span className="label">Reference</span>
            <input className="input" onChange={(event) => setRefId(event.target.value)} placeholder="QRA-001" value={refId} />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea className="input min-h-[110px]" onChange={(event) => setDescription(event.target.value)} value={description} />
          </label>
          <label className="space-y-1">
            <span className="label">Loss threshold</span>
            <input className="input" onChange={(event) => setLossThreshold(event.target.value)} value={lossThreshold} />
          </label>
        </form>
      </RegRightDrawer>
    </div>
  );
}
