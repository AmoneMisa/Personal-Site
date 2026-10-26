import type { DiagnosticItem } from "../types";
import type { TemplateEngine } from "../../preview/clientProfiles";

const POOR_FORMATS = ["webp", "svg", "avif"];

export const imageFormatRule = {
    id: "image_format",
    check(input: { code: string; templateEngine: TemplateEngine }): DiagnosticItem[] {
        const text = input.code;
        const list: DiagnosticItem[] = [];

        const imgRegex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
        let match: RegExpExecArray | null;

        while ((match = imgRegex.exec(text))) {
            const src = (match[1] ?? "").toLowerCase();
            const ext = src.split(/[?#]/, 1)[0]?.split(".").pop() ?? "";
            if (POOR_FORMATS.includes(ext)) {
                list.push(make("warning", `Image format .${ext} may be poorly supported in email clients`, match.index, match.index + match[0].length));
            }
        }

        return list;
    },
};

function make(severity: "warning" | "error", message: string, startOffset: number, endOffset: number): DiagnosticItem {
    return {
        id: `${Math.random().toString(16).slice(2)}_${startOffset}`,
        ruleId: "image_format",
        severity,
        message,
        startOffset,
        endOffset,
    };
}
