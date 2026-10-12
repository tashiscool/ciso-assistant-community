import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button {...props} type={type} className={`aw-button aw-button--${variant} ${className}`} />;
}
export function Badge({ tone = 'purple', children, className = '' }: { tone?: 'purple' | 'danger' | 'warning' | 'success' | 'neutral'; children: ReactNode; className?: string }) {
  return <span className={`aw-badge aw-badge--${tone} ${className}`}>{children}</span>;
}
export function Tabs({ items, active, onChange, label = 'View' }: { items: { id: string; label: ReactNode }[]; active: string; onChange: (id: string) => void; label?: string }) {
  return <div className="aw-tabs" role="tablist" aria-label={label}>{items.map((item) => <button type="button" role="tab" key={item.id} aria-selected={item.id === active} className={item.id === active ? 'aw-tab aw-tab--active' : 'aw-tab'} onClick={() => onChange(item.id)} onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const current = items.findIndex((i) => i.id === item.id); const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length; onChange(items[index].id); (event.currentTarget.parentElement?.children[index] as HTMLButtonElement)?.focus(); }}>{item.label}</button>)}</div>;
}
export function EmptyState({ title, description }: { title: string; description?: string }) { return <div className="aw-empty"><h3>{title}</h3>{description ? <p className="aw-muted">{description}</p> : null}</div>; }
