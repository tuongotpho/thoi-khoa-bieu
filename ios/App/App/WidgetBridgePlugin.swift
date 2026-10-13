import Foundation
import Capacitor
import WidgetKit

/// Nhận dữ liệu lịch từ phần web của app, cất vào ngăn chung (App Group) để widget đọc,
/// rồi bảo iOS vẽ lại widget.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    /// Tên ngăn dữ liệu chung. AltStore (cài bằng Apple ID miễn phí) đổi tên này và ghi tên mới
    /// vào mục ALTAppGroups của Info.plist — có thì dùng tên đó, không thì dùng tên gốc.
    static var appGroup: String {
        (Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String])?.first
            ?? "group.com.august87.thoikhoabieu"
    }

    @objc func save(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("Thiếu dữ liệu")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("Chưa bật App Group cho app")
            return
        }
        defaults.set(json, forKey: "feed")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
