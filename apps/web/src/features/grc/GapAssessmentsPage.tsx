import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createGapAssessment, getFrameworkLibrary, getGapAssessments } from './api';
import type { FrameworkLibrarySummary, GapAssessmentSummary } from './types';

export function GapAssessmentsPage() {
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState<FrameworkLibrarySummary[]>([]);
  const [assessments, setAssessments] = useState<GapAssessmentSummary[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [sources, setSources] = useState('');
  const [severities, setSeverities] = useState('critical,high,medium');
  const [statuses, setStatuses] = useState('fail,inconclusive');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [frameworkData, assessmentData] = await Promise.all([getFrameworkLibrary(), getGapAssessments()]);
      setFrameworks(frameworkData);
      setAssessments(assessmentData);
      setSelectedFrameworks((current) => (current.length > 0 ? current : frameworkData.slice(0, 2).map((item) => item.slug)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load gap assessment workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);
      const detail = await createGapAssessment({
        title: title.trim() || undefined,
        frameworks: selectedFrameworks,
        sources: sources
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        severities: severities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        statuses: statuses
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      navigate(`/gap-assessments/${detail.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the gap assessment.');
    } finally {
      setCreating(false);
    }
  }

  function toggleFramework(slug: string) {
    setSelectedFrameworks((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Cross-Framework Analysis</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Gap Assessment Workspace</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Combine imported findings, SCF-backed control expansions, and curated framework guidance into reusable
          assessment runs that can be promoted into report bundles.
        </p>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="panel space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">New assessment</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Assessment request</h2>
            </div>
            <button className="button-secondary" onClick={() => void load()} type="button">
              Refresh
            </button>
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Title
            <input
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="SOC 2 + FedRAMP readiness"
              value={title}
            />
          </label>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-300">Framework targets</div>
            <div className="grid gap-3">
              {frameworks.map((framework) => (
                <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={framework.id}>
                  <input
                    checked={selectedFrameworks.includes(framework.slug)}
                    className="mt-1"
                    onChange={() => toggleFramework(framework.slug)}
                    type="checkbox"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">{framework.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{framework.frameworkKey}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Sources
            <input
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => setSources(event.target.value)}
              placeholder="github, wiz, aws-inspector"
              value={sources}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Included severities
            <input
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => setSeverities(event.target.value)}
              value={severities}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Included statuses
            <input
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => setStatuses(event.target.value)}
              value={statuses}
            />
          </label>

          <button
            className="button-primary"
            disabled={creating || selectedFrameworks.length === 0}
            onClick={() => void handleCreate()}
            type="button"
          >
            {creating ? 'Running assessment…' : 'Run gap assessment'}
          </button>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Assessment history</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Recent runs</h2>
            </div>
            <span className="badge-neutral">{assessments.length} runs</span>
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
              Loading assessments...
            </div>
          ) : null}

          {!loading && assessments.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
              No gap assessments have been created yet.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            {assessments.map((assessment) => (
              <Link
                className="rounded-3xl border border-white/10 bg-slate-950/30 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                key={assessment.id}
                to={`/gap-assessments/${assessment.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{assessment.frameworks.join(' · ')}</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">{assessment.title}</h3>
                  </div>
                  <span className="badge-neutral">{assessment.status}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="panel-subtle">
                    <div className="label">Sources</div>
                    <div className="mt-2 text-sm font-semibold text-white">{assessment.sources.length}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Findings</div>
                    <div className="mt-2 text-sm font-semibold text-white">{assessment.findingsCount}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Gaps</div>
                    <div className="mt-2 text-sm font-semibold text-white">{assessment.gapCount}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Updated</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {new Date(assessment.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
