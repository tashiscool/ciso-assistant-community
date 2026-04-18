import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type {
  ThirdPartyAssessment,
  ThirdPartyContract,
  ThirdPartyEntity,
  ThirdPartySolution,
} from './types';

const client = new ApiClient();

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatMoney(amount: number | null | undefined, currency = 'USD') {
  if (amount == null) {
    return 'n/a';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TprmWorkspacePage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [entities, setEntities] = useState<ThirdPartyEntity[]>([]);
  const [solutions, setSolutions] = useState<ThirdPartySolution[]>([]);
  const [contracts, setContracts] = useState<ThirdPartyContract[]>([]);
  const [assessments, setAssessments] = useState<ThirdPartyAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entityBusy, setEntityBusy] = useState(false);
  const [solutionBusy, setSolutionBusy] = useState(false);
  const [contractBusy, setContractBusy] = useState(false);

  const [entityFolderId, setEntityFolderId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [entityRefId, setEntityRefId] = useState('');
  const [entityDescription, setEntityDescription] = useState('');
  const [entityRelationship, setEntityRelationship] = useState('ict_provider');
  const [entityCountry, setEntityCountry] = useState('US');
  const [entityCurrency, setEntityCurrency] = useState('USD');

  const [solutionFolderId, setSolutionFolderId] = useState('');
  const [solutionProviderId, setSolutionProviderId] = useState('');
  const [solutionName, setSolutionName] = useState('');
  const [solutionRefId, setSolutionRefId] = useState('');
  const [solutionDescription, setSolutionDescription] = useState('');
  const [solutionCriticality, setSolutionCriticality] = useState('3');

  const [contractFolderId, setContractFolderId] = useState('');
  const [contractProviderId, setContractProviderId] = useState('');
  const [contractBeneficiaryId, setContractBeneficiaryId] = useState('');
  const [contractName, setContractName] = useState('');
  const [contractRefId, setContractRefId] = useState('');
  const [contractStatus, setContractStatus] = useState('draft');
  const [contractCurrency, setContractCurrency] = useState('USD');
  const [contractAnnualExpense, setContractAnnualExpense] = useState('');
  const [contractSolutionId, setContractSolutionId] = useState('');

  const domainFolders = useMemo(
    () => folders.filter((folder) => folder.contentType === 'domain'),
    [folders],
  );

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, entityResponse, solutionResponse, contractResponse, assessmentResponse] =
        await Promise.all([
          client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
          client.get<{ data: ThirdPartyEntity[] }>('/core/entities'),
          client.get<{ data: ThirdPartySolution[] }>('/core/solutions'),
          client.get<{ data: ThirdPartyContract[] }>('/core/contracts'),
          client.get<{ data: ThirdPartyAssessment[] }>('/core/entity-assessments'),
        ]);

      setFolders(folderResponse.data);
      setEntities(entityResponse.data);
      setSolutions(solutionResponse.data);
      setContracts(contractResponse.data);
      setAssessments(assessmentResponse.data);

      if (!entityFolderId && folderResponse.data[0]?.id) {
        setEntityFolderId(folderResponse.data[0].id);
      }
      if (!solutionFolderId && folderResponse.data[0]?.id) {
        setSolutionFolderId(folderResponse.data[0].id);
      }
      if (!contractFolderId && folderResponse.data[0]?.id) {
        setContractFolderId(folderResponse.data[0].id);
      }
      if (!solutionProviderId && entityResponse.data[0]?.id) {
        setSolutionProviderId(entityResponse.data[0].id);
      }
      if (!contractProviderId && entityResponse.data[0]?.id) {
        setContractProviderId(entityResponse.data[0].id);
      }
      if (!contractBeneficiaryId && entityResponse.data[0]?.id) {
        setContractBeneficiaryId(entityResponse.data[0].id);
      }
      if (!contractSolutionId && solutionResponse.data[0]?.id) {
        setContractSolutionId(solutionResponse.data[0].id);
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

  async function createEntity() {
    try {
      setEntityBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/entities', {
        folderId: entityFolderId,
        refId: entityRefId,
        name: entityName,
        description: entityDescription,
        relationship: entityRelationship,
        country: entityCountry,
        currency: entityCurrency,
      });
      setEntityName('');
      setEntityRefId('');
      setEntityDescription('');
      setEntityRelationship('ict_provider');
      setNotice('Third-party entity created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEntityBusy(false);
    }
  }

  async function createSolution() {
    try {
      setSolutionBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/solutions', {
        folderId: solutionFolderId,
        providerEntityId: solutionProviderId,
        refId: solutionRefId,
        name: solutionName,
        description: solutionDescription,
        criticality: Number(solutionCriticality),
      });
      setSolutionName('');
      setSolutionRefId('');
      setSolutionDescription('');
      setSolutionCriticality('3');
      setNotice('Solution record created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSolutionBusy(false);
    }
  }

  async function createContract() {
    try {
      setContractBusy(true);
      setError(null);
      setNotice(null);
      const selectedSolution = solutions.find((solution) => solution.id === contractSolutionId);
      await client.post('/core/contracts', {
        folderId: contractFolderId,
        providerEntityId: contractProviderId,
        beneficiaryEntityId: contractBeneficiaryId || null,
        refId: contractRefId,
        name: contractName,
        status: contractStatus,
        currency: contractCurrency,
        annualExpense: contractAnnualExpense ? Number(contractAnnualExpense) : null,
        solutions: selectedSolution
          ? [{ id: selectedSolution.id, name: selectedSolution.name }]
          : [],
      });
      setContractName('');
      setContractRefId('');
      setContractStatus('draft');
      setContractAnnualExpense('');
      setNotice('Contract record created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setContractBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading third-party workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Third Party</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Third-Party Management</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Manage provider entities, map their solutions and contracts, and keep vendor assessment
          coverage close to the compliance and resilience work already in the workspace.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Entities</div>
          <div className="metric-value">{entities.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Solutions</div>
          <div className="metric-value">{solutions.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Contracts</div>
          <div className="metric-value">{contracts.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Assessments</div>
          <div className="metric-value">{assessments.length}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <section className="panel">
          <div className="eyebrow">New Entity</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createEntity();
            }}
          >
            <label className="space-y-1">
              <span className="label">Domain folder</span>
              <select className="input" onChange={(event) => setEntityFolderId(event.target.value)} value={entityFolderId}>
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
                <input className="input" onChange={(event) => setEntityName(event.target.value)} value={entityName} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setEntityRefId(event.target.value)} value={entityRefId} />
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[92px]"
                onChange={(event) => setEntityDescription(event.target.value)}
                value={entityDescription}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">Relationship</span>
                <input
                  className="input"
                  onChange={(event) => setEntityRelationship(event.target.value)}
                  value={entityRelationship}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Country</span>
                <input className="input" onChange={(event) => setEntityCountry(event.target.value)} value={entityCountry} />
              </label>
              <label className="space-y-1">
                <span className="label">Currency</span>
                <input className="input" onChange={(event) => setEntityCurrency(event.target.value)} value={entityCurrency} />
              </label>
            </div>
            <button className="button-primary" disabled={entityBusy} type="submit">
              {entityBusy ? 'Creating...' : 'Create Entity'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">New Solution</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createSolution();
            }}
          >
            <label className="space-y-1">
              <span className="label">Provider</span>
              <select className="input" onChange={(event) => setSolutionProviderId(event.target.value)} value={solutionProviderId}>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Domain folder</span>
                <select className="input" onChange={(event) => setSolutionFolderId(event.target.value)} value={solutionFolderId}>
                  {domainFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Criticality</span>
                <input
                  className="input"
                  max="5"
                  min="0"
                  onChange={(event) => setSolutionCriticality(event.target.value)}
                  type="number"
                  value={solutionCriticality}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Name</span>
                <input className="input" onChange={(event) => setSolutionName(event.target.value)} value={solutionName} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setSolutionRefId(event.target.value)} value={solutionRefId} />
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[92px]"
                onChange={(event) => setSolutionDescription(event.target.value)}
                value={solutionDescription}
              />
            </label>
            <button className="button-primary" disabled={solutionBusy} type="submit">
              {solutionBusy ? 'Creating...' : 'Create Solution'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">New Contract</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createContract();
            }}
          >
            <label className="space-y-1">
              <span className="label">Provider</span>
              <select className="input" onChange={(event) => setContractProviderId(event.target.value)} value={contractProviderId}>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Beneficiary</span>
              <select className="input" onChange={(event) => setContractBeneficiaryId(event.target.value)} value={contractBeneficiaryId}>
                <option value="">Unassigned</option>
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
                <input className="input" onChange={(event) => setContractName(event.target.value)} value={contractName} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setContractRefId(event.target.value)} value={contractRefId} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Status</span>
                <select className="input" onChange={(event) => setContractStatus(event.target.value)} value={contractStatus}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Solution</span>
                <select className="input" onChange={(event) => setContractSolutionId(event.target.value)} value={contractSolutionId}>
                  <option value="">No linked solution</option>
                  {solutions.map((solution) => (
                    <option key={solution.id} value={solution.id}>
                      {solution.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">Folder</span>
                <select className="input" onChange={(event) => setContractFolderId(event.target.value)} value={contractFolderId}>
                  {domainFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Currency</span>
                <input className="input" onChange={(event) => setContractCurrency(event.target.value)} value={contractCurrency} />
              </label>
              <label className="space-y-1">
                <span className="label">Annual expense</span>
                <input
                  className="input"
                  onChange={(event) => setContractAnnualExpense(event.target.value)}
                  type="number"
                  value={contractAnnualExpense}
                />
              </label>
            </div>
            <button className="button-primary" disabled={contractBusy} type="submit">
              {contractBusy ? 'Creating...' : 'Create Contract'}
            </button>
          </form>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <div className="eyebrow">Entities</div>
          <div className="mt-4 space-y-3">
            {entities.map((entity) => (
              <Link
                key={entity.id}
                className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={`/third-party/entities/${entity.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{entity.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {entity.folderName} · {entity.country ?? 'n/a'} · criticality {entity.defaultCriticality}
                    </div>
                  </div>
                  <span className={entity.isActive ? 'badge-success' : 'badge-neutral'}>
                    {entity.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {entity.description || 'No entity description provided.'}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="metric-card">
                    <div className="metric-label">Solutions</div>
                    <div className="metric-value">{entity.solutionCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Contracts</div>
                    <div className="metric-value">{entity.contractCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Assessments</div>
                    <div className="metric-value">{entity.assessmentCount}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Recent Contracts</div>
            <div className="mt-4 space-y-3">
              {contracts.map((contract) => (
                <div className="panel-subtle" key={contract.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{contract.name}</div>
                    <span className="badge-neutral">{contract.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {contract.providerEntityName} → {contract.beneficiaryEntityName ?? 'Unassigned'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatMoney(contract.annualExpense, contract.currency ?? 'USD')} ·{' '}
                    {contract.solutions.map((solution) => solution.name).join(', ') || 'No linked solution'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Assessment Coverage</div>
            <div className="mt-4 space-y-3">
              {assessments.map((assessment) => (
                <div className="panel-subtle" key={assessment.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{assessment.name}</div>
                    <span className="badge-neutral">{assessment.conclusion ?? assessment.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {assessment.entityName} · {assessment.perimeterName ?? 'No perimeter'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Next review {formatDate(assessment.nextReviewOn)} · Criticality {assessment.criticality}
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
