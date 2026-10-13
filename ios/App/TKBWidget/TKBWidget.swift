import WidgetKit
import SwiftUI

// MARK: - Dữ liệu (app ghi vào App Group, xem src/widget.ts)

struct WLesson: Codable, Hashable {
    let start: String
    let end: String
    let period: Int
    let session: String
    let title: String
    let detail: String
    let color: String
}

struct WDay: Codable {
    let date: String
    let lessons: [WLesson]
}

struct WFeed: Codable {
    let v: Int
    let days: [WDay]
}

enum FeedStore {
    /// Giống phía app: ưu tiên tên ngăn do AltStore ghi vào Info.plist (ALTAppGroups).
    static var appGroup: String {
        (Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String])?.first
            ?? "group.com.august87.thoikhoabieu"
    }

    static func load() -> WFeed? {
        guard let s = UserDefaults(suiteName: appGroup)?.string(forKey: "feed"),
              let data = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WFeed.self, from: data)
    }
}

// MARK: - Tính toán ngày giờ

private let cal = Calendar(identifier: .gregorian)

/// "2026-10-14" + "07:15" → Date theo giờ máy
func makeDate(_ iso: String, _ hhmm: String = "00:00") -> Date? {
    let d = iso.split(separator: "-").compactMap { Int($0) }
    let t = hhmm.split(separator: ":").compactMap { Int($0) }
    guard d.count == 3, t.count == 2 else { return nil }
    return cal.date(from: DateComponents(year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1]))
}

/// Ngày đang hiển thị trên widget: hôm nay nếu còn tiết chưa xong, không thì ngày gần nhất có tiết.
struct Shown {
    let heading: String
    let date: String
    let lessons: [WLesson]
}

private let dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]

func pick(_ feed: WFeed, now: Date) -> Shown? {
    let today = cal.startOfDay(for: now)
    for day in feed.days {
        guard let start = makeDate(day.date), !day.lessons.isEmpty else { continue }
        let dayStart = cal.startOfDay(for: start)
        if dayStart < today { continue }
        if dayStart == today {
            let hasLeft = day.lessons.contains { (makeDate(day.date, $0.end) ?? .distantPast) > now }
            if !hasLeft { continue }
        }
        let diff = cal.dateComponents([.day], from: today, to: dayStart).day ?? 0
        let heading: String
        switch diff {
        case 0: heading = "Hôm nay"
        case 1: heading = "Ngày mai"
        default:
            let wd = cal.component(.weekday, from: dayStart) - 1
            heading = "\(dayNames[wd]), \(cal.component(.day, from: dayStart))/\(cal.component(.month, from: dayStart))"
        }
        return Shown(heading: heading, date: day.date, lessons: day.lessons)
    }
    return nil
}

// MARK: - Timeline: tự đổi đúng lúc vào/ra tiết, không cần mở app

struct Entry: TimelineEntry {
    let date: Date
    let feed: WFeed?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), feed: Self.sample) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), feed: FeedStore.load() ?? Self.sample))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let now = Date()
        let feed = FeedStore.load()
        var moments: Set<Date> = [now]
        // Mỗi lúc bắt đầu / kết thúc tiết trong 3 ngày tới, và mỗi nửa đêm.
        for day in (feed?.days ?? []).prefix(4) {
            if let midnight = makeDate(day.date), midnight > now { moments.insert(midnight) }
            for l in day.lessons {
                for t in [l.start, l.end] {
                    if let d = makeDate(day.date, t), d > now { moments.insert(d) }
                }
            }
        }
        let sorted = moments.sorted().prefix(60)
        let entries = sorted.map { Entry(date: $0, feed: feed) }
        let next = sorted.last.map { max($0, now.addingTimeInterval(3600)) } ?? now.addingTimeInterval(6 * 3600)
        completion(Timeline(entries: entries, policy: .after(next)))
    }

    static let sample = WFeed(v: 1, days: [WDay(date: "2026-10-14", lessons: [
        WLesson(start: "07:15", end: "08:00", period: 1, session: "am", title: "11A4", detail: "", color: "#34c759"),
        WLesson(start: "08:05", end: "08:50", period: 2, session: "am", title: "11A8", detail: "", color: "#00a8a0"),
        WLesson(start: "13:00", end: "13:45", period: 1, session: "pm", title: "10A4", detail: "", color: "#ff3b30"),
        WLesson(start: "14:45", end: "15:30", period: 3, session: "pm", title: "10A4", detail: "GDĐP", color: "#ff3b30"),
    ])])
}

// MARK: - Giao diện

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

extension View {
    @ViewBuilder func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { Color(UIColor.systemBackground) }
        } else {
            background(Color(UIColor.systemBackground))
        }
    }
}

enum LessonState { case past, now, future }

func state(_ l: WLesson, on date: String, now: Date) -> LessonState {
    guard let s = makeDate(date, l.start), let e = makeDate(date, l.end) else { return .future }
    if e <= now { return .past }
    if s <= now { return .now }
    return .future
}

/// Một dòng giống mẫu: "07:15  Tiết 1: 11A4 ............ GDĐP"
struct LessonRow: View {
    let lesson: WLesson
    let st: LessonState
    var compact = false

    var body: some View {
        HStack(spacing: 8) {
            Text(lesson.start)
                .font(.system(size: compact ? 11 : 13, weight: .medium).monospacedDigit())
                .opacity(0.9)
            Text("Tiết \(lesson.period): \(lesson.title)")
                .font(.system(size: compact ? 13 : 16, weight: .bold))
                .lineLimit(1)
            Spacer(minLength: 4)
            if !lesson.detail.isEmpty {
                Text(lesson.detail).font(.system(size: compact ? 11 : 13, weight: .medium)).lineLimit(1).opacity(0.9)
            }
        }
        .foregroundColor(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, compact ? 4 : 7)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 7).fill(Color(hex: lesson.color)))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(Color.primary, lineWidth: st == .now ? 2 : 0))
        .opacity(st == .past ? 0.4 : 1)
    }
}

struct EmptyView2: View {
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Thời khoá biểu").font(.headline)
            Text(text).font(.subheadline).foregroundColor(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct WidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        if family == .accessoryInline || family == .accessoryRectangular {
            // Màn hình khoá: iOS tự lo nền.
            if #available(iOSApplicationExtension 17.0, *) {
                content.containerBackground(for: .widget) { Color.clear }
            } else {
                content
            }
        } else {
            content.widgetBackground()
        }
    }

    @ViewBuilder var content: some View {
        if let feed = entry.feed {
            if let shown = pick(feed, now: entry.date) {
                switch family {
                case .systemSmall: small(shown)
                case .accessoryRectangular: rectangular(shown)
                case .accessoryInline: inline(shown)
                default: list(shown, max: family == .systemLarge ? 9 : 4, compact: family == .systemMedium)
                }
            } else {
                EmptyView2(text: "Không có tiết nào trong 2 tuần tới")
            }
        } else {
            EmptyView2(text: "Mở app để nhập thời khoá biểu")
        }
    }

    /// Cỡ vừa/lớn — giống mẫu: tiêu đề, các dải màu, số tiết ở cuối.
    func list(_ s: Shown, max: Int, compact: Bool) -> some View {
        // Cỡ vừa chật: bỏ bớt các tiết đã xong để thấy tiết sắp tới.
        let upcoming = s.lessons.filter { state($0, on: s.date, now: entry.date) != .past }
        let rows = compact && s.lessons.count > max ? Array(upcoming.prefix(max)) : Array(s.lessons.prefix(max))
        return VStack(alignment: .leading, spacing: compact ? 4 : 6) {
            Text(s.heading).font(.system(size: compact ? 14 : 17, weight: .bold))
            ForEach(rows, id: \.self) { l in
                LessonRow(lesson: l, st: state(l, on: s.date, now: entry.date), compact: compact)
            }
            Spacer(minLength: 0)
            if !compact {
                Text("\(s.lessons.count) tiết").font(.footnote).foregroundColor(.secondary)
            }
        }
    }

    /// Cỡ nhỏ: tiết đang dạy / tiết tiếp theo.
    func small(_ s: Shown) -> some View {
        let l = s.lessons.first { state($0, on: s.date, now: entry.date) != .past } ?? s.lessons[0]
        let isNow = state(l, on: s.date, now: entry.date) == .now
        return VStack(alignment: .leading, spacing: 2) {
            Text(isNow ? "ĐANG DẠY" : s.heading.uppercased())
                .font(.caption2.weight(.bold)).foregroundColor(Color(hex: l.color))
            Text(l.title).font(.system(size: 28, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
            Text(l.detail.isEmpty ? "Tiết \(l.period)" : "Tiết \(l.period) · \(l.detail)")
                .font(.subheadline).foregroundColor(.secondary).lineLimit(1)
            Spacer(minLength: 0)
            Text(isNow ? "đến \(l.end)" : l.start).font(.title3.weight(.semibold).monospacedDigit())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Màn hình khoá (chữ nhật).
    func rectangular(_ s: Shown) -> some View {
        let l = s.lessons.first { state($0, on: s.date, now: entry.date) != .past } ?? s.lessons[0]
        return VStack(alignment: .leading, spacing: 0) {
            Text("\(s.heading) · \(l.start)").font(.caption.weight(.semibold))
            Text("Tiết \(l.period): \(l.title)").font(.headline).lineLimit(1)
            if !l.detail.isEmpty { Text(l.detail).font(.caption).lineLimit(1) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Màn hình khoá (một dòng phía trên đồng hồ).
    func inline(_ s: Shown) -> some View {
        let l = s.lessons.first { state($0, on: s.date, now: entry.date) != .past } ?? s.lessons[0]
        return Text("\(l.start) Tiết \(l.period): \(l.title)")
    }
}

// MARK: - Khai báo widget

struct TKBWidget: Widget {
    let kind = "TKBWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetView(entry: entry)
        }
        .configurationDisplayName("Thời khoá biểu")
        .description("Các tiết hôm nay, hết tiết thì chuyển sang ngày mai.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct TKBWidgetBundle: WidgetBundle {
    var body: some Widget {
        TKBWidget()
    }
}
