import type { AppData } from './types'
import { parseData } from './store'
import { buildScriptableData } from './widget'

/**
 * Đồng bộ nhiều máy không cần đăng nhập: mỗi bộ lịch là một tài liệu Firestore sync/{mã},
 * mã ngẫu nhiên 24 ký tự (ai có mã mới đọc/ghi được — xem firestore.rules).
 * Gọi thẳng REST API, không dùng thư viện Firebase, để app nhẹ và widget Scriptable gọi y hệt.
 * Khoá dưới đây là mã định danh công khai của project Firebase, không phải bí mật.
 */
const PROJECT = 'thoi-khoa-bieu-87'
const API_KEY = 'AIzaSyA8SUyJr_vf3TqDyEIhTb4-rpHoYC5S5AY'
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/sync`

export const docUrl = (id: string) => `${BASE}/${id}?key=${API_KEY}`

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Mã đồng bộ 24 ký tự ngẫu nhiên (~140 bit) — không đoán mò được. */
export function newSyncId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Lấy mã từ link đồng bộ (…#sync=MÃ) hoặc chính mã dán vào. */
export function parseSyncInput(s: string): string {
  const t = s.trim()
  const m = t.match(/[#&?]sync=([A-Za-z0-9]{20,64})/)
  if (m) return m[1]
  return /^[A-Za-z0-9]{20,64}$/.test(t) ? t : ''
}

export interface Remote {
  data: AppData
  updatedAt: number
}

/** Kéo bộ lịch về. Chưa có trên máy chủ → null. */
export async function pull(id: string): Promise<Remote | null> {
  const r = await fetch(docUrl(id), { cache: 'no-store' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Máy chủ đồng bộ báo lỗi ${r.status}`)
  const doc = await r.json()
  const f = doc.fields ?? {}
  return {
    data: parseData(JSON.parse(f.data?.stringValue ?? '{}')),
    updatedAt: Number(f.updatedAt?.integerValue ?? 0),
  }
}

/** Đẩy bộ lịch lên, kèm sẵn dữ liệu cho widget để Scriptable khỏi phải tính. */
export async function push(id: string, data: AppData, updatedAt: number): Promise<void> {
  const r = await fetch(docUrl(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        data: { stringValue: JSON.stringify(data) },
        widget: { stringValue: JSON.stringify(buildScriptableData(data)) },
        updatedAt: { integerValue: String(updatedAt) },
      },
    }),
  })
  if (!r.ok) throw new Error(`Không gửi được lên máy chủ đồng bộ (lỗi ${r.status})`)
}

// ---------- Trạng thái đồng bộ trên máy này ----------

const META_KEY = 'tkb-sync-v1'

export interface SyncMeta {
  id: string
  /** Lúc sửa gần nhất trên máy này */
  localUpdatedAt: number
  /** Mốc của bản trên máy chủ mà máy này đã khớp */
  syncedAt: number
}

export function loadMeta(): SyncMeta | null {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null')
    return m && typeof m.id === 'string' ? m : null
  } catch {
    return null
  }
}

export function saveMeta(m: SyncMeta | null) {
  try {
    if (m) localStorage.setItem(META_KEY, JSON.stringify(m))
    else localStorage.removeItem(META_KEY)
  } catch {
    /* chế độ riêng tư */
  }
}

/**
 * Quyết định khi mở app / quay lại app:
 * - máy chủ có bản mới hơn mà máy này không sửa gì → lấy bản máy chủ
 * - máy này có sửa chưa gửi → gửi lên (nếu máy chủ cũng đổi thì bản sửa sau cùng thắng)
 */
export function decide(meta: SyncMeta, remote: Remote | null): 'take-remote' | 'push' | 'nothing' {
  if (!remote) return 'push'
  const localDirty = meta.localUpdatedAt > meta.syncedAt
  const remoteChanged = remote.updatedAt > meta.syncedAt
  if (remoteChanged && (!localDirty || remote.updatedAt >= meta.localUpdatedAt)) return 'take-remote'
  if (localDirty) return 'push'
  return 'nothing'
}
