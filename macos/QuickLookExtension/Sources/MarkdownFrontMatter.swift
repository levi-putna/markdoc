import Foundation

/// Strips YAML (`---`) and TOML (`+++`) front matter from Markdown source text.
enum MarkdownFrontMatter {
    private static let yamlPattern = #"^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?"#
    private static let tomlPattern = #"^\uFEFF?\+\+\+\r?\n[\s\S]*?\r?\n\+\+\+\r?\n?"#

    /// Returns the Markdown body with any recognised front matter block removed.
    static func strip(from source: String) -> String {
        var result = source

        for pattern in [yamlPattern, tomlPattern] {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
                continue
            }

            let range = NSRange(result.startIndex..., in: result)
            guard let match = regex.firstMatch(in: result, range: range),
                  let matchRange = Range(match.range, in: result) else {
                continue
            }

            result.removeSubrange(matchRange)
            break
        }

        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
