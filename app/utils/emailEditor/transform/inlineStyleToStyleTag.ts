type DeclMap = Map<string, string>;

export function inlineStyleToStyleTag(html: string) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const styleEl = ensureStyleElement(doc);

        const existingCss = styleEl.textContent || "";
        const existing = parsePlainCssRules(existingCss);

        const all = Array.from(doc.querySelectorAll<HTMLElement>("*"));
        const candidates = all.filter((el) => {
            const classAttr = (el.getAttribute("class") || "").trim();
            const styleAttr = (el.getAttribute("style") || "").trim();
            return classAttr.length > 0 && styleAttr.length > 0;
        });

        const byParent = new Map<Element, HTMLElement[]>();
        for (const el of candidates) {
            const parent = el.parentElement;
            if (!parent) continue;
            const list = byParent.get(parent) ?? [];
            list.push(el);
            byParent.set(parent, list);
        }

        const newRules: { selector: string; decl: DeclMap }[] = [];

        for (const [parent, items] of byParent) {
            const children = Array.from(parent.children) as HTMLElement[];

            const groups = new Map<string, { index: number; el: HTMLElement; decl: DeclMap }[]>();

            for (const el of items) {
                const classAttr = (el.getAttribute("class") || "").trim();
                const decl = parseDeclarations(el.getAttribute("style") || "");
                if (!decl.size) continue;

                const classKey = classAttr.split(/\s+/).filter(Boolean).sort().join(" ");
                const idx = Math.max(1, children.indexOf(el) + 1);

                const arr = groups.get(classKey) ?? [];
                arr.push({ index: idx, el, decl });
                groups.set(classKey, arr);
            }

            for (const [classKey, occurrences] of groups) {
                occurrences.sort((a, b) => a.index - b.index);

                const classSelector = classKey
                    .split(" ")
                    .filter(Boolean)
                    .map((c) => `.${escapeCssClass(c)}`)
                    .join("");

                const totalChildren = children.length;

                const byDecl = new Map<string, { indices: number[]; decl: DeclMap; elements: HTMLElement[] }>();

                for (const occ of occurrences) {
                    const declKey = declKeyString(occ.decl);
                    const entry = byDecl.get(declKey) ?? { indices: [], decl: occ.decl, elements: [] };
                    entry.indices.push(occ.index);
                    entry.elements.push(occ.el);
                    byDecl.set(declKey, entry);
                }

                const consumed = new Set<number>();

                for (const entry of byDecl.values()) {
                    const pattern = detectNthPattern(entry.indices);
                    if (pattern) {
                        const selector = `${classSelector}:nth-child(${pattern.step}n+${pattern.offset})`;
                        newRules.push({ selector, decl: entry.decl });
                        for (const i of entry.indices) consumed.add(i);
                        for (const el of entry.elements) el.removeAttribute("style");
                    }
                }

                for (const occ of occurrences) {
                    if (consumed.has(occ.index)) continue;

                    let pseudo = "";
                    if (occ.index === 1) pseudo = ":first-child";
                    else if (occ.index === totalChildren) pseudo = ":last-child";
                    else pseudo = `:nth-child(${occ.index})`;

                    const selector = `${classSelector}${pseudo}`;
                    newRules.push({ selector, decl: occ.decl });
                    occ.el.removeAttribute("style");
                }
            }
        }

        const mergedCss = mergeRulesToCss(existing, newRules);
        styleEl.textContent = mergedCss.trim() ? mergedCss.trim() + "\n" : "";

        const serialized = doc.documentElement.outerHTML;
        const hasDoctype = /^\s*<!doctype/i.test(html);
        return (hasDoctype ? "<!doctype html>\n" : "") + serialized;
    } catch {
        return html;
    }
}

function ensureStyleElement(doc: Document) {
    let head = doc.querySelector("head");
    if (!head) {
        head = doc.createElement("head");
        doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
    }
    let styleEl = head.querySelector("style");
    if (!styleEl) {
        styleEl = doc.createElement("style");
        head.appendChild(styleEl);
    }
    return styleEl;
}

function escapeCssClass(c: string) {
    return c.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function parseDeclarations(style: string): DeclMap {
    const map = new Map<string, string>();
    const parts = String(style || "").split(";").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
        const idx = p.indexOf(":");
        if (idx === -1) continue;
        const k = p.slice(0, idx).trim().toLowerCase();
        const v = p.slice(idx + 1).trim();
        if (!k || !v) continue;
        map.set(k, v);
    }
    return map;
}

function declKeyString(decl: DeclMap) {
    return Array.from(decl.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(";");
}

function detectNthPattern(indices: number[]) {
    const uniq = Array.from(new Set(indices)).sort((a, b) => a - b);
    if (uniq.length < 3) return null;

    const diffs: number[] = [];
    uniq.forEach((value, index) => {
        const previous = uniq[index - 1];
        if (previous !== undefined) diffs.push(value - previous);
    });
    const step = diffs[0];
    if (!step || diffs.some((d) => d !== step)) return null;

    const offset = uniq[0];
    if (offset === undefined || offset < 1) return null;

    return { step, offset };
}

function parsePlainCssRules(css: string) {
    const withoutMedia = css.replace(/@media[\s\S]*?\{[\s\S]*?\}\s*\}/g, "");
    const ruleRegex = /(^|[}\n])\s*([^{@}]+)\s*\{\s*([^}]+)\s*\}/g;

    const map = new Map<string, DeclMap>();
    let match: RegExpExecArray | null;

    while ((match = ruleRegex.exec(withoutMedia))) {
        const selector = String(match[2] || "").trim();
        const body = String(match[3] || "").trim();
        if (!selector || !body) continue;
        if (selector.includes("@")) continue;

        const decl = parseDeclarations(body);
        if (!decl.size) continue;

        const key = normalizeSelectorKey(selector);
        const prev = map.get(key);
        if (!prev) map.set(key, decl);
        else mergeDecls(prev, decl);
    }

    return map;
}

function normalizeSelectorKey(selector: string) {
    return selector.replace(/\s+/g, " ").trim();
}

function mergeDecls(target: DeclMap, incoming: DeclMap) {
    for (const [k, v] of incoming.entries()) {
        if (!target.has(k)) target.set(k, v);
    }
}

function mergeRulesToCss(existing: Map<string, DeclMap>, additions: { selector: string; decl: DeclMap }[]) {
    const merged = new Map<string, DeclMap>();
    for (const [sel, decl] of existing.entries()) merged.set(sel, new Map(decl));

    for (const add of additions) {
        const key = normalizeSelectorKey(add.selector);
        const prev = merged.get(key);
        if (!prev) merged.set(key, new Map(add.decl));
        else mergeDecls(prev, add.decl);
    }

    const blocks: string[] = [];
    for (const [selector, decl] of merged.entries()) {
        const body = Array.from(decl.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => `  ${k}: ${v};`)
            .join("\n");

        blocks.push(`${selector} {\n${body}\n}`);
    }

    return blocks.join("\n\n");
}
