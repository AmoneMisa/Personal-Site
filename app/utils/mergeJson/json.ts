export type JsonPrimitive = null | boolean | number | string;

export interface JsonObject {
    [key: string]: JsonValue
}

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

export function isPlainObject(v: any): v is Record<string, any> {
    return v != null && typeof v === "object" && !Array.isArray(v);
}

export function safeParseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
    try {
        return {ok: true, value: JSON.parse(text)};
    } catch (e: any) {
        return {ok: false, error: e?.message || "Invalid JSON"};
    }
}

export function cloneDeep<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}

export function getByPath(root: any, path: string): any {
    if (!path) return root;
    const parts = path.split(".").filter(Boolean);
    let cur = root;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    return cur;
}

export function setByPath(root: any, path: string, value: any) {
    const parts = path.split(".").filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === undefined) continue;
        const last = i === parts.length - 1;
        if (last) cur[p] = value;
        else {
            if (!isPlainObject(cur[p])) cur[p] = {};
            cur = cur[p];
        }
    }
}

export function keyExistsOrConflicts(root: any, path: string) {
    const p = path.trim();
    if (!p) return {ok: false as const, reason: "empty"};

    if (getByPath(root, p) !== undefined) {
        return {ok: false as const, reason: "exists"};
    }

    const parts = p.split(".").filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
        const pref = parts.slice(0, i).join(".");
        const v = getByPath(root, pref);
        if (v !== undefined && (v == null || typeof v !== "object" || Array.isArray(v))) {
            return {ok: false as const, reason: "prefixIsValue", at: pref};
        }
    }

    const leaves = collectLeafPaths(root);
    const hasChildren = leaves.some((k) => k.startsWith(p + "."));
    if (hasChildren) {
        return {ok: false as const, reason: "wouldShadowTree"};
    }

    return {ok: true as const};
}

export function collectLeafPaths(root: any, prefix = "", out: string[] = []) {
    if (isPlainObject(root)) {
        for (const [k, v] of Object.entries(root)) {
            if (k === "_meta") continue;
            const next = prefix ? `${prefix}.${k}` : k;
            collectLeafPaths(v, next, out);
        }
        return out;
    }
    if (Array.isArray(root)) {
        root.forEach((v, i) => {
            const next = prefix ? `${prefix}.${i}` : String(i);
            collectLeafPaths(v, next, out);
        });
        return out;
    }
    if (prefix) out.push(prefix);
    return out;
}

export function detectJsonMode(obj: any): "flat" | "tree" {
    if (!isPlainObject(obj)) return "tree";
    return Object.keys(obj).some((k) => k.includes(".")) ? "flat" : "tree";
}

export function buildTreeFromFlat(obj: Record<string, any>) {
    const root: any = {};
    for (const [k, v] of Object.entries(obj)) {
        const parts = k.split(".").filter(Boolean);
        let cur = root;
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (p === undefined) continue;
            const last = i === parts.length - 1;
            if (last) cur[p] = v;
            else {
                if (!isPlainObject(cur[p])) cur[p] = {};
                cur = cur[p];
            }
        }
    }
    return root;
}

export function normalizeLoadedJson(obj: any): JsonValue {
    let cur: any = obj;

    for (let i = 0; i < 2; i++) {
        if (typeof cur !== "string") break;

        const t = cur.trim();
        const looksLikeJson =
            (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));

        if (!looksLikeJson) break;

        const p = safeParseJson(t);
        if (!p.ok) break;

        cur = p.value;
    }

    if (detectJsonMode(cur) === "flat" && isPlainObject(cur)) return buildTreeFromFlat(cur);

    return cur as JsonValue;
}


export async function loadJsonFromFile(file: File) {
    const text = await file.text();
    const parsed = safeParseJson(text);
    if (!parsed.ok) throw new Error(parsed.error);
    return {text, obj: parsed.value};
}

export function sortJsonDeep(v: any, order: "asc" | "desc"): any {
    if (!v || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => sortJsonDeep(x, order));
    if (!isPlainObject(v)) return v;

    const keys = Object.keys(v).sort((a, b) => a.localeCompare(b));
    if (order === "desc") keys.reverse();

    const out: Record<string, any> = {};
    for (const k of keys) out[k] = sortJsonDeep(v[k], order);
    return out;
}
