import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import type { Framework } from '../core/types';
import type {
  ComplianceAssessment,
  Perimeter,
  RiskAssessment,
  RiskRegister,
} from './types';

const client = new ApiClient();

export function AssessmentsPage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [perimeters, setPerimeters] = useState<Perimeter[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [registers, setRegisters] = useState<RiskRegister[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [complianceAssessments, setComplianceAssessments] = useState<ComplianceAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [perimeterBusy, setPerimeterBusy] = useState(false);
  const [riskBusy, setRiskBusy] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);

  const [perimeterFolderId, setPerimeterFolderId] = useState('');
  const [perimeterRefId, setPerimeterRefId] = useState('');
  const [perimeterName, setPerimeterName] = useState('');
  const [perimeterDescription, setPerimeterDescription] = useState('');
  const [perimeterStatus, setPerimeterStatus] = useState('in_design');

  const [riskPerimeterId, setRiskPerimeterId] = useState('');
  const [riskRegisterId, setRiskRegisterId] = useState('');
  const [riskRefId, setRiskRefId] = useState('');
  const [riskName, setRiskName] = useState('');
  const [riskVersion, setRiskVersion] = useState('1.0');
  const [riskStatus, setRiskStatus] = useState('planned');
  const [riskObservation, setRiskObservation] = useState('');

  const [compliancePerimeterId, setCompliancePerimeterId] = useState('');
  const [complianceFrameworkId, setComplianceFrameworkId] = useState('');
  const [complianceRefId, setComplianceRefId] = useState('');
  const [complianceName, setComplianceName] = useState('');
  const [complianceVersion, setComplianceVersion] = useState('1.0');
  const [complianceStatus, setComplianceStatus] = useState('planned');
  const [complianceObservation, setComplianceObservation] = useState('');
  const [controlsTotal, setControlsTotal] = useState('20');
  const [controlsAssessed, setControlsAssessed] = useState('0');
  const [maturityScore, setMaturityScore] = useState('3');

  const selectableFolders = folders.filter((folder) => folder.contentType === 'domain');

  async function loadAssessmentWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [
        folderResponse,
        perimeterResponse,
        frameworkResponse,
        registerResponse,
        riskAssessmentResponse,
        complianceAssessmentResponse,
      ] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        client.get<{ data: Perimeter[] }>('/core/perimeters'),
        client.get<{ data: Framework[] }>('/core/frameworks'),
        client.get<{ data: RiskRegister[] }>('/core/risk-registers'),
        client.get<{ data: RiskAssessment[] }>('/core/risk-assessments'),
        client.get<{ data: ComplianceAssessment[] }>('/core/compliance-assessments'),
      ]);

      setFolders(folderResponse.data);
      setPerimeters(perimeterResponse.data);
      setFrameworks(frameworkResponse.data);
      setRegisters(registerResponse.data);
      setRiskAssessments(riskAssessmentResponse.data);
      setComplianceAssessments(complianceAssessmentResponse.data);

      if (!perimeterFolderId && folderResponse.data[0]?.id) {
        setPerimeterFolderId(folderResponse.data[0].id);
      }
      if (!riskPerimeterId && perimeterResponse.data[0]?.id) {
        setRiskPerimeterId(perimeterResponse.data[0].id);
      }
      if (!riskRegisterId && registerResponse.data[0]?.id) {
        setRiskRegisterId(registerResponse.data[0].id);
      }
      if (!compliancePerimeterId && perimeterResponse.data[0]?.id) {
        setCompliancePerimeterId(perimeterResponse.data[0].id);
      }
      if (!complianceFrameworkId && frameworkResponse.data[0]?.id) {
        setComplianceFrameworkId(frameworkResponse.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssessmentWorkspace();
  }, [identity.tenantId, identity.userId]);

  async function createPerimeter() {
    try {
      setPerimeterBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: Perimeter }>('/core/perimeters', {
        folderId: perimeterFolderId,
        refId: perimeterRefId,
        name: perimeterName,
        description: perimeterDescription,
        lcStatus: perimeterStatus,
      });
      setPerimeterRefId('');
      setPerimeterName('');
      setPerimeterDescription('');
      setPerimeterStatus('in_design');
      setRiskPerimeterId(response.data.id);
      setCompliancePerimeterId(response.data.id);
      setNotice('Perimeter added to the assessment workspace.');
      await loadAssessmentWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPerimeterBusy(false);
    }
  }

  async function createRiskAssessment() {
    try {
      setRiskBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/risk-assessments', {
        perimeterId: riskPerimeterId,
        riskRegisterId,
        refId: riskRefId,
        name: riskName,
        version: riskVersion,
        status: riskStatus,
        observation: riskObservation,
      });
      setRiskRefId('');
      setRiskName('');
      setRiskVersion('1.0');
      setRiskStatus('planned');
      setRiskObservation('');
      setNotice('Risk assessment created.');
      await loadAssessmentWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRiskBusy(false);
    }
  }

  async function createComplianceAssessment() {
    try {
      setComplianceBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/compliance-assessments', {
        perimeterId: compliancePerimeterId,
        frameworkId: complianceFrameworkId,
        refId: complianceRefId,
        name: complianceName,
        version: complianceVersion,
        status: complianceStatus,
        observation: complianceObservation,
        controlsTotal: Number(controlsTotal),
        controlsAssessed: Number(controlsAssessed),
        maturityScore: Number(maturityScore),
      });
      setComplianceRefId('');
      setComplianceName('');
      setComplianceVersion('1.0');
      setComplianceStatus('planned');
      setComplianceObservation('');
      setControlsTotal('20');
      setControlsAssessed('0');
      setMaturityScore('3');
      setNotice('Compliance assessment created.');
      await loadAssessmentWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setComplianceBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading assessment workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assessments</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Assessment Workbench</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Define operating perimeters, then launch risk and compliance assessments against live
          registers and frameworks already present in the workspace.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Perimeters</div>
          <div className="metric-value">{perimeters.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Risk assessments</div>
          <div className="metric-value">{riskAssessments.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Compliance assessments</div>
          <div className="metric-value">{complianceAssessments.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Frameworks linked</div>
          <div className="metric-value">{frameworks.length}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Perimeters</div>
            <div className="mt-4 space-y-3">
              {perimeters.map((perimeter) => (
                <div className="panel-subtle" key={perimeter.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">{perimeter.name}</div>
                      <div className="mt-1 text-xs text-cyan-200">{perimeter.folderName}</div>
                    </div>
                    <span className="badge-neutral">{perimeter.lcStatus}</span>
                  </div>
                  {perimeter.description && (
                    <div className="mt-3 text-sm leading-6 text-slate-300">{perimeter.description}</div>
                  )}
                </div>
              ))}
              {perimeters.length === 0 && (
                <div className="text-sm text-slate-400">No perimeters created yet.</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">New Perimeter</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createPerimeter();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Domain</span>
                  <select
                    className="input"
                    onChange={(event) => setPerimeterFolderId(event.target.value)}
                    value={perimeterFolderId}
                  >
                    {selectableFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.pathLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label">Reference ID</span>
                  <input
                    className="input"
                    onChange={(event) => setPerimeterRefId(event.target.value)}
                    placeholder="PERIM-001"
                    value={perimeterRefId}
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="label">Perimeter name</span>
                <input
                  className="input"
                  onChange={(event) => setPerimeterName(event.target.value)}
                  placeholder="Enterprise Perimeter"
                  value={perimeterName}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Description</span>
                <textarea
                  className="input min-h-[92px]"
                  onChange={(event) => setPerimeterDescription(event.target.value)}
                  value={perimeterDescription}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Lifecycle status</span>
                <select
                  className="input"
                  onChange={(event) => setPerimeterStatus(event.target.value)}
                  value={perimeterStatus}
                >
                  <option value="undefined">Undefined</option>
                  <option value="in_design">Design</option>
                  <option value="in_dev">Development</option>
                  <option value="in_prod">Production</option>
                  <option value="eol">End of life</option>
                  <option value="dropped">Dropped</option>
                </select>
              </label>
              <button className="button-primary" disabled={perimeterBusy} type="submit">
                {perimeterBusy ? 'Saving...' : 'Add Perimeter'}
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">New Risk Assessment</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createRiskAssessment();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Perimeter</span>
                  <select
                    className="input"
                    onChange={(event) => setRiskPerimeterId(event.target.value)}
                    value={riskPerimeterId}
                  >
                    {perimeters.map((perimeter) => (
                      <option key={perimeter.id} value={perimeter.id}>
                        {perimeter.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label">Risk register</span>
                  <select
                    className="input"
                    onChange={(event) => setRiskRegisterId(event.target.value)}
                    value={riskRegisterId}
                  >
                    {registers.map((register) => (
                      <option key={register.id} value={register.id}>
                        {register.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Reference ID</span>
                  <input className="input" onChange={(event) => setRiskRefId(event.target.value)} value={riskRefId} />
                </label>
                <label className="space-y-1">
                  <span className="label">Version</span>
                  <input className="input" onChange={(event) => setRiskVersion(event.target.value)} value={riskVersion} />
                </label>
                <label className="space-y-1">
                  <span className="label">Status</span>
                  <select className="input" onChange={(event) => setRiskStatus(event.target.value)} value={riskStatus}>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="in_review">In review</option>
                    <option value="done">Done</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </label>
              </div>
              <label className="space-y-1">
                <span className="label">Assessment name</span>
                <input
                  className="input"
                  onChange={(event) => setRiskName(event.target.value)}
                  placeholder="Enterprise Risk Assessment"
                  value={riskName}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Observation</span>
                <textarea
                  className="input min-h-[92px]"
                  onChange={(event) => setRiskObservation(event.target.value)}
                  value={riskObservation}
                />
              </label>
              <button
                className="button-primary"
                disabled={riskBusy || perimeters.length === 0 || registers.length === 0}
                type="submit"
              >
                {riskBusy ? 'Saving...' : 'Create Risk Assessment'}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="eyebrow">New Compliance Assessment</div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createComplianceAssessment();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Perimeter</span>
                  <select
                    className="input"
                    onChange={(event) => setCompliancePerimeterId(event.target.value)}
                    value={compliancePerimeterId}
                  >
                    {perimeters.map((perimeter) => (
                      <option key={perimeter.id} value={perimeter.id}>
                        {perimeter.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label">Framework</span>
                  <select
                    className="input"
                    onChange={(event) => setComplianceFrameworkId(event.target.value)}
                    value={complianceFrameworkId}
                  >
                    {frameworks.map((framework) => (
                      <option key={framework.id} value={framework.id}>
                        {framework.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Reference ID</span>
                  <input
                    className="input"
                    onChange={(event) => setComplianceRefId(event.target.value)}
                    value={complianceRefId}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Version</span>
                  <input
                    className="input"
                    onChange={(event) => setComplianceVersion(event.target.value)}
                    value={complianceVersion}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Status</span>
                  <select
                    className="input"
                    onChange={(event) => setComplianceStatus(event.target.value)}
                    value={complianceStatus}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="in_review">In review</option>
                    <option value="done">Done</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </label>
              </div>
              <label className="space-y-1">
                <span className="label">Assessment name</span>
                <input
                  className="input"
                  onChange={(event) => setComplianceName(event.target.value)}
                  placeholder="ISO 27001 Annual Audit"
                  value={complianceName}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Controls total</span>
                  <input
                    className="input"
                    min="0"
                    onChange={(event) => setControlsTotal(event.target.value)}
                    type="number"
                    value={controlsTotal}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Controls assessed</span>
                  <input
                    className="input"
                    min="0"
                    onChange={(event) => setControlsAssessed(event.target.value)}
                    type="number"
                    value={controlsAssessed}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Maturity score</span>
                  <input
                    className="input"
                    max="5"
                    min="0"
                    onChange={(event) => setMaturityScore(event.target.value)}
                    step="0.1"
                    type="number"
                    value={maturityScore}
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="label">Observation</span>
                <textarea
                  className="input min-h-[92px]"
                  onChange={(event) => setComplianceObservation(event.target.value)}
                  value={complianceObservation}
                />
              </label>
              <button
                className="button-primary"
                disabled={complianceBusy || perimeters.length === 0 || frameworks.length === 0}
                type="submit"
              >
                {complianceBusy ? 'Saving...' : 'Create Compliance Assessment'}
              </button>
            </form>
          </section>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="panel overflow-hidden p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Risk assessment</th>
                <th className="px-4 py-3">Perimeter</th>
                <th className="px-4 py-3">Register</th>
                <th className="px-4 py-3">Scenarios</th>
              </tr>
            </thead>
            <tbody>
              {riskAssessments.map((assessment) => (
                <tr key={assessment.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4">
                    <Link
                      className="font-medium text-white transition hover:text-cyan-200"
                      to={`/risk-assessments/${assessment.id}`}
                    >
                      {assessment.name}
                    </Link>
                    <div className="mt-1 text-xs text-cyan-200">{assessment.status}</div>
                    <div className="mt-2 text-xs text-slate-500">Version {assessment.version}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{assessment.perimeterName ?? 'n/a'}</td>
                  <td className="px-4 py-4 text-slate-300">{assessment.riskRegisterName ?? 'n/a'}</td>
                  <td className="px-4 py-4 text-slate-300">{assessment.scenarioCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-hidden p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Compliance assessment</th>
                <th className="px-4 py-3">Framework</th>
                <th className="px-4 py-3">Perimeter</th>
                <th className="px-4 py-3">Progress</th>
              </tr>
            </thead>
            <tbody>
              {complianceAssessments.map((assessment) => (
                <tr key={assessment.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4">
                    <Link
                      className="font-medium text-white transition hover:text-cyan-200"
                      to={`/compliance-assessments/${assessment.id}`}
                    >
                      {assessment.name}
                    </Link>
                    <div className="mt-1 text-xs text-cyan-200">{assessment.status}</div>
                    <div className="mt-2 text-xs text-slate-500">Version {assessment.version}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{assessment.frameworkName}</td>
                  <td className="px-4 py-4 text-slate-300">{assessment.perimeterName ?? 'n/a'}</td>
                  <td className="px-4 py-4 text-slate-300">
                    <div>{assessment.progressPercent}%</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {assessment.controlsAssessed}/{assessment.controlsTotal} controls
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  );
}
