import { useEffect, useState } from 'react';
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

function scoreLabel(value: number | null) {
  return value == null ? 'n/a' : Number(value).toFixed(value % 1 === 0 ? 0 : 1);
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const normalized = status.toLowerCase();
  if (normalized.includes('mitigated') || normalized.includes('accepted') || normalized.includes('closed')) {
    return 'success';
  }
  if (normalized.includes('monitor') || normalized.includes('review')) {
    return 'warning';
  }
  if (normalized.includes('blocked') || normalized.includes('critical')) {
    return 'danger';
  }
  if (normalized.includes('open')) {
    return 'info';
  }
  return 'neutral';
}

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
  const [registerActionBusy, setRegisterActionBusy] = useState(false);
  const [scenarioActionBusy, setScenarioActionBusy] = useState(false);
  const [registerDrawerOpen, setRegisterDrawerOpen] = useState(false);
  const [scenarioDrawerOpen, setScenarioDrawerOpen] = useState(false);
  const [inspectedRegister, setInspectedRegister] = useState<RiskRegister | null>(null);
  const [editingRegister, setEditingRegister] = useState<RiskRegister | null>(null);
  const [registerToDelete, setRegisterToDelete] = useState<RiskRegister | null>(null);
  const [inspectedScenario, setInspectedScenario] = useState<RiskScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<RiskScenario | null>(null);
  const [scenarioToDelete, setScenarioToDelete] = useState<RiskScenario | null>(null);
  const [registerFolderId, setRegisterFolderId] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerDescription, setRegisterDescription] = useState('');
  const [editRegisterFolderId, setEditRegisterFolderId] = useState('');
  const [editRegisterName, setEditRegisterName] = useState('');
  const [editRegisterDescription, setEditRegisterDescription] = useState('');
  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [likelihood, setLikelihood] = useState('3');
  const [impact, setImpact] = useState('4');
  const [status, setStatus] = useState('open');
  const [editScenarioTitle, setEditScenarioTitle] = useState('');
  const [editScenarioDescription, setEditScenarioDescription] = useState('');
  const [editLikelihood, setEditLikelihood] = useState('3');
  const [editImpact, setEditImpact] = useState('4');
  const [editStatus, setEditStatus] = useState('open');

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
      setRegisterDrawerOpen(false);
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
      setScenarioDrawerOpen(false);
      setNotice('Risk scenario added to the workspace.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setScenarioBusy(false);
    }
  }

  function openRegisterEdit(register: RiskRegister) {
    setEditingRegister(register);
    setEditRegisterFolderId(register.folderId ?? '');
    setEditRegisterName(register.name);
    setEditRegisterDescription(register.description ?? '');
  }

  async function updateRegister() {
    if (!editingRegister) return;
    try {
      setRegisterActionBusy(true);
      setError(null);
      setNotice(null);
      await client.put(`/core/risk-registers/${editingRegister.id}`, {
        folderId: editRegisterFolderId || editingRegister.folderId,
        name: editRegisterName,
        description: editRegisterDescription,
      });
      setEditingRegister(null);
      setNotice('Risk register updated.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRegisterActionBusy(false);
    }
  }

  async function deleteRegister() {
    if (!registerToDelete) return;
    try {
      setRegisterActionBusy(true);
      setError(null);
      setNotice(null);
      await client.delete(`/core/risk-registers/${registerToDelete.id}`);
      setRegisterToDelete(null);
      setNotice('Risk register removed.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRegisterActionBusy(false);
    }
  }

  function openScenarioEdit(scenario: RiskScenario) {
    setEditingScenario(scenario);
    setEditScenarioTitle(scenario.title);
    setEditScenarioDescription(scenario.description ?? '');
    setEditLikelihood(String(scenario.likelihood ?? 3));
    setEditImpact(String(scenario.impact ?? 4));
    setEditStatus(scenario.status || 'open');
  }

  async function updateScenario() {
    if (!editingScenario) return;
    try {
      setScenarioActionBusy(true);
      setError(null);
      setNotice(null);
      await client.put(`/core/risk-scenarios/${editingScenario.id}`, {
        title: editScenarioTitle,
        description: editScenarioDescription,
        likelihood: editLikelihood ? Number(editLikelihood) : null,
        impact: editImpact ? Number(editImpact) : null,
        status: editStatus,
      });
      setEditingScenario(null);
      setNotice('Risk scenario updated.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setScenarioActionBusy(false);
    }
  }

  async function deleteScenario() {
    if (!scenarioToDelete) return;
    try {
      setScenarioActionBusy(true);
      setError(null);
      setNotice(null);
      await client.delete(`/core/risk-scenarios/${scenarioToDelete.id}`);
      setScenarioToDelete(null);
      setNotice('Risk scenario removed.');
      await loadRiskWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setScenarioActionBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#51465e]">Loading risk workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Risk</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Risk Scenarios</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#51465e]">
              Track registers and scenarios in one place so teams can see where risk is emerging and
              what deserves action first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-secondary"
              onClick={() => setRegisterDrawerOpen(true)}
              type="button"
            >
              Add register
            </button>
            <button
              className="button-primary"
              disabled={registers.length === 0}
              onClick={() => setScenarioDrawerOpen(true)}
              type="button"
            >
              Add scenario
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <section className="panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Registers</div>
                <h2 className="mt-2 text-xl font-semibold text-[#241232]">Risk registers</h2>
              </div>
              <button
                className="button-secondary shrink-0"
                onClick={() => setRegisterDrawerOpen(true)}
                type="button"
              >
                New
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {registers.map((register) => (
                <div className="panel-subtle" key={register.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#241232]">{register.name}</div>
                    </div>
                    <RegActionMenu
                      actions={[
                        {
                          label: 'Inspect register',
                          icon: Eye,
                          onSelect: () => setInspectedRegister(register),
                        },
                        {
                          label: 'Edit register',
                          icon: Pencil,
                          onSelect: () => openRegisterEdit(register),
                        },
                        {
                          label: 'Delete register',
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => setRegisterToDelete(register),
                        },
                      ]}
                      label={`Open actions for ${register.name}`}
                    />
                  </div>
                  {register.folderName && (
                    <RegStatusPill className="mt-3" tone="neutral">
                      {register.folderName}
                    </RegStatusPill>
                  )}
                  <div className="mt-2 text-sm leading-6 text-[#51465e]">{register.description}</div>
                </div>
              ))}
              {registers.length === 0 && (
                <div className="text-sm text-[#6f6578]">
                  No risk registers found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel min-w-0 overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-[#ded8e4] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="eyebrow">Scenario library</div>
                <h2 className="mt-1 text-xl font-semibold text-[#241232]">Register scenarios</h2>
              </div>
              <button
                className="button-primary shrink-0"
                disabled={registers.length === 0}
                onClick={() => setScenarioDrawerOpen(true)}
                type="button"
              >
                Add scenario
              </button>
            </div>
            <div className="max-h-[min(660px,calc(100vh-260px))] max-w-full overflow-auto">
              <table className="min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[#ded8e4] bg-[#f7f2fa] text-xs uppercase tracking-[0.18em] text-[#62576a]">
                  <tr>
                    <th className="px-4 py-3">Scenario</th>
                    <th className="px-4 py-3">Register</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Scores</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((scenario) => (
                    <tr key={scenario.id} className="border-t border-[#ece7f0] align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-[#241232]">{scenario.title}</div>
                        <div className="mt-2 text-sm leading-6 text-[#51465e]">{scenario.description}</div>
                      </td>
                      <td className="px-4 py-4 text-[#51465e]">{scenario.registerName}</td>
                      <td className="px-4 py-4">
                        <RegStatusPill tone={statusTone(scenario.status)} className="capitalize">
                          {scenario.status}
                        </RegStatusPill>
                      </td>
                      <td className="px-4 py-4 text-[#51465e]">
                        <div>Likelihood: {scoreLabel(scenario.likelihood)}</div>
                        <div>Impact: {scoreLabel(scenario.impact)}</div>
                        <div>Inherent: {scoreLabel(scenario.inherentScore)}</div>
                        <div>Residual: {scoreLabel(scenario.residualScore)}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <RegActionMenu
                          actions={[
                            {
                              label: 'Inspect scenario',
                              icon: Eye,
                              onSelect: () => setInspectedScenario(scenario),
                            },
                            {
                              label: 'Edit scenario',
                              icon: Pencil,
                              onSelect: () => openScenarioEdit(scenario),
                            },
                            {
                              label: 'Delete scenario',
                              icon: Trash2,
                              destructive: true,
                              onSelect: () => setScenarioToDelete(scenario),
                            },
                          ]}
                          label={`Open actions for ${scenario.title}`}
                        />
                      </td>
                    </tr>
                  ))}
                  {scenarios.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={5}>
                        No risk scenarios found for tenant <span className="font-mono">{identity.tenantId}</span>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <RegRightDrawer
        description="Add a new register without changing the underlying Regovise risk model."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              onClick={() => setRegisterDrawerOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={registerBusy || !registerName.trim() || folders.length === 0}
              form="risk-register-form"
              type="submit"
            >
              {registerBusy ? 'Saving...' : 'Add register'}
            </button>
          </div>
        }
        onOpenChange={setRegisterDrawerOpen}
        open={registerDrawerOpen}
        title="Add risk register"
      >
        <form
          className="space-y-4"
          id="risk-register-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createRegister();
          }}
        >
          <label className="space-y-1">
            <span className="label">Scope</span>
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
              className="input min-h-[132px]"
              onChange={(event) => setRegisterDescription(event.target.value)}
              placeholder="What scope or team does this register cover?"
              value={registerDescription}
            />
          </label>
          {folders.length === 0 && (
            <div className="notice-warning">
              No accessible scopes are available for new risk registers.
            </div>
          )}
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Capture likelihood, impact, and current treatment state while preserving existing risk scenario data."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              onClick={() => setScenarioDrawerOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={scenarioBusy || !scenarioTitle.trim() || registers.length === 0}
              form="risk-scenario-form"
              type="submit"
            >
              {scenarioBusy ? 'Saving...' : 'Add scenario'}
            </button>
          </div>
        }
        onOpenChange={setScenarioDrawerOpen}
        open={scenarioDrawerOpen}
        title="Add risk scenario"
      >
        <form
          className="space-y-4"
          id="risk-scenario-form"
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
              className="input min-h-[132px]"
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
          {registers.length === 0 && (
            <div className="notice-warning">
              Create a risk register before adding scenarios.
            </div>
          )}
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Review register scope and usage before making changes."
        footer={
          <div className="flex justify-end">
            <button className="button-secondary" onClick={() => setInspectedRegister(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedRegister(null);
        }}
        open={Boolean(inspectedRegister)}
        title={inspectedRegister?.name ?? 'Risk register'}
      >
        {inspectedRegister ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="metric-label">Scope</div>
                <div className="mt-2 text-sm font-semibold text-[#241232]">
                  {inspectedRegister.folderName ?? 'Tenant-wide'}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="metric-label">Scenarios</div>
                <div className="mt-2 text-sm font-semibold text-[#241232]">
                  {scenarios.filter((scenario) => scenario.registerId === inspectedRegister.id).length}
                </div>
              </div>
            </div>
            <section>
              <h3 className="text-sm font-semibold text-[#241232]">Description</h3>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedRegister.description || 'No register description has been captured yet.'}
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-[#241232]">Recent scenarios</h3>
              <div className="mt-3 space-y-2">
                {scenarios
                  .filter((scenario) => scenario.registerId === inspectedRegister.id)
                  .slice(0, 4)
                  .map((scenario) => (
                    <div className="rounded-md border border-[#e8e1ee] bg-white px-3 py-2" key={scenario.id}>
                      <div className="text-sm font-medium text-[#241232]">{scenario.title}</div>
                      <div className="mt-1 text-xs text-[#6f6578]">
                        Residual {scoreLabel(scenario.residualScore)} · {scenario.status}
                      </div>
                    </div>
                  ))}
                {scenarios.filter((scenario) => scenario.registerId === inspectedRegister.id).length === 0 ? (
                  <div className="text-sm text-[#6f6578]">No scenarios are attached to this register yet.</div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Update register metadata using the existing risk register API."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditingRegister(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={registerActionBusy || !editRegisterName.trim()}
              form="edit-risk-register-form"
              type="submit"
            >
              {registerActionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setEditingRegister(null);
        }}
        open={Boolean(editingRegister)}
        title="Edit risk register"
      >
        {editingRegister ? (
          <form
            className="space-y-4"
            id="edit-risk-register-form"
            onSubmit={(event) => {
              event.preventDefault();
              void updateRegister();
            }}
          >
            <label className="space-y-1">
              <span className="label">Scope</span>
              <select
                className="input"
                onChange={(event) => setEditRegisterFolderId(event.target.value)}
                value={editRegisterFolderId}
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
                onChange={(event) => setEditRegisterName(event.target.value)}
                value={editRegisterName}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[132px]"
                onChange={(event) => setEditRegisterDescription(event.target.value)}
                value={editRegisterDescription}
              />
            </label>
          </form>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Inspect the current scenario posture, scoring, and treatment state."
        footer={
          <div className="flex justify-end">
            <button className="button-secondary" onClick={() => setInspectedScenario(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedScenario(null);
        }}
        open={Boolean(inspectedScenario)}
        title={inspectedScenario?.title ?? 'Risk scenario'}
      >
        {inspectedScenario ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RegStatusPill tone={statusTone(inspectedScenario.status)} className="capitalize">
                {inspectedScenario.status}
              </RegStatusPill>
              <RegStatusPill tone="neutral">{inspectedScenario.registerName}</RegStatusPill>
            </div>
            <p className="text-sm leading-6 text-[#4f435c]">
              {inspectedScenario.description || 'No scenario description has been captured yet.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="metric-card">
                <div className="metric-label">Likelihood</div>
                <div className="metric-value">{scoreLabel(inspectedScenario.likelihood)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Impact</div>
                <div className="metric-value">{scoreLabel(inspectedScenario.impact)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Inherent score</div>
                <div className="metric-value">{scoreLabel(inspectedScenario.inherentScore)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Residual score</div>
                <div className="metric-value">{scoreLabel(inspectedScenario.residualScore)}</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="text-sm font-semibold text-[#241232]">Treatment posture</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                Scenario status is the current treatment signal in this route. Detailed treatment plans remain in the
                advanced risk action-plan workflows.
              </p>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Update scenario scoring and treatment status using the existing risk scenario API."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditingScenario(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={scenarioActionBusy || !editScenarioTitle.trim()}
              form="edit-risk-scenario-form"
              type="submit"
            >
              {scenarioActionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setEditingScenario(null);
        }}
        open={Boolean(editingScenario)}
        title="Edit risk scenario"
      >
        {editingScenario ? (
          <form
            className="space-y-4"
            id="edit-risk-scenario-form"
            onSubmit={(event) => {
              event.preventDefault();
              void updateScenario();
            }}
          >
            <div className="panel-subtle">
              <div className="metric-label">Risk register</div>
              <div className="mt-2 text-sm font-semibold text-[#241232]">{editingScenario.registerName}</div>
              <p className="mt-1 text-xs leading-5 text-[#6f6578]">
                Moving scenarios between registers is intentionally not exposed in this edit flow.
              </p>
            </div>
            <label className="space-y-1">
              <span className="label">Scenario title</span>
              <input
                className="input"
                onChange={(event) => setEditScenarioTitle(event.target.value)}
                value={editScenarioTitle}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[132px]"
                onChange={(event) => setEditScenarioDescription(event.target.value)}
                value={editScenarioDescription}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">Likelihood</span>
                <input
                  className="input"
                  max="5"
                  min="1"
                  onChange={(event) => setEditLikelihood(event.target.value)}
                  step="0.1"
                  type="number"
                  value={editLikelihood}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Impact</span>
                <input
                  className="input"
                  max="5"
                  min="1"
                  onChange={(event) => setEditImpact(event.target.value)}
                  step="0.1"
                  type="number"
                  value={editImpact}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Status</span>
                <select
                  className="input"
                  onChange={(event) => setEditStatus(event.target.value)}
                  value={editStatus}
                >
                  <option value="open">Open</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="accepted">Accepted</option>
                </select>
              </label>
            </div>
          </form>
        ) : null}
      </RegRightDrawer>

      <RegModal
        description="This removes the register from the active risk workspace using the existing risk register delete API."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setRegisterToDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-danger"
              disabled={registerActionBusy}
              onClick={() => void deleteRegister()}
              type="button"
            >
              {registerActionBusy ? 'Deleting...' : 'Delete register'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setRegisterToDelete(null);
        }}
        open={Boolean(registerToDelete)}
        title="Delete risk register"
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[#4f435c]">
            Delete <span className="font-semibold text-[#241232]">{registerToDelete?.name}</span>? If scenarios are
            attached, the existing API may reject the removal.
          </p>
          <div className="notice-warning">
            Review attached scenarios before deleting a register. This action is intentionally explicit.
          </div>
        </div>
      </RegModal>

      <RegModal
        description="This removes the scenario from its register using the existing risk scenario delete API."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setScenarioToDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-danger"
              disabled={scenarioActionBusy}
              onClick={() => void deleteScenario()}
              type="button"
            >
              {scenarioActionBusy ? 'Deleting...' : 'Delete scenario'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setScenarioToDelete(null);
        }}
        open={Boolean(scenarioToDelete)}
        title="Delete risk scenario"
      >
        <p className="text-sm leading-6 text-[#4f435c]">
          Delete <span className="font-semibold text-[#241232]">{scenarioToDelete?.title}</span>? This removes the
          scenario from the active register while preserving the existing route and API model.
        </p>
      </RegModal>
    </div>
  );
}
