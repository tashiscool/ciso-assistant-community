import { useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';

type RiskRegister = {
  id: string;
  tenantId: string;
  folderId: string | null;
  folderName: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type RiskScenario = {
  id: string;
  tenantId: string;
  registerId: string;
  registerName: string;
  title: string;
  description: string | null;
  likelihood: number | null;
  impact: number | null;
  inherentScore: number | null;
  residualScore: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const client = new ApiClient();

export function RiskScenariosPage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [registers, setRegisters] = useState<RiskRegister[]>([]);
  const [scenarios, setScenarios] = useState<RiskScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [registerFolderId, setRegisterFolderId] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerDescription, setRegisterDescription] = useState('');
  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [likelihood, setLikelihood] = useState('3');
  const [impact, setImpact] = useState('4');
  const [status, setStatus] = useState('open');

  async function loadRiskWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, registerResponse, scenarioResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: RiskRegister[] }>('/core/risk-registers'),
        client.get<{ data: RiskScenario[] }>('/core/risk-scenarios'),
      ]);
      setFolders(folderResponse.data);
      setRegisters(registerResponse.data);
      setScenarios(scenarioResponse.data);
      if (!registerFolderId && folderResponse.data[0]?.id) {
        setRegisterFolderId(folderResponse.data[0].id);
      }
      if (!selectedRegisterId && registerResponse.data[0]?.id) {
        setSelectedRegisterId(registerResponse.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRiskWorkspace();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (!selectedRegisterId && registers[0]?.id) {
      setSelectedRegisterId(registers[0].id);
    }
  }, [registers, selectedRegisterId]);

  useEffect(() => {
    if (!registerFolderId && folders[0]?.id) {
      setRegisterFolderId(folders[0].id);
    }
  }, [folders, registerFolderId]);

  async function createRegister() {
    try {
      setRegisterBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: RiskRegister }>('/core/risk-registers', {
        folderId: registerFolderId,
        name: registerName,
        description: registerDescription,
      });
      setRegisterName('');
      setRegisterDescription('');
      setSelectedRegisterId(response.data.id);
      setNotice('Risk register added to the workspace.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRegisterBusy(false);
    }
  }

  async function createScenario() {
    try {
      setScenarioBusy(true);
      setNotice(null);
      await client.post('/core/risk-scenarios', {
        registerId: selectedRegisterId,
        title: scenarioTitle,
        description: scenarioDescription,
        likelihood: Number(likelihood),
        impact: Number(impact),
        status,
      });
      setScenarioTitle('');
      setScenarioDescription('');
      setLikelihood('3');
      setImpact('4');
      setStatus('open');
      setNotice('Risk scenario added to the workspace.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setScenarioBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading risk workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Risk</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Risk Scenarios</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Track registers and scenarios in one place so teams can see where risk is emerging and
          what deserves action first.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Registers</div>
            <div className="mt-4 grid gap-3">
              {registers.map((register) => (
                <div className="panel-subtle" key={register.id}>
                  <div className="font-medium text-white">{register.name}</div>
                  {register.folderName && (
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {register.folderName}
                    </div>
                  )}
                  <div className="mt-2 text-sm leading-6 text-slate-300">{register.description}</div>
                </div>
              ))}
              {registers.length === 0 && (
                <div className="text-sm text-slate-400">
                  No risk registers found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">New Register</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createRegister();
              }}
            >
              <label className="space-y-1">
                <span className="label">Domain</span>
                <select
                  className="input"
                  onChange={(event) => setRegisterFolderId(event.target.value)}
                  value={registerFolderId}
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.pathLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Register name</span>
                <input
                  className="input"
                  onChange={(event) => setRegisterName(event.target.value)}
                  placeholder="Enterprise Risk Register"
                  value={registerName}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Description</span>
                <textarea
                  className="input min-h-[92px]"
                  onChange={(event) => setRegisterDescription(event.target.value)}
                  placeholder="What scope or team does this register cover?"
                  value={registerDescription}
                />
              </label>
              <button className="button-primary" disabled={registerBusy} type="submit">
                {registerBusy ? 'Saving...' : 'Add Register'}
              </button>
              {folders.length === 0 && (
                <div className="text-sm text-slate-400">
                  No accessible domains are available for new risk registers.
                </div>
              )}
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">New Scenario</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createScenario();
              }}
            >
              <label className="space-y-1">
                <span className="label">Risk register</span>
                <select
                  className="input"
                  onChange={(event) => setSelectedRegisterId(event.target.value)}
                  value={selectedRegisterId}
                >
                  {registers.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Scenario title</span>
                <input
                  className="input"
                  onChange={(event) => setScenarioTitle(event.target.value)}
                  placeholder="Critical SaaS supplier outage"
                  value={scenarioTitle}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Description</span>
                <textarea
                  className="input min-h-[92px]"
                  onChange={(event) => setScenarioDescription(event.target.value)}
                  placeholder="What could go wrong, and what would it affect?"
                  value={scenarioDescription}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Likelihood</span>
                  <input
                    className="input"
                    max="5"
                    min="1"
                    onChange={(event) => setLikelihood(event.target.value)}
                    step="0.1"
                    type="number"
                    value={likelihood}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Impact</span>
                  <input
                    className="input"
                    max="5"
                    min="1"
                    onChange={(event) => setImpact(event.target.value)}
                    step="0.1"
                    type="number"
                    value={impact}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Status</span>
                  <select
                    className="input"
                    onChange={(event) => setStatus(event.target.value)}
                    value={status}
                  >
                    <option value="open">Open</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="mitigated">Mitigated</option>
                    <option value="accepted">Accepted</option>
                  </select>
                </label>
              </div>
              <button
                className="button-primary"
                disabled={scenarioBusy || registers.length === 0}
                type="submit"
              >
                {scenarioBusy ? 'Saving...' : 'Add Scenario'}
              </button>
            </form>
          </section>

          <section className="panel overflow-hidden p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Scenario</th>
                  <th className="px-4 py-3">Register</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scores</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{scenario.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{scenario.description}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{scenario.registerName}</td>
                    <td className="px-4 py-4">
                      <span className="badge-neutral">{scenario.status}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      <div>Likelihood: {scenario.likelihood ?? 'n/a'}</div>
                      <div>Impact: {scenario.impact ?? 'n/a'}</div>
                      <div>Inherent: {scenario.inherentScore ?? 'n/a'}</div>
                      <div>Residual: {scenario.residualScore ?? 'n/a'}</div>
                    </td>
                  </tr>
                ))}
                {scenarios.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                      No risk scenarios found for tenant <span className="font-mono">{identity.tenantId}</span>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </div>
  );
}
