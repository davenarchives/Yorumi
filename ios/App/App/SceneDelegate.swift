import UIKit
import WebKit
import Network
import Capacitor

private let ytHudCleanerJS = """
(function () {
    try {
        if (!/youtube(-nocookie)?\\.com$/i.test(location.hostname) || location.pathname.indexOf('/embed/') !== 0) return;
        var css = '.ytp-bezel,.ytp-bezel-text-wrapper,.ytp-bezel-icon,.ytp-doubletap-ui-legacy,' +
            '.ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom,' +
            '.ytp-pause-overlay,.ytp-pause-overlay-container,.ytp-cued-thumbnail-overlay,' +
            '.ytp-large-play-button,.ytp-watermark,.ytp-title,.ytp-show-cards-title,' +
            '.player-controls-content,.player-controls-middle,.player-controls-top,.player-controls-bottom,' +
            '.player-controls-background,.player-controls-background-container,' +
            'ytm-custom-control,.ytm-autonav-overlay,.c3-overlay,.icon-button.player-control-play-pause-icon' +
            '{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;}';
        var style = document.createElement('style');
        style.id = 'yorumi-yt-hud-cleaner';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    } catch (e) {}
})();
"""

final class YorumiBridgeViewController: CAPBridgeViewController {
    var statusBarHiddenFlag = false

    override var prefersStatusBarHidden: Bool { statusBarHiddenFlag }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation { .fade }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = true
        return config
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ImmersiveModePlugin())
        bridge?.registerPluginInstance(LocalMediaProxyPlugin())
        if let webView = webView {
            let bg = UIColor(red: 9.0 / 255.0, green: 9.0 / 255.0, blue: 11.0 / 255.0, alpha: 1.0)
            webView.isOpaque = false
            webView.backgroundColor = bg
            webView.scrollView.backgroundColor = bg
            webView.scrollView.contentInsetAdjustmentBehavior = .never
            let script = WKUserScript(source: ytHudCleanerJS, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
            webView.configuration.userContentController.addUserScript(script)
        }
    }
}

final class ImmersiveModePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ImmersiveModePlugin"
    let jsName = "ImmersiveMode"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enterLandscape", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exitLandscape", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPictureInPictureEnabled", returnType: CAPPluginReturnPromise),
    ]

    private func setStatusBarHidden(_ hidden: Bool) {
        DispatchQueue.main.async { [weak self] in
            if let vc = self?.bridge?.viewController as? YorumiBridgeViewController {
                vc.statusBarHiddenFlag = hidden
                vc.setNeedsStatusBarAppearanceUpdate()
            }
        }
    }

    private func requestOrientation(_ mask: UIInterfaceOrientationMask) {
        DispatchQueue.main.async { [weak self] in
            guard let windowScene = self?.bridge?.viewController?.view.window?.windowScene else { return }
            if #available(iOS 16.0, *) {
                let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: mask)
                windowScene.requestGeometryUpdate(prefs) { _ in }
                self?.bridge?.viewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            }
        }
    }

    @objc func enter(_ call: CAPPluginCall) {
        setStatusBarHidden(true)
        call.resolve()
    }

    @objc func exit(_ call: CAPPluginCall) {
        setStatusBarHidden(false)
        call.resolve()
    }

    @objc func enterLandscape(_ call: CAPPluginCall) {
        setStatusBarHidden(true)
        requestOrientation(.landscape)
        call.resolve()
    }

    @objc func exitLandscape(_ call: CAPPluginCall) {
        setStatusBarHidden(false)
        let isPad = UIDevice.current.userInterfaceIdiom == .pad
        requestOrientation(isPad ? .all : .portrait)
        call.resolve()
    }

    @objc func setPictureInPictureEnabled(_ call: CAPPluginCall) {
        call.resolve()
    }
}

final class LocalMediaProxyPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LocalMediaProxyPlugin"
    let jsName = "LocalMediaProxy"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "createUrl", returnType: CAPPluginReturnPromise),
    ]

    private static let queue = DispatchQueue(label: "com.yorumi.localmediaproxy", qos: .userInitiated)
    private static var listener: NWListener?
    private static var boundPort: UInt16 = 0

    override func load() {
        Self.ensureStarted()
    }

    private static func ensureStarted() {
        queue.sync {
            if listener != nil && boundPort > 0 { return }
            do {
                let params = NWParameters.tcp
                params.requiredLocalEndpoint = NWEndpoint.hostPort(host: .ipv4(.loopback), port: .any)
                let newListener = try NWListener(using: params)
                let sem = DispatchSemaphore(value: 0)
                newListener.stateUpdateHandler = { state in
                    switch state {
                    case .ready:
                        if let port = newListener.port?.rawValue {
                            boundPort = port
                        }
                        sem.signal()
                    case .failed, .cancelled:
                        sem.signal()
                    default:
                        break
                    }
                }
                newListener.newConnectionHandler = { conn in
                    handleConnection(conn)
                }
                newListener.start(queue: DispatchQueue.global(qos: .userInitiated))
                _ = sem.wait(timeout: .now() + 2.0)
                listener = newListener
            } catch {
                print("[LocalMediaProxy] Failed to start NWListener: \(error)")
            }
        }
    }

    private static func handleConnection(_ connection: NWConnection) {
        connection.start(queue: DispatchQueue.global(qos: .userInitiated))
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { data, _, _, error in
            guard error == nil, let data = data, let requestText = String(data: data, encoding: .utf8) else {
                connection.cancel()
                return
            }

            let lines = requestText.components(separatedBy: "\r\n")
            guard let firstLine = lines.first else {
                connection.cancel()
                return
            }
            let parts = firstLine.split(separator: " ")
            guard parts.count >= 2 else {
                connection.cancel()
                return
            }
            let method = String(parts[0]).uppercased()
            let path = String(parts[1])

            if method == "OPTIONS" {
                sendResponse(connection, status: "204 No Content", headers: [
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                ], body: Data())
                return
            }

            guard let comps = URLComponents(string: "http://127.0.0.1\(path)"),
                  comps.path == "/proxy",
                  let rawUrl = comps.queryItems?.first(where: { $0.name == "url" })?.value,
                  let targetUrl = URL(string: rawUrl) else {
                sendResponse(connection, status: "400 Bad Request", headers: ["Content-Type": "text/plain"], body: Data("Missing url".utf8))
                return
            }

            let referer = comps.queryItems?.first(where: { $0.name == "referer" })?.value ?? ""
            var rangeHeader: String?
            for line in lines.dropFirst() {
                if line.lowercased().hasPrefix("range:") {
                    rangeHeader = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                    break
                }
            }

            var req = URLRequest(url: targetUrl, timeoutInterval: 25)
            req.httpMethod = method == "HEAD" ? "HEAD" : "GET"
            req.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")
            if !referer.isEmpty {
                req.setValue(referer, forHTTPHeaderField: "Referer")
                if let refUrl = URL(string: referer), let scheme = refUrl.scheme, let host = refUrl.host {
                    req.setValue("\(scheme)://\(host)", forHTTPHeaderField: "Origin")
                }
            }
            if let rangeHeader = rangeHeader, !rangeHeader.isEmpty {
                req.setValue(rangeHeader, forHTTPHeaderField: "Range")
            }

            URLSession.shared.dataTask(with: req) { respData, response, err in
                guard err == nil, let http = response as? HTTPURLResponse else {
                    sendResponse(connection, status: "502 Bad Gateway", headers: ["Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"], body: Data("Upstream failed".utf8))
                    return
                }

                var contentType = http.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream"
                var payload = respData ?? Data()
                let isPlaylist = rawUrl.lowercased().contains(".m3u8")
                    || contentType.lowercased().contains("mpegurl")
                    || (String(data: payload.prefix(16), encoding: .utf8)?.hasPrefix("#EXTM3U") == true)

                if isPlaylist, let text = String(data: payload, encoding: .utf8) {
                    let rewritten = rewritePlaylist(text, baseUrl: targetUrl, referer: referer, port: boundPort)
                    payload = Data(rewritten.utf8)
                    contentType = "application/vnd.apple.mpegurl"
                }

                var outHeaders: [String: String] = [
                    "Content-Type": contentType,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Accept-Ranges": "bytes",
                ]
                if let cr = http.value(forHTTPHeaderField: "Content-Range") {
                    outHeaders["Content-Range"] = cr
                }
                let statusLine = "\(http.statusCode) \(HTTPURLResponse.localizedString(forStatusCode: http.statusCode))"
                sendResponse(connection, status: statusLine, headers: outHeaders, body: method == "HEAD" ? Data() : payload)
            }.resume()
        }
    }

    private static func proxyUrlString(for absolute: String, referer: String, port: UInt16) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=?+#")
        let encUrl = absolute.addingPercentEncoding(withAllowedCharacters: allowed) ?? absolute
        let encRef = referer.addingPercentEncoding(withAllowedCharacters: allowed) ?? referer
        return "http://127.0.0.1:\(port)/proxy?url=\(encUrl)&referer=\(encRef)"
    }

    private static func rewritePlaylist(_ playlist: String, baseUrl: URL, referer: String, port: UInt16) -> String {
        let lines = playlist.components(separatedBy: .newlines)
        return lines.map { rawLine in
            let trimmed = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return rawLine }
            if trimmed.hasPrefix("#") {
                guard trimmed.contains("URI=\"") else { return rawLine }
                let pattern = "URI=\"([^\"]+)\""
                guard let regex = try? NSRegularExpression(pattern: pattern) else { return rawLine }
                let ns = trimmed as NSString
                let matches = regex.matches(in: trimmed, range: NSRange(location: 0, length: ns.length))
                var result = trimmed
                for match in matches.reversed() {
                    if match.numberOfRanges >= 2 {
                        let uriValue = ns.substring(with: match.range(at: 1))
                        if let resolved = URL(string: uriValue, relativeTo: baseUrl)?.absoluteString {
                            let proxied = proxyUrlString(for: resolved, referer: referer, port: port)
                            if let range = Range(match.range(at: 1), in: result) {
                                result.replaceSubrange(range, with: proxied)
                            }
                        }
                    }
                }
                return result
            }
            if let resolved = URL(string: trimmed, relativeTo: baseUrl)?.absoluteString {
                return proxyUrlString(for: resolved, referer: referer, port: port)
            }
            return rawLine
        }.joined(separator: "\n")
    }

    private static func sendResponse(_ connection: NWConnection, status: String, headers: [String: String], body: Data) {
        var headerLines = ["HTTP/1.1 \(status)"]
        for (k, v) in headers {
            headerLines.append("\(k): \(v)")
        }
        headerLines.append("Content-Length: \(body.count)")
        headerLines.append("Connection: close")
        headerLines.append("")
        headerLines.append("")
        var responseData = Data(headerLines.joined(separator: "\r\n").utf8)
        responseData.append(body)
        connection.send(content: responseData, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    @objc func createUrl(_ call: CAPPluginCall) {
        Self.ensureStarted()
        let url = call.getString("url") ?? ""
        let referer = call.getString("referer") ?? ""
        if url.isEmpty || Self.boundPort == 0 {
            call.resolve(["url": url])
            return
        }
        let proxied = Self.proxyUrlString(for: url, referer: referer, port: Self.boundPort)
        call.resolve(["url": proxied])
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.overrideUserInterfaceStyle = .dark
        window?.rootViewController = YorumiBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
