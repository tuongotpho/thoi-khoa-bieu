import { useEffect, useState } from 'react'

/**
 * Hộp hỏi / thông báo do app tự vẽ, thay cho confirm()/alert() của trình duyệt.
 * Hộp của trình duyệt có thể bị chặn ngầm (tự trả "Không" mà không hiện gì)
 * trong khung nhúng và một số trình duyệt — làm nút Lưu/Xoá "chết" không rõ lý do.
 */

interface Req {
  message: string
  ok: string
  cancel?: string
  danger?: boolean
  resolve: (v: boolean) => void
}

let push: ((r: Req) => void) | null = null
const queue: Req[] = []

export function ask(message: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const r: Req = { message, ok: opts.ok ?? 'Đồng ý', cancel: opts.cancel ?? 'Huỷ', danger: opts.danger, resolve }
    if (push) push(r)
    else queue.push(r)
  })
}

export function notify(message: string): Promise<void> {
  return new Promise((resolve) => {
    const r: Req = { message, ok: 'OK', resolve: () => resolve() }
    if (push) push(r)
    else queue.push(r)
  })
}

export function DialogHost() {
  const [items, setItems] = useState<Req[]>([])
  useEffect(() => {
    push = (r) => setItems((x) => [...x, r])
    if (queue.length) setItems(queue.splice(0))
    return () => { push = null }
  }, [])
  const cur = items[0]
  if (!cur) return null
  const done = (v: boolean) => { cur.resolve(v); setItems((x) => x.slice(1)) }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-8" role="alertdialog" aria-label={cur.message}>
      <div className="sheet-in w-full max-w-xs overflow-hidden rounded-2xl bg-card text-center shadow-xl">
        <p className="px-5 py-5 text-[15px] leading-snug whitespace-pre-line">{cur.message}</p>
        <div className={`grid border-t border-sep ${cur.cancel ? 'grid-cols-2' : ''}`}>
          {cur.cancel && (
            <button className="py-3 text-accent" onClick={() => done(false)}>{cur.cancel}</button>
          )}
          <button autoFocus onClick={() => done(true)}
            className={`py-3 font-semibold ${cur.cancel ? 'border-l border-sep' : ''} ${cur.danger ? 'text-red-500' : 'text-accent'}`}>
            {cur.ok}
          </button>
        </div>
      </div>
    </div>
  )
}
