import { useState } from 'react'
import type { Sync } from '../useSync'
import { Group, inputCls } from './ui'
import { appUrl } from './WidgetSetup'

function ago(t: number) {
  if (!t) return ''
  const s = Math.round((Date.now() - t) / 1000)
  return s < 60 ? 'vừa xong' : `${Math.round(s / 60)} phút trước`
}

export const syncLink = (id: string) => `${appUrl()}#sync=${id}`

export function SyncSection({ sync }: { sync: Sync }) {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const { meta, status, error, lastAt } = sync

  if (!meta) {
    return (
      <Group title="Đồng bộ nhiều máy"
        footer="Bật trên một máy rồi mở link đồng bộ trên máy khác (iPhone, máy tính…). Sửa ở đâu, máy kia tự cập nhật. Không cần tài khoản — ai có link mới xem được lịch.">
        <button className="w-full px-4 py-3 text-left font-semibold text-accent" onClick={() => void sync.enable()}>
          🔄 Bật đồng bộ (tạo bộ lịch mới)
        </button>
        <div className="flex items-center">
          <input className={inputCls} placeholder="…hoặc dán link / mã đồng bộ từ máy khác" value={input}
            onChange={(e) => setInput(e.target.value)} autoComplete="off" autoCapitalize="off" />
          <button className="shrink-0 px-4 font-semibold text-accent disabled:opacity-30" disabled={!input.trim()}
            onClick={() => { void sync.connectInput(input); setInput('') }}>Kết nối</button>
        </div>
      </Group>
    )
  }

  const link = syncLink(meta.id)
  return (
    <Group title="Đồng bộ nhiều máy"
      footer="Mở link này trên máy khác (gửi qua Zalo, email…) để dùng chung bộ lịch. Giữ kín link — ai có link đều xem và sửa được lịch.">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${status === 'error' ? 'bg-red-500' : status === 'syncing' ? 'animate-pulse bg-orange-400' : 'bg-green-500'}`} />
        <span className="text-sm">
          {status === 'syncing' ? 'Đang đồng bộ…' : status === 'error' ? error : `Đã đồng bộ ${ago(lastAt)}`}
        </span>
        <button className="ml-auto text-sm text-accent" onClick={() => void sync.syncNow()}>Đồng bộ ngay</button>
      </div>
      <button className="w-full px-4 py-3 text-left font-semibold text-accent" onClick={async () => {
        try {
          await navigator.clipboard.writeText(link)
          setCopied(true)
        } catch {
          setShowLink(true)
        }
      }}>
        🔗 Chép link đồng bộ {copied && <span className="font-normal text-green-600">✓ đã chép</span>}
      </button>
      {showLink && (
        <input readOnly value={link} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
      )}
      <button className="w-full px-4 py-3 text-left text-red-500" onClick={() => void sync.disable()}>Tắt đồng bộ trên máy này</button>
    </Group>
  )
}
