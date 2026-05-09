import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { cn } from '../lib/utils';

type CoachMarkTone = 'neutral' | 'focus' | 'caution';

export type CoachMarkItem = {
  id: string;
  title: string;
  body: string;
  route?: string;
  ctaLabel?: string;
  eyebrow?: string;
  tone?: CoachMarkTone;
};

type CoachMarksPanelProps = {
  storageKey: string;
  title: string;
  description: string;
  items: CoachMarkItem[];
};

const STORAGE_PREFIX = 'regovise.coachmarks.';

function toneClass(tone: CoachMarkTone | undefined) {
  switch (tone) {
    case 'focus':
      return 'border-cyan-300/15 bg-cyan-400/[0.04]';
    case 'caution':
      return 'border-amber-300/15 bg-amber-400/[0.04]';
    default:
      return 'border-white/10 bg-slate-950/25';
  }
}

export function CoachMarksPanel({ storageKey, title, description, items }: CoachMarksPanelProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setHidden(window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`) === 'hidden');
  }, [storageKey]);

  if (items.length === 0) {
    return null;
  }

  function hidePanel() {
    setHidden(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, 'hidden');
    }
  }

  function showPanel() {
    setHidden(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    }
  }

  if (hidden) {
    return (
      <section className="panel-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-cyan-300">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-white">{title}</div>
            <div className="text-xs text-slate-500">Show the quick guide again if you want a refresher.</div>
          </div>
        </div>
        <button className="button-secondary" onClick={showPanel} type="button">
          Show guide
        </button>
      </section>
    );
  }

  return (
    <section className="panel-subtle overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="eyebrow">Coach marks</div>
          <h2 className="mt-2 flex items-center gap-3 text-xl font-semibold text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] text-cyan-300">
              <Lightbulb className="h-5 w-5" />
            </span>
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-white/20 hover:text-white"
          onClick={hidePanel}
          type="button"
          aria-label="Hide guide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn('rounded-3xl border p-4', toneClass(item.tone))}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {item.eyebrow ?? `Step ${index + 1}`}
                </div>
                <div className="mt-2 text-base font-semibold text-white">{item.title}</div>
              </div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-2 text-xs font-medium text-slate-300">
                {index + 1}
              </span>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-300">{item.body}</div>
            {item.route ? (
              <Link className="mt-4 inline-flex items-center text-sm font-medium text-cyan-300 transition hover:text-cyan-200" to={item.route}>
                {item.ctaLabel ?? 'Open'}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
