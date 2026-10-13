import { useEffect, type ReactNode } from 'react'

/** Tấm trượt từ dưới lên kiểu iOS, dùng cho các form thêm/sửa. */
export function Sheet({
  title, onClose, onSave, children, saveDisabled,
}: {
  title: string
  onClose: () => void
  onSave?: () => void
  saveDisabled?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="sheet-in flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-grouped sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-sep px-4 py-3">
          <button className="text-accent" onClick={onClose}>Huỷ</button>
          <h2 className="font-semibold">{title}</h2>
          {onSave ? (
            <button className="font-semibold text-accent disabled:opacity-30" disabled={saveDisabled} onClick={onSave}>
              Lưu
            </button>
          ) : <span className="w-8" />}
        </div>
        <div className="overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="mb-6">
      {title && <h3 className="mb-1.5 px-4 text-xs uppercase tracking-wide text-muted">{title}</h3>}
      <div className="divide-y divide-sep overflow-hidden rounded-xl bg-card">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-xs text-muted">{footer}</p>}
    </section>
  )
}

export function Row({ label, children, onClick }: { label: ReactNode; children?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left">
      <span className="shrink-0">{label}</span>
      <span className="ml-auto flex min-w-0 items-center justify-end gap-2 text-right text-muted">{children}</span>
    </Tag>
  )
}

export const inputCls =
  'w-full bg-transparent px-4 py-3 outline-none placeholder:text-muted/70'

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl leading-none text-white shadow-lg active:scale-95"
    >
      +
    </button>
  )
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-3 text-5xl">{icon}</div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}
