import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { readPreference, removePreference, writePreference } from '../shared/browser/preferences';

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
      return 'border-[#d7c3f1] bg-[#f7f2ff]';
    case 'caution':
      return 'border-[#f6d48e] bg-[#fff8eb]';
    default:
      return 'border-[#ded8e4] bg-white';
  }
}

export function CoachMarksPanel({ storageKey, title, description, items }: CoachMarksPanelProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readPreference(`${STORAGE_PREFIX}${storageKey}`) === 'hidden');
  }, [storageKey]);

  if (items.length === 0) {
    return null;
  }

  function hidePanel() {
    setHidden(true);
    writePreference(`${STORAGE_PREFIX}${storageKey}`, 'hidden');
  }

  function showPanel() {
    setHidden(false);
    removePreference(`${STORAGE_PREFIX}${storageKey}`);
  }

  if (hidden) {
    return (
      <section className="panel-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-[#4f435c]">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d7c3f1] bg-[#f2e8ff] text-[#7c2bd9]">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-[#241232]">{title}</div>
            <div className="text-xs text-[#62576a]">Show the quick guide again if you want a refresher.</div>
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
          <h2 className="mt-2 flex items-center gap-3 text-xl font-semibold text-[#241232]">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#d7c3f1] bg-[#f2e8ff] text-[#7c2bd9]">
              <Lightbulb className="h-5 w-5" />
            </span>
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#4f435c]">{description}</p>
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#cfc7d8] bg-white text-[#6f6578] transition hover:bg-[#f6f1fa] hover:text-[#241232]"
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
            className={cn('rounded-lg border p-4', toneClass(item.tone))}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#62576a]">
                  {item.eyebrow ?? `Step ${index + 1}`}
                </div>
                <div className="mt-2 text-base font-semibold text-[#241232]">{item.title}</div>
              </div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#ded8e4] bg-[#fbf9fc] px-2 text-xs font-medium text-[#4f435c]">
                {index + 1}
              </span>
            </div>
            <div className="mt-3 text-sm leading-6 text-[#4f435c]">{item.body}</div>
            {item.route ? (
              <Link className="mt-4 inline-flex items-center text-sm font-medium text-[#6f20c9] transition hover:text-[#4f148f]" to={item.route}>
                {item.ctaLabel ?? 'Open'}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
