import { useState } from 'react'
import { buildScriptableScript } from '../widget'
import type { Store } from '../store'
import { docUrl, loadMeta } from '../sync'
import { Group } from './ui'

export const appUrl = () => new URL(import.meta.env.BASE_URL, location.origin).href

/** TKB đã đổi sau lần chép mã widget gần nhất → widget đang hiện lịch cũ. */
export function widgetOutdated(store: Store): boolean {
  if (loadMeta()) return false // đang đồng bộ → widget tự lấy lịch mới
  const at = store.data.settings.widgetCopiedAt
  return !!at && store.data.timetables.some((t) => t.createdAt > at)
}

export function WidgetSetup({ store }: { store: Store }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const [code, setCode] = useState('')
  const outdated = widgetOutdated(store)

  const copy = async () => {
    // Có đồng bộ: widget tự lấy lịch mới từ máy chủ, bấm vào widget mở web kèm mã đồng bộ.
    const meta = loadMeta()
    const script = meta
      ? buildScriptableScript(store.data, `${appUrl()}#sync=${meta.id}`, docUrl(meta.id))
      : buildScriptableScript(store.data, appUrl())
    store.updateSettings({ widgetCopiedAt: new Date().toISOString() })
    try {
      await navigator.clipboard.writeText(script)
      setState('copied')
    } catch {
      // Trình duyệt không cho chép tự động → hiện mã để tự chọn & chép.
      setCode(script)
      setState('manual')
    }
  }

  return (
    <Group title="Widget màn hình chính">
      {outdated && (
        <p className="bg-orange-500/10 px-4 py-2.5 text-sm text-orange-600 dark:text-orange-400">
          Thời khoá biểu đã đổi — bấm “Chép mã widget” và dán lại vào Scriptable để widget cập nhật.
        </p>
      )}
      <button className="w-full px-4 py-3 text-left font-semibold text-accent" onClick={copy}>
        📋 Chép mã widget
      </button>
      {state === 'copied' && <p className="px-4 py-2.5 text-sm text-green-600">✓ Đã chép. Giờ mở Scriptable và dán vào (bước 3 bên dưới).</p>}
      {state === 'manual' && (
        <div className="px-4 py-2.5">
          <p className="mb-2 text-sm text-orange-600">Không chép tự động được — chạm giữ ô dưới, chọn “Chọn tất cả” rồi “Sao chép”.</p>
          <textarea readOnly value={code} className="h-32 w-full rounded-lg bg-grouped p-2 font-mono text-[10px]"
            onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      <ol className="list-decimal space-y-1.5 py-3 pr-4 pl-9 text-sm leading-relaxed">
        <li>Cài app <b>Scriptable</b> (miễn phí) từ App Store — chỉ làm một lần.</li>
        <li>Bấm <b>“Chép mã widget”</b> ở trên.</li>
        <li>Mở Scriptable → bấm <b>+</b> (góc trên phải) → chạm vào vùng trống → <b>Dán</b>. Bấm tên “Untitled Script” ở trên cùng, đổi thành <b>TKB</b>, rồi bấm <b>Done</b>.</li>
        <li>Ra màn hình chính, chạm giữ chỗ trống → <b>Sửa</b> → <b>Thêm tiện ích</b> → chọn <b>Scriptable</b> → chọn cỡ (lớn giống mẫu) → <b>Thêm tiện ích</b>.</li>
        <li>Chạm giữ widget vừa thêm → <b>Sửa tiện ích</b> → mục <b>Script</b> chọn <b>TKB</b>; mục <b>When Interacting</b> chọn <b>Open URL</b> để bấm vào widget là mở app này.</li>
      </ol>
      <p className="px-4 pb-3 text-xs text-muted">
        Màn hình khoá cũng thêm được (Sửa màn hình khoá → thêm tiện ích Scriptable). iOS tự quyết lúc vẽ lại widget nên đôi khi chuyển tiết trễ vài phút.
        {loadMeta()
          ? 'Đang bật đồng bộ: widget tự lấy lịch mới, đổi thời khoá biểu không cần chép lại mã.'
          : 'Khi trường đổi thời khoá biểu: lưu bản mới ở tab TKB rồi chép và dán lại mã. (Bật “Đồng bộ nhiều máy” bên dưới thì widget tự cập nhật.)'}
      </p>
    </Group>
  )
}
