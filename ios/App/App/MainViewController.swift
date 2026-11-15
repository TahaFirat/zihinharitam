import UIKit
import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override open func viewDidLoad() {
        super.viewDidLoad()
        let warmPaper = UIColor(red: 250.0 / 255.0, green: 249.0 / 255.0, blue: 245.0 / 255.0, alpha: 1.0)
        view.backgroundColor = warmPaper
        webView?.isOpaque = false
        webView?.backgroundColor = warmPaper
        webView?.scrollView.backgroundColor = warmPaper
        webView?.scrollView.bounces = false
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        if #available(iOS 15.0, *) {
            bridge?.registerPluginInstance(StoreKitPlugin())
        }
    }
}
