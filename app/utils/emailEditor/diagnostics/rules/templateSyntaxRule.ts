import type { DiagnosticItem } from "../types";
import type { TemplateEngine } from "../../preview/clientProfiles";

export const templateSyntaxRule = {
    id: "template_syntax",
    check(input: { code: string; templateEngine: TemplateEngine }): DiagnosticItem[] {
        if (input.templateEngine === "clean_html") return [];

        const text = input.code;
        const list: DiagnosticItem[] = [];

        if (input.templateEngine === "freemarker") {
            list.push(...balanceTags(text, "<#if", "</#if>", "Freemarker if is not closed"));
            list.push(...balanceTags(text, "<#list", "</#list>", "Freemarker list is not closed"));

            const openIdx = text.indexOf("${");
            if (openIdx !== -1) {
                const regex = /\$\{/g;
                let m: RegExpExecArray | null;
                while ((m = regex.exec(text))) {
                    const start = m.index;
                    const end = text.indexOf("}", start + 2);
                    if (end === -1) list.push(make("error", "Freemarker ${...} is not closed with }", start, Math.min(text.length, start + 2)));
                }
            }
        }

        if (input.templateEngine === "velocity") {
            list.push(...balanceVelocityBlocks(text, "#if", "#end", "Velocity #if block is not closed with #end"));
            list.push(...balanceVelocityBlocks(text, "#foreach", "#end", "Velocity #foreach block is not closed with #end"));

            const regex = /\$\{/g;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(text))) {
                const start = m.index;
                const end = text.indexOf("}", start + 2);
                if (end === -1) list.push(make("error", "Velocity ${...} is not closed with }", start, Math.min(text.length, start + 2)));
            }
        }

        return list;
    },
};

function balanceTags(text: string, openNeedle: string, closeNeedle: string, message: string): DiagnosticItem[] {
    const list: DiagnosticItem[] = [];
    let idx = 0;
    let depth = 0;
    let lastOpen = -1;

    while (idx < text.length) {
        const open = text.indexOf(openNeedle, idx);
        const close = text.indexOf(closeNeedle, idx);

        if (open === -1 && close === -1) break;

        if (open !== -1 && (close === -1 || open < close)) {
            depth++;
            lastOpen = open;
            idx = open + openNeedle.length;
            continue;
        }

        depth = Math.max(0, depth - 1);
        idx = close + closeNeedle.length;
    }

    if (depth > 0 && lastOpen >= 0) {
        list.push(make("error", message, lastOpen, Math.min(text.length, lastOpen + openNeedle.length)));
    }

    return list;
}

function balanceVelocityBlocks(text: string, openNeedle: string, closeNeedle: string, message: string): DiagnosticItem[] {
    const list: DiagnosticItem[] = [];
    const openRegex = new RegExp(`${escapeReg(openNeedle)}\\s*\\(`, "g");
    const closeRegex = new RegExp(`${escapeReg(closeNeedle)}\\b`, "g");

    const opens: number[] = [];
    let m: RegExpExecArray | null;

    while ((m = openRegex.exec(text))) opens.push(m.index);

    let closes = 0;
    while (closeRegex.exec(text)) closes++;

    if (opens.length > closes && opens.length) {
        const lastOpen = opens[opens.length - 1];
        if (lastOpen !== undefined) list.push(make("error", message, lastOpen, Math.min(text.length, lastOpen + openNeedle.length)));
    }

    return list;
}

function escapeReg(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function make(severity: "warning" | "error", message: string, startOffset: number, endOffset: number): DiagnosticItem {
    return {
        id: `${Math.random().toString(16).slice(2)}_${startOffset}`,
        ruleId: "template_syntax",
        severity,
        message,
        startOffset,
        endOffset,
    };
}
