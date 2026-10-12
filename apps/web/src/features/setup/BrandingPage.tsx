import { useEffect, useState } from 'react';
import { LayoutTemplate, Palette, Save, ShieldCheck } from 'lucide-react';
import { RegModal } from '../../components/regovise/PagePrimitives';
import { getSetupBranding, updateSetupBranding } from './api';
import type { SetupBrandingSnapshot } from './types';

const defaultDraft = {
  primaryLogoUrl: '',
  primaryLogoDarkUrl: '',
  faviconUrl: '',
  loginLogoUrl: '',
  backgroundImageUrl: '',
  primaryColor: '#0F766E',
  accentColor: '#22D3EE',
  sidebarBackgroundColor: '#0B1324',
  bannerColor: '#155E75',
  loginMessage: '',
  footerText: '',
  enableBackgroundBlur: true,
  enableBackgroundOverlay: true,
  showPoweredByRegovise: true,
};

export function BrandingPage() {
  const [snapshot, setSnapshot] = useState<SetupBrandingSnapshot | null>(null);
  const [draft, setDraft] = useState(defaultDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewSaveOpen, setReviewSaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupBrandingSnapshot) {
    setSnapshot(next);
    setDraft({
      primaryLogoUrl: next.config.primaryLogoUrl,
      primaryLogoDarkUrl: next.config.primaryLogoDarkUrl,
      faviconUrl: next.config.faviconUrl,
      loginLogoUrl: next.config.loginLogoUrl,
      backgroundImageUrl: next.config.backgroundImageUrl,
      primaryColor: next.config.primaryColor,
      accentColor: next.config.accentColor,
      sidebarBackgroundColor: next.config.sidebarBackgroundColor,
      bannerColor: next.config.bannerColor,
      loginMessage: next.config.loginMessage,
      footerText: next.config.footerText,
      enableBackgroundBlur: next.config.enableBackgroundBlur,
      enableBackgroundOverlay: next.config.enableBackgroundOverlay,
      showPoweredByRegovise: next.config.showPoweredByRegovise,
    });
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupBranding());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load branding.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const next = await updateSetupBranding(draft);
      hydrate(next);
      setReviewSaveOpen(false);
      setNotice('Branding configuration saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save branding.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading branding configuration...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Branding</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
            Configure tenant-facing shell colors, login copy, and approved asset URLs so Regovise presents a consistent
            customer identity across the workspace and generated outputs.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Uploaded assets</div>
            <div className="metric-value">{snapshot?.metrics.uploadedAssets ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Custom colors</div>
            <div className="metric-value">{snapshot?.metrics.customizedColors ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Login experience</div>
            <div className="metric-value">{snapshot?.metrics.loginExperience ?? 'Default'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Report branding</div>
            <div className="metric-value">{snapshot?.metrics.reportBrandingReady ? 'Ready' : 'Pending'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel">
          <div className="eyebrow">Brand controls</div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Primary logo URL', 'primaryLogoUrl'],
                ['Dark logo URL', 'primaryLogoDarkUrl'],
                ['Favicon URL', 'faviconUrl'],
                ['Login logo URL', 'loginLogoUrl'],
                ['Background image URL', 'backgroundImageUrl'],
              ].map(([label, key]) => (
                <label className="space-y-1 sm:col-span-2" key={key}>
                  <span className="label">{label}</span>
                  <input
                    className="input"
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                    placeholder="https://assets.regovise.com/brand/logo.svg"
                    value={draft[key as keyof typeof draft] as string}
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Primary', 'primaryColor'],
                ['Accent', 'accentColor'],
                ['Sidebar', 'sidebarBackgroundColor'],
                ['Banner', 'bannerColor'],
              ].map(([label, key]) => (
                <label className="space-y-1" key={key}>
                  <span className="label">{label} color</span>
                  <div className="flex gap-2">
                    <input
                      className="h-11 w-14 rounded-2xl border border-[#ded8e4] bg-white"
                      onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                      type="color"
                      value={draft[key as keyof typeof draft] as string}
                    />
                    <input
                      className="input flex-1"
                      onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                      value={draft[key as keyof typeof draft] as string}
                    />
                  </div>
                </label>
              ))}
            </div>

            <label className="space-y-1">
              <span className="label">Login message</span>
              <textarea
                className="input min-h-28 resize-y"
                onChange={(event) => setDraft((current) => ({ ...current, loginMessage: event.target.value }))}
                value={draft.loginMessage}
              />
            </label>

            <label className="space-y-1">
              <span className="label">Footer text</span>
              <input
                className="input"
                onChange={(event) => setDraft((current) => ({ ...current, footerText: event.target.value }))}
                value={draft.footerText}
              />
            </label>

            <div className="grid gap-3">
              {[
                ['Enable background blur', 'enableBackgroundBlur'],
                ['Enable background overlay', 'enableBackgroundOverlay'],
                ['Show powered-by footer', 'showPoweredByRegovise'],
              ].map(([label, key]) => (
                <label className="flex items-start gap-3 rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4" key={key}>
                  <input
                    checked={draft[key as keyof typeof draft] as boolean}
                    className="mt-1 h-4 w-4 rounded border-[#ded8e4] bg-white text-[#7a3ccf]"
                    onChange={() => setDraft((current) => ({ ...current, [key]: !(current[key as keyof typeof draft] as boolean) }))}
                    type="checkbox"
                  />
                  <div className="font-medium text-[#241232]">{label}</div>
                </label>
              ))}
            </div>

            <button className="button-primary" disabled={saving} onClick={() => setReviewSaveOpen(true)} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-[#7a3ccf]" />
              <h2 className="text-lg font-semibold text-[#241232]">Live preview</h2>
            </div>
            <div
              className="mt-5 overflow-hidden rounded-[28px] border border-[#ded8e4]"
              style={{ background: `linear-gradient(180deg, ${draft.bannerColor} 0%, ${draft.sidebarBackgroundColor} 100%)` }}
            >
              <div className="border-b border-[#ded8e4] px-5 py-4" style={{ backgroundColor: draft.bannerColor }}>
                <div className="text-sm font-medium text-[#241232]">Regovise Workspace</div>
              </div>
              <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                <div className="p-5 text-sm text-[#241232]" style={{ backgroundColor: draft.sidebarBackgroundColor }}>
                  <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: draft.primaryColor }}>
                    Primary action
                  </div>
                  <div className="mt-3 rounded-2xl border border-[#ded8e4] px-3 py-2" style={{ color: draft.accentColor }}>
                    Accent state
                  </div>
                </div>
                <div className="space-y-3 p-5 text-[#38254a]">
                  <div className="text-lg font-semibold text-[#241232]">Tenant sign-in</div>
                  <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 text-sm text-[#241232]">
                    {draft.loginMessage}
                  </div>
                  <div className="text-xs text-[#4f435c]">{draft.footerText}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <LayoutTemplate className="h-5 w-5 text-[#7a3ccf]" />
              <h2 className="text-lg font-semibold text-[#241232]">Readiness</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.visualReadiness.map((item) => (
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4" key={item.title}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-[#241232]">{item.title}</div>
                    <span className={item.status === 'Ready' || item.status === 'Customized' ? 'status-pill-positive' : 'status-pill-neutral'}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[#6f6578]">{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#7a3ccf]" />
              <h2 className="text-lg font-semibold text-[#241232]">Runtime contracts</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.runtimeContracts.map((item) => (
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 text-sm text-[#4f435c]" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <RegModal
        description="Review the tenant-facing identity settings before they are applied to the shell, sign-in experience, and generated outputs."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={saving} onClick={() => setReviewSaveOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              {saving ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        }
        onOpenChange={setReviewSaveOpen}
        open={reviewSaveOpen}
        title="Save branding"
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
            <div className="font-semibold text-[#241232]">Brand color review</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ['Primary', draft.primaryColor],
                ['Accent', draft.accentColor],
                ['Sidebar', draft.sidebarBackgroundColor],
                ['Banner', draft.bannerColor],
              ].map(([label, color]) => (
                <div className="flex items-center gap-3 rounded-2xl border border-[#ded8e4] bg-white p-3" key={label}>
                  <span className="h-6 w-6 rounded-full border border-[#ded8e4]" style={{ backgroundColor: color }} />
                  <span className="font-medium text-[#241232]">{label}: {color}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#ded8e4] bg-white p-4">
              <div className="label">Background blur</div>
              <div className="mt-2 font-semibold text-[#241232]">{draft.enableBackgroundBlur ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div className="rounded-3xl border border-[#ded8e4] bg-white p-4">
              <div className="label">Background overlay</div>
              <div className="mt-2 font-semibold text-[#241232]">{draft.enableBackgroundOverlay ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div className="rounded-3xl border border-[#ded8e4] bg-white p-4">
              <div className="label">Powered-by footer</div>
              <div className="mt-2 font-semibold text-[#241232]">{draft.showPoweredByRegovise ? 'Shown' : 'Hidden'}</div>
            </div>
          </div>
        </div>
      </RegModal>
    </div>
  );
}
