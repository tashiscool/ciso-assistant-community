import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RegModal,
  RegRightDrawer,
  RegStatusPill,
  RegTableShell,
} from '../../components/regovise/PagePrimitives';
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

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

type VendorImportRow = {
  vendor: string;
  solution: string;
  contract: string;
  owner: string;
  action: string;
  status: 'Ready' | 'Needs mapping' | 'Review';
};

const STAGED_VENDOR_IMPORT_ROWS: VendorImportRow[] = [
  {
    vendor: 'TaskNimbus',
    solution: 'Questionnaire automation',
    contract: 'MSA-2026-014',
    owner: 'Security Operations',
    action: 'Create entity, solution, and contract records',
    status: 'Ready',
  },
  {
    vendor: 'CloudLedger',
    solution: 'Finance data warehouse',
    contract: 'Renewal pending',
    owner: 'Finance',
    action: 'Map provider to existing risk assessment',
    status: 'Needs mapping',
  },
  {
    vendor: 'DataForge Labs',
    solution: 'Model evaluation workspace',
    contract: 'DPA draft',
    owner: 'AI Governance',
    action: 'Review privacy and resilience dependencies first',
    status: 'Review',
  },
];

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

function statusTone(value: string | null | undefined): PillTone {
  const normalized = (value ?? '').toLowerCase();
  if (['active', 'approved', 'complete', 'completed', 'compliant', 'accepted'].includes(normalized)) {
    return 'success';
  }
  if (['draft', 'planned', 'pending', 'in_progress', 'partially_compliant'].includes(normalized)) {
    return 'warning';
  }
  if (['expired', 'terminated', 'failed', 'non_compliant', 'rejected'].includes(normalized)) {
    return 'danger';
  }
  return 'neutral';
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
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
  const [solutionDrawerOpen, setSolutionDrawerOpen] = useState(false);
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false);
  const [vendorImportOpen, setVendorImportOpen] = useState(false);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);

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
  const entitiesWithoutContracts = useMemo(
    () => entities.filter((entity) => entity.contractCount === 0),
    [entities],
  );
  const entitiesWithoutAssessments = useMemo(
    () => entities.filter((entity) => entity.assessmentCount === 0),
    [entities],
  );
  const inactiveEntities = useMemo(
    () => entities.filter((entity) => !entity.isActive),
    [entities],
  );
  const contractsWithoutSolutions = useMemo(
    () => contracts.filter((contract) => contract.solutions.length === 0),
    [contracts],
  );
  const bulkReviewRows = useMemo(
    () => [
      {
        label: 'Entities without contracts',
        count: entitiesWithoutContracts.length,
        review: entitiesWithoutContracts.map((entity) => entity.name).join(', ') || 'No gaps found',
      },
      {
        label: 'Entities without assessments',
        count: entitiesWithoutAssessments.length,
        review: entitiesWithoutAssessments.map((entity) => entity.name).join(', ') || 'No gaps found',
      },
      {
        label: 'Contracts without solutions',
        count: contractsWithoutSolutions.length,
        review: contractsWithoutSolutions.map((contract) => contract.name).join(', ') || 'No gaps found',
      },
      {
        label: 'Inactive entities',
        count: inactiveEntities.length,
        review: inactiveEntities.map((entity) => entity.name).join(', ') || 'No gaps found',
      },
    ],
    [contractsWithoutSolutions, entitiesWithoutAssessments, entitiesWithoutContracts, inactiveEntities],
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
      setEntityDrawerOpen(false);
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
      setSolutionDrawerOpen(false);
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
      setContractDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setContractBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading third-party workspace...</div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Third Party</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Third-Party Management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Manage provider entities, map their solutions and contracts, and keep vendor assessment
              coverage close to the compliance and resilience work already in the workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setVendorImportOpen(true)} type="button">
              Review vendor import
            </button>
            <button className="button-secondary" onClick={() => setBulkReviewOpen(true)} type="button">
              Bulk review
            </button>
            <button className="button-secondary" onClick={() => setEntityDrawerOpen(true)} type="button">
              New entity
            </button>
            <button className="button-secondary" onClick={() => setSolutionDrawerOpen(true)} type="button">
              New solution
            </button>
            <button className="button-primary" onClick={() => setContractDrawerOpen(true)} type="button">
              New contract
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <div className="eyebrow">Entities</div>
          <div className="mt-4 space-y-3">
            {entities.map((entity) => (
              <Link
                key={entity.id}
                className="panel-subtle block transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
                to={`/third-party/entities/${entity.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="break-words text-lg font-semibold text-[#241232]">{entity.name}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">
                      {entity.folderName} · {entity.country ?? 'n/a'} · criticality {entity.defaultCriticality}
                    </div>
                  </div>
                  <RegStatusPill tone={entity.isActive ? 'success' : 'neutral'}>
                    {entity.isActive ? 'Active' : 'Inactive'}
                  </RegStatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#4f435c]">
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
                    <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{contract.name}</div>
                    <RegStatusPill className="shrink-0 capitalize" tone={statusTone(contract.status)}>
                      {contract.status}
                    </RegStatusPill>
                  </div>
                  <div className="mt-2 text-sm text-[#6f6578]">
                    {contract.providerEntityName} → {contract.beneficiaryEntityName ?? 'Unassigned'}
                  </div>
                  <div className="mt-2 text-xs text-[#62576a]">
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
                    <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{assessment.name}</div>
                    <RegStatusPill className="shrink-0 capitalize" tone={statusTone(assessment.conclusion ?? assessment.status)}>
                      {(assessment.conclusion ?? assessment.status).replace(/_/g, ' ')}
                    </RegStatusPill>
                  </div>
                  <div className="mt-2 text-sm text-[#6f6578]">
                    {assessment.entityName} · {assessment.perimeterName ?? 'No perimeter'}
                  </div>
                  <div className="mt-2 text-xs text-[#62576a]">
                    Next review {formatDate(assessment.nextReviewOn)} · Criticality {assessment.criticality}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <RegModal
        description="Stage vendor rows and confirm the mapping posture before any records are created."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setVendorImportOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={() => {
                setNotice('Vendor import staging reviewed. Persisted bulk import still requires an approved import API.');
                setVendorImportOpen(false);
              }}
              type="button"
            >
              Mark review complete
            </button>
          </div>
        }
        onOpenChange={setVendorImportOpen}
        open={vendorImportOpen}
        title="Review vendor import staging"
      >
        <div className="space-y-4">
          <div className="notice-warning">
            No bulk-import API exists in the current route contract. This review flow keeps the operator workflow
            visible without changing backend persistence.
          </div>
          <RegTableShell>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#f7f3fa] text-xs uppercase tracking-wide text-[#6f6578]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Vendor</th>
                    <th className="px-4 py-3 font-semibold">Solution</th>
                    <th className="px-4 py-3 font-semibold">Contract</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Review action</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ede7f2] text-[#241232]">
                  {STAGED_VENDOR_IMPORT_ROWS.map((row) => (
                    <tr key={row.vendor}>
                      <td className="px-4 py-3 font-medium">{row.vendor}</td>
                      <td className="px-4 py-3 text-[#4f435c]">{row.solution}</td>
                      <td className="px-4 py-3 text-[#4f435c]">{row.contract}</td>
                      <td className="px-4 py-3 text-[#4f435c]">{row.owner}</td>
                      <td className="px-4 py-3 text-[#4f435c]">{row.action}</td>
                      <td className="px-4 py-3">
                        <RegStatusPill
                          tone={row.status === 'Ready' ? 'success' : row.status === 'Needs mapping' ? 'warning' : 'info'}
                        >
                          {row.status}
                        </RegStatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RegTableShell>
        </div>
      </RegModal>

      <RegModal
        description="Review vendor coverage gaps across the currently loaded entities, contracts, solutions, and assessments."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setBulkReviewOpen(false)} type="button">
              Close
            </button>
            <button
              className="button-primary"
              onClick={() => {
                setNotice('Bulk vendor coverage review completed.');
                setBulkReviewOpen(false);
              }}
              type="button"
            >
              Complete review
            </button>
          </div>
        }
        onOpenChange={setBulkReviewOpen}
        open={bulkReviewOpen}
        title="Bulk review vendor coverage"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <div className="metric-label">Entities reviewed</div>
              <div className="metric-value">{entities.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Coverage gaps</div>
              <div className="metric-value">
                {entitiesWithoutContracts.length + entitiesWithoutAssessments.length + contractsWithoutSolutions.length}
              </div>
            </div>
          </div>
          <RegTableShell>
            <div className="max-h-[340px] overflow-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#f7f3fa] text-xs uppercase tracking-wide text-[#6f6578]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Review area</th>
                    <th className="px-4 py-3 font-semibold">Count</th>
                    <th className="px-4 py-3 font-semibold">Review notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ede7f2] text-[#241232]">
                  {bulkReviewRows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3">
                        <RegStatusPill tone={row.count === 0 ? 'success' : 'warning'}>
                          {row.count === 0 ? 'Clear' : `${row.count} to review`}
                        </RegStatusPill>
                      </td>
                      <td className="max-w-[420px] px-4 py-3 text-[#4f435c]">{row.review}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RegTableShell>
        </div>
      </RegModal>

      <RegRightDrawer
        description="Create a provider, customer, or internal third-party entity that can be linked to solutions, contracts, and assessments."
        footer={
          <>
            <button className="button-secondary" onClick={() => setEntityDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={entityBusy} form="tprm-entity-form" type="submit">
              {entityBusy ? 'Creating...' : 'Create entity'}
            </button>
          </>
        }
        onOpenChange={setEntityDrawerOpen}
        open={entityDrawerOpen}
        title="New entity"
      >
        <form
          className="space-y-4"
          id="tprm-entity-form"
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
          <label className="space-y-1">
            <span className="label">Name</span>
            <input className="input" onChange={(event) => setEntityName(event.target.value)} placeholder="TaskNimbus" value={entityName} />
          </label>
          <label className="space-y-1">
            <span className="label">Reference</span>
            <input className="input" onChange={(event) => setEntityRefId(event.target.value)} placeholder="VEN-001" value={entityRefId} />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[112px]"
              onChange={(event) => setEntityDescription(event.target.value)}
              value={entityDescription}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Relationship</span>
            <input className="input" onChange={(event) => setEntityRelationship(event.target.value)} value={entityRelationship} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Country</span>
              <input className="input" onChange={(event) => setEntityCountry(event.target.value)} value={entityCountry} />
            </label>
            <label className="space-y-1">
              <span className="label">Currency</span>
              <input className="input" onChange={(event) => setEntityCurrency(event.target.value)} value={entityCurrency} />
            </label>
          </div>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Create a solution record and connect it to the provider entity that operates it."
        footer={
          <>
            <button className="button-secondary" onClick={() => setSolutionDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={solutionBusy} form="tprm-solution-form" type="submit">
              {solutionBusy ? 'Creating...' : 'Create solution'}
            </button>
          </>
        }
        onOpenChange={setSolutionDrawerOpen}
        open={solutionDrawerOpen}
        title="New solution"
      >
        <form
          className="space-y-4"
          id="tprm-solution-form"
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
          <label className="space-y-1">
            <span className="label">Name</span>
            <input className="input" onChange={(event) => setSolutionName(event.target.value)} placeholder="TaskNimbus SSO" value={solutionName} />
          </label>
          <label className="space-y-1">
            <span className="label">Reference</span>
            <input className="input" onChange={(event) => setSolutionRefId(event.target.value)} placeholder="SOL-001" value={solutionRefId} />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[112px]"
              onChange={(event) => setSolutionDescription(event.target.value)}
              value={solutionDescription}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Create a contract record, link it to provider and beneficiary entities, and attach the covered solution."
        footer={
          <>
            <button className="button-secondary" onClick={() => setContractDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={contractBusy} form="tprm-contract-form" type="submit">
              {contractBusy ? 'Creating...' : 'Create contract'}
            </button>
          </>
        }
        onOpenChange={setContractDrawerOpen}
        open={contractDrawerOpen}
        title="New contract"
      >
        <form
          className="space-y-4"
          id="tprm-contract-form"
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
          <label className="space-y-1">
            <span className="label">Name</span>
            <input className="input" onChange={(event) => setContractName(event.target.value)} placeholder="Master services agreement" value={contractName} />
          </label>
          <label className="space-y-1">
            <span className="label">Reference</span>
            <input className="input" onChange={(event) => setContractRefId(event.target.value)} placeholder="CTR-001" value={contractRefId} />
          </label>
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
          <div className="grid gap-3 sm:grid-cols-2">
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
        </form>
      </RegRightDrawer>
    </div>
  );
}
