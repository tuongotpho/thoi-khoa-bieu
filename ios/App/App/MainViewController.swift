import UIKit
import Capacitor

/// Màn hình chính của app — đăng ký thêm cầu nối widget (plugin viết riêng trong app).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
