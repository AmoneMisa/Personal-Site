import type { DiagnosticItem } from "../types";
import type { TemplateEngine } from "../../preview/clientProfiles";

export const cssDuplicateClassRule = {
    id: "css_duplicate_class",
    check(input: { code: string; templateEngine: TemplateEngine }): DiagnosticItem[] {
        const text = input.code;
        const styleBlocks = extractStyleBlocks(text);
        const list: DiagnosticItem[] = [];

        for (const block of styleBlocks) {
            const withoutMedia = block.css.replace(/@media[\s\S]*?\{[\s\S]*?\}\s*\}/g, "");
            const ruleRegex = /(^|[}\n])\s*(\.[a-zA-Z0-9_-]+)\s*\{\s*([^}]+)\s*\}/g;
            const seen = new Map<string, { decl: string; offset: number }>();

            let match: RegExpExecArray | null;
            while ((match = ruleRegex.exec(withoutMedia))) {
                const selector = match[2]; // ".button"
                const rawDeclarations = match[3];
                if (!selector || rawDeclarations === undefined) continue;
                const declarations = normalizeDeclarations(rawDeclarations);

                if (selector.includes(":") || selector.includes("::")) continue;

                const key = selector;
                const prev = seen.get(key);
                if (!prev) {
                    seen.set(key, { decl: declarations, offset: block.startOffset + match.index });
                    continue;
                }

                if (prev.decl === declarations) {
                    list.push(make("warning", `Duplicate CSS rule for ${selector} in <style>`, block.startOffset + match.index, block.startOffset + match.index + match[0].length));
                }
            }
        }

        return list;
    },
};

function extractStyleBlocks(html: string) {
    const regex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    const blocks: { css: string; startOffset: number; endOffset: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html))) {
        blocks.push({
            css: match[1] ?? "",
            startOffset: match.index,
            endOffset: match.index + match[0].length,
        });
    }
    return blocks;
}

function normalizeDeclarations(decl: string) {
    return decl
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .sort()
        .join(";");
}

function make(severity: "warning" | "error", message: string, startOffset: number, endOffset: number): DiagnosticItem {
    return {
        id: `${Math.random().toString(16).slice(2)}_${startOffset}`,
        ruleId: "css_duplicate_class",
        severity,
        message,
        startOffset,
        endOffset,
    };
}
