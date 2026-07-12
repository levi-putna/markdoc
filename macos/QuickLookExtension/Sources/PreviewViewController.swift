import Cocoa
import Quartz
import WebKit

/// Quick Look preview controller that renders Markdown files as formatted HTML.
final class PreviewViewController: NSViewController, QLPreviewingController {
    private static let maxBytes = 1_048_576

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 640, height: 800))
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.textBackgroundColor.cgColor
    }

    func preparePreviewOfFile(at url: URL) async throws {
        let source = try readCapped(url)
        let markdown = MarkdownFrontMatter.strip(from: source)

        if markdown.isEmpty {
            embed(textFallback(source))
            return
        }

        do {
            let html = try buildPreviewHTML(markdown: markdown)
            let baseURL = url.deletingLastPathComponent()
            embed(webView(html: html, baseURL: baseURL))
        } catch {
            embed(textFallback(source))
        }
    }

    private func readCapped(_ url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        let data = handle.readData(ofLength: Self.maxBytes)
        if let utf8 = String(data: data, encoding: .utf8) {
            return utf8
        }

        // Latin-1 maps every byte 0x00-0xFF to a scalar, so this never
        // actually fails for arbitrary bytes — the standard library has no
        // bare `Latin1` Unicode encoding type (unlike `Unicode.ASCII`), so
        // Foundation's `String.Encoding.isoLatin1` is the correct API here,
        // not `String(decoding:as:)`. Falls back to a lossy UTF-8 decode
        // (never fails) in the practically-impossible case this returns nil.
        return String(data: data, encoding: .isoLatin1) ?? String(decoding: data, as: UTF8.self)
    }

    private func buildPreviewHTML(markdown: String) throws -> String {
        guard let templateURL = Bundle.main.url(forResource: "preview-template", withExtension: "html"),
              var html = try? String(contentsOf: templateURL, encoding: .utf8) else {
            throw PreviewError.missingTemplate
        }

        let jsonData = try JSONSerialization.data(withJSONObject: markdown, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            throw PreviewError.encodingFailed
        }

        html = html.replacingOccurrences(of: "/*__MARKDOWN_SOURCE__*/", with: jsonString)
        return html
    }

    private func webView(html: String, baseURL: URL) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(false, forKey: "developerExtrasEnabled")

        let webView = WKWebView(frame: view.bounds, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")
        webView.loadHTMLString(html, baseURL: baseURL)
        return webView
    }

    private func textFallback(_ source: String) -> NSView {
        let scroll = NSTextView.scrollableTextView()
        if let textView = scroll.documentView as? NSTextView {
            textView.string = source
            textView.isEditable = false
            textView.isSelectable = true
            textView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
            textView.textColor = .textColor
            textView.backgroundColor = .textBackgroundColor
        }

        return scroll
    }

    private func embed(_ host: NSView) {
        host.translatesAutoresizingMaskIntoConstraints = false
        view.subviews.forEach { $0.removeFromSuperview() }
        view.addSubview(host)

        NSLayoutConstraint.activate([
            host.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.topAnchor.constraint(equalTo: view.topAnchor),
            host.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }
}

private enum PreviewError: Error {
    case missingTemplate
    case encodingFailed
}
