import { useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

type ConMonProfile = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  profileType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const client = new ApiClient();

export function ConMonProfilesPage() {
  const { identity } = useEdgeIdentity();
  const [profiles, setProfiles] = useState<ConMonProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  async function loadProfiles() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: ConMonProfile[] }>('/conmon/profiles');
      setProfiles(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, [identity.tenantId, identity.userId]);

  async function createProfile() {
    try {
      setBusyId('create');
      setNotice(null);
      await client.post('/conmon/profiles', {
        name,
        description,
        profileType: 'fedramp_conmon',
      });
      setName('');
      setDescription('');
      setNotice('Created a new ConMon profile in D1.');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function runProfile(profileId: string) {
    try {
      setBusyId(profileId);
      setNotice(null);
      const response = await client.post<{ data: { executionId: string } }>(
        `/conmon/profiles/${profileId}/run`,
      );
      setNotice(`Queued ConMon execution ${response.data.executionId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading ConMon profiles...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">ConMon</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Continuous Monitoring Profiles</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Use profiles to define monitoring baselines and launch runs for the parts of the
            program that need recurring review.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createProfile();
          }}
        >
          <label className="space-y-1">
            <span className="label">Profile name</span>
            <input
              className="input"
              onChange={(event) => setName(event.target.value)}
              placeholder="Monthly ConMon Baseline"
              value={name}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[92px]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the tenant-scoped monitoring surface..."
              value={description}
            />
          </label>
          <button className="button-primary" disabled={busyId === 'create'} type="submit">
            {busyId === 'create' ? 'Creating...' : 'Create Profile'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4 text-white">
                  <div className="font-medium">{profile.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{profile.updatedAt}</div>
                </td>
                <td className="px-4 py-4 text-slate-300">{profile.profileType}</td>
                <td className="px-4 py-4">
                  <span className="badge-success">{profile.status}</span>
                </td>
                <td className="max-w-xl px-4 py-4 text-slate-300">{profile.description}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    className="button-secondary"
                    disabled={busyId === profile.id}
                    onClick={() => void runProfile(profile.id)}
                    type="button"
                  >
                    {busyId === profile.id ? 'Queueing...' : 'Run'}
                  </button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                  No ConMon profiles found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
