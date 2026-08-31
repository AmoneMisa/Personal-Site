import {collectLeafPaths, getByPath, safeParseJson, setByPath, type JsonValue} from "./json";
import {normalizeQuotes} from "./jsonFix";

export function toFlatText(root: any, order: "asc" | "desc") {
    const keys = collectLeafPaths(root as any);
    keys.sort((a, b) => a.localeCompare(b));
    if (order === "desc") keys.reverse();

    const lines: string[] = [];
    for (const k of keys) {
        if (!k) continue;
        const v = getByPath(root, k);
        lines.push(`${k} = ${JSON.stringify(v)}`);
    }
    return lines.join("\n");
}

export function parseFlatValueSmart(raw: string) {
    const s = normalizeQuotes(raw.trim());

    const m = s.match(/^\[(string|number|boolean|null)\]$/i);
    if (m) {
        const t = m[1].toLowerCase();
        if (t === "string") return "";
        if (t === "number") return 0;
        if (t === "boolean") return false;
        return null;
    }

    const p = safeParseJson(s);
    if (p.ok) return p.value;

    return s;
}

export function parseFlatTextToTree(text: string): { ok: true; value: JsonValue } | { ok: false; error: string } {
    const out: any = {};
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;

        const idx = raw.indexOf("=");
        if (idx === -1) return {ok: false, error: `Line ${i + 1}: expected "="`};

        const key = raw.slice(0, idx).trim().replace(/^["']|["']$/g, "");
        const valStr = raw.slice(idx + 1).trim();

        if (!key) return {ok: false, error: `Line ${i + 1}: empty key`};

        const v = parseFlatValueSmart(valStr);
        setByPath(out, key, v);
    }

    return {ok: true, value: out as JsonValue};
}
