import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { AppData } from './types'
import { buildWidgetFeed } from './widget'
import { fromISODate, toMinutes } from './time'

/** Cầu nối viết bằng Swift (ios/App/App/WidgetBridgePlugin.swift): ghi dữ liệu cho widget rồi bảo widget vẽ lại. */
const WidgetBridge = registerPlugin<{ save(o: { json: string }): Promise<void> }>('WidgetBridge')

export const isNative = Capacitor.isNativePlatform()

/** iOS chỉ giữ tối đa 64 thông báo chờ — đặt cho các tiết gần nhất, mỗi lần mở app đặt lại. */
const MAX_NOTI = 60

async function scheduleReminders(data: AppData, now: Date) {
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  const before = data.settings.reminderMinutes
  if (before <= 0) return
  const perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted' && (await LocalNotifications.requestPermissions()).display !== 'granted') return

  const notifications = []
  for (const day of buildWidgetFeed(data, now).days) {
    for (const l of day.lessons) {
      const at = fromISODate(day.date)
      at.setMinutes(toMinutes(l.start) - before)
      if (at <= now) continue
      notifications.push({
        id: notifications.length + 1,
        title: `Tiết ${l.period} ${l.session === 'am' ? 'sáng' : 'chiều'} · ${l.start}`,
        body: `${l.title}${l.detail ? ` - ${l.detail}` : ''} · còn ${before} phút`,
        schedule: { at, allowWhileIdle: true },
      })
      if (notifications.length >= MAX_NOTI) break
    }
    if (notifications.length >= MAX_NOTI) break
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

/** Gọi mỗi khi dữ liệu đổi hoặc app mở lại: cập nhật widget + đặt lại chuông báo. */
export async function syncNative(data: AppData) {
  if (!isNative) return
  const now = new Date()
  try {
    await WidgetBridge.save({ json: JSON.stringify(buildWidgetFeed(data, now)) })
  } catch (e) {
    console.warn('Không cập nhật được widget', e)
  }
  try {
    await scheduleReminders(data, now)
  } catch (e) {
    console.warn('Không đặt được chuông báo', e)
  }
}
