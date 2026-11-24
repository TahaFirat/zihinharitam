import UIKit
import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    private var lastPencilToggleAt: CFTimeInterval = 0

    override open func viewDidLoad() {
        super.viewDidLoad()
        let warmPaper = UIColor(red: 250.0 / 255.0, green: 249.0 / 255.0, blue: 245.0 / 255.0, alpha: 1.0)
        view.backgroundColor = warmPaper
        webView?.isOpaque = false
        webView?.backgroundColor = warmPaper

        // Permanently lock WKWebView UIScrollView zoom & offset so iOS NEVER auto-zooms
        // or leaves the viewport stuck zoomed/shifted when focusing text inputs or search bars!
        if let scrollView = webView?.scrollView {
            scrollView.backgroundColor = warmPaper
            scrollView.bounces = false
            scrollView.bouncesZoom = false
            scrollView.isScrollEnabled = false
            scrollView.minimumZoomScale = 1.0
            scrollView.maximumZoomScale = 1.0
            scrollView.zoomScale = 1.0
            scrollView.contentInsetAdjustmentBehavior = .never
            scrollView.delegate = self
        }

        // Native Apple Pencil 2nd Gen Double-Tap & Apple Pencil Pro Squeeze -> Pen/Eraser Toggle
        if #available(iOS 12.1, *), let wv = webView {
            let pencilInteraction = UIPencilInteraction()
            pencilInteraction.delegate = self
            wv.addInteraction(pencilInteraction)
        }
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        if #available(iOS 15.0, *) {
            bridge?.registerPluginInstance(StoreKitPlugin())
        }
    }

    fileprivate func dispatchApplePencilToggle(gesture: String) {
        // Debounce 240ms so iOS 17.5+ never double-fires legacy + modern delegate callbacks
        // (which would otherwise toggle Eraser -> Pen instantaneously!)
        let now = CACurrentMediaTime()
        guard now - lastPencilToggleAt > 0.24 else { return }
        lastPencilToggleAt = now

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('zh:stylus-eraser-toggle', { detail: { source: 'apple_pencil', gesture: '\(gesture)' } }));",
                completionHandler: nil
            )
        }
    }
}

extension MainViewController: UIScrollViewDelegate {
    public func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        return nil
    }

    public func scrollViewDidZoom(_ scrollView: UIScrollView) {
        if scrollView.zoomScale != 1.0 {
            scrollView.setZoomScale(1.0, animated: false)
        }
    }

    public func scrollViewDidScroll(_ scrollView: UIScrollView) {
        if scrollView.contentOffset != .zero {
            scrollView.contentOffset = .zero
        }
    }
}

@available(iOS 12.1, *)
extension MainViewController: UIPencilInteractionDelegate {
    public func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        dispatchApplePencilToggle(gesture: "double_tap")
    }

    @available(iOS 17.5, *)
    public func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
        dispatchApplePencilToggle(gesture: "double_tap")
    }

    @available(iOS 17.5, *)
    public func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
        if squeeze.phase == .ended {
            dispatchApplePencilToggle(gesture: "squeeze")
        }
    }
}
