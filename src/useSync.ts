import { useCallback, useEffect, useRef, useState } from 'react'
import type { Store } from './store'
import { decide, loadMeta, newSyncId, parseSyncInput, pull, push, saveMeta, type SyncMeta } from './sync'
import { ask, notify } from './components/dialog'

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error'

/** Đồng bộ chạy ngầm: sửa xong 1,5 giây thì gửi lên; mở / quay lại app thì kéo bản mới về. */
export function useSync(store: Store) {
  const [meta, setMetaState] = useState<SyncMeta | null>(loadMeta)
  const [status, setStatus] = useState<SyncStatus>(meta ? 'ok' : 'off')
  const [error, setError] = useState('')
  const [lastAt, setLastAt] = useState(0)
  const metaRef = useRef(meta)
  const dataRef = useRef(store.data)
  dataRef.current = store.data
  // store được tạo mới mỗi lần vẽ lại — giữ qua ref để các hàm đồng bộ không đổi theo.
  const storeRef = useRef(store)
  storeRef.current = store
  // Nội dung đã biết (vừa nạp / vừa lấy từ máy chủ). Chỉ khi nội dung KHÁC cái này mới là "vừa sửa"
  // — không dựa vào số lần vẽ lại (React chế độ kiểm tra chạy hiệu ứng 2 lần → tưởng nhầm là sửa).
  const knownJson = useRef(JSON.stringify(store.data))
  const busy = useRef(false)

  const setMeta = useCallback((m: SyncMeta | null) => {
    metaRef.current = m
    saveMeta(m)
    setMetaState(m)
  }, [])

  const syncNow = useCallback(async () => {
    const m = metaRef.current
    if (!m || busy.current) return
    busy.current = true
    setStatus('syncing')
    try {
      const remote = await pull(m.id)
      const cur = metaRef.current
      if (!cur || cur.id !== m.id) return
      // Vừa kết nối link mà máy chủ không có bộ lịch này → báo, không tự tạo bộ mới.
      if (!remote && cur.syncedAt === 0 && cur.localUpdatedAt === 0) {
        setMeta(null)
        setStatus('off')
        void notify('Không tìm thấy bộ lịch đồng bộ này — kiểm tra lại link.')
        return
      }
      // Vừa kết nối link → luôn lấy bản trên máy chủ, không bao giờ gửi đè trước.
      const d = cur.syncedAt === 0 && remote ? 'take-remote' : decide(cur, remote)
      if (d === 'take-remote' && remote) {
        knownJson.current = JSON.stringify(remote.data)
        storeRef.current.replaceAll(remote.data)
        setMeta({ ...cur, localUpdatedAt: remote.updatedAt, syncedAt: remote.updatedAt })
      } else if (d === 'push') {
        const at = cur.localUpdatedAt || Date.now()
        await push(cur.id, dataRef.current, at)
        setMeta({ ...cur, localUpdatedAt: at, syncedAt: at })
      }
      setError('')
      setStatus('ok')
      setLastAt(Date.now())
    } catch (e) {
      setError(navigator.onLine === false ? 'Đang mất mạng — có mạng sẽ tự đồng bộ' : (e as Error).message)
      setStatus('error')
    } finally {
      busy.current = false
      // Trong lúc đang đồng bộ mà đổi sang mã khác (vừa kết nối) → đồng bộ lại cho mã mới.
      if (metaRef.current && metaRef.current.id !== m.id) void syncNowRef.current()
    }
  }, [setMeta])
  const syncNowRef = useRef(syncNow)
  syncNowRef.current = syncNow

  // Sửa dữ liệu trên máy này → đánh dấu; còn chỗ sửa chưa gửi thì 1,5 giây sau gửi lên.
  useEffect(() => {
    const j = JSON.stringify(store.data)
    if (j !== knownJson.current) {
      knownJson.current = j
      const m = metaRef.current
      if (m) setMeta({ ...m, localUpdatedAt: Date.now() })
    }
    const cur = metaRef.current
    if (!cur || cur.localUpdatedAt <= cur.syncedAt) return
    const t = setTimeout(() => void syncNow(), 1500)
    return () => clearTimeout(t)
  }, [store.data, setMeta, syncNow])

  const connect = useCallback(async (id: string) => {
    if (dataRef.current.timetables.length > 0 &&
      !(await ask('Kết nối với bộ lịch đồng bộ này?\n\nLịch đang có trên máy này sẽ được thay bằng lịch đồng bộ.', { ok: 'Kết nối' }))) return
    setMeta({ id, localUpdatedAt: 0, syncedAt: 0 })
    await syncNow()
  }, [setMeta, syncNow])

  // Mở bằng link đồng bộ (…#sync=MÃ) — từ máy khác hoặc bấm vào widget.
  // Nghe cả 'hashchange': trang đang mở sẵn mà chỉ đổi phần sau dấu # thì không tải lại.
  useEffect(() => {
    const check = () => {
      const id = parseSyncInput(location.hash)
      if (!id) return
      history.replaceState(null, '', location.pathname + location.search)
      if (metaRef.current?.id !== id) void connect(id)
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [connect])

  // Mở app / quay lại app / có mạng trở lại → kéo bản mới.
  useEffect(() => {
    void syncNow()
    const onVis = () => document.visibilityState === 'visible' && void syncNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onVis) }
  }, [syncNow])

  return {
    meta, status, error, lastAt, syncNow,
    enable: async () => {
      setMeta({ id: newSyncId(), localUpdatedAt: Date.now(), syncedAt: 0 })
      await syncNow()
    },
    connectInput: async (input: string) => {
      const id = parseSyncInput(input)
      if (!id) return notify('Mã hoặc link đồng bộ không đúng.')
      await connect(id)
    },
    disable: async () => {
      if (!(await ask('Tắt đồng bộ trên máy này? Lịch vẫn giữ trên máy, nhưng không tự cập nhật với máy khác nữa.', { ok: 'Tắt' }))) return
      setMeta(null)
      setStatus('off')
    },
  }
}

export type Sync = ReturnType<typeof useSync>
