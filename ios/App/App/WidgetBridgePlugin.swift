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

    static let appGroup = "group.com.august87.thoikhoabieu"

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
