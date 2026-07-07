import type { TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";

// Keywords / operators that look like identifiers but are not data variables.
const FM_KEYWORDS = new Set([
    "true", "false", "as", "in", "if", "elseif", "else", "list", "assign",
    "gt", "lt", "gte", "lte", "and", "or", "not", "eq", "neq",
]);

const VELOCITY_KEYWORDS = new Set([
    "true", "false", "in", "end", "if", "elseif", "else", "set", "foreach", "stop",
]);

// Remove string literals so identifiers inside them are ignored.
function stripStringLiterals(s: string): string {
    return s.replace(/"[^"]*"/g, " ").replace(/'[^']*'/g, " ");
}

// Remove method calls like `.getName()` so they don't become fake variables.
function stripMethodCalls(s: string): string {
    return s.replace(/\.[a-zA-Z_]\w*\s*\([^)]*\)/g, "");
}

// A dotted / indexed identifier chain, e.g. user.name or items[0].price
const CHAIN_RE = /[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*|\[\d+\])*/g;

// Extract the leading variable path from a single Freemarker interpolation body.
// e.g. `user.name?upper_case` -> "user.name", `order.total!0` -> "order.total"
export function freemarkerPathFromExpr(inner: string): string | null {
    let s = stripStringLiterals(inner);
    // drop builtins (?upper_case), default values (!"x"), and everything after them
    s = s.replace(/\?\w+/g, " ").replace(/!.*/g, " ");
    s = stripMethodCalls(s).trim();
    const m = s.match(/^[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*|\[\d+\])*/);
    if (!m) return null;
    const chain = m[0];
    if (FM_KEYWORDS.has(chain)) return null;
    return chain;
}

// Extract the variable path from a single Velocity reference chain.
export function velocityNormalizeChain(chain: string): string | null {
    const c = stripMethodCalls(chain).trim();
    const m = c.match(/^[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*|\[\d+\])*/);
    if (!m) return null;
    if (VELOCITY_KEYWORDS.has(m[0])) return null;
    return m[0];
}

function addChainsFromExpr(expr: string, keywords: Set<string>, out: Set<string>) {
    let s = stripStringLiterals(expr).replace(/\?\w+/g, " ");
    s = stripMethodCalls(s);
    let m: RegExpExecArray | null;
    CHAIN_RE.lastIndex = 0;
    while ((m = CHAIN_RE.exec(s))) {
        const chain = m[0];
        if (keywords.has(chain)) continue;
        out.add(chain);
    }
}

function finalize(paths: Set<string>, loopRoots: Set<string>): string[] {
    const out = new Set<string>();
    for (const p of paths) {
        const root = p.split(/[.[]/)[0] ?? p;
        if (loopRoots.has(root)) continue;
        out.add(p);
    }
    return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function extractFreemarker(code: string): string[] {
    const paths = new Set<string>();
    const loopRoots = new Set<string>();
    let m: RegExpExecArray | null;

    // <#list coll as item> / <#list coll as k, v> -> collection is data, item is local
    const listRe = /<#list\s+([\s\S]*?)\s+as\s+([a-zA-Z_]\w*)(?:\s*,\s*([a-zA-Z_]\w*))?\s*>/g;
    while ((m = listRe.exec(code))) {
        addChainsFromExpr(m[1] ?? "", FM_KEYWORDS, paths);
        if (m[2]) loopRoots.add(m[2]);
        if (m[3]) loopRoots.add(m[3]);
    }

    // locally declared variables are not fake data inputs
    const assignRe = /<#assign\s+([a-zA-Z_]\w*)\s*=/g;
    while ((m = assignRe.exec(code))) loopRoots.add(m[1]!);

    // ${ ... } interpolations
    const interpRe = /\$\{([^}]*)\}/g;
    while ((m = interpRe.exec(code))) addChainsFromExpr(m[1] ?? "", FM_KEYWORDS, paths);

    // <#if ...> / <#elseif ...>
    const ifRe = /<#(?:if|elseif)\s+([\s\S]*?)>/g;
    while ((m = ifRe.exec(code))) addChainsFromExpr(m[1] ?? "", FM_KEYWORDS, paths);

    return finalize(paths, loopRoots);
}

// Velocity references: $var, ${var}, $!var, $!{var}
const VELOCITY_REF_RE = /\$!?\{?\s*([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*(?:\s*\([^)]*\))?|\[\d+\])*)\s*\}?/g;

function addVelocityRefs(s: string, out: Set<string>) {
    const cleaned = stripStringLiterals(s);
    let m: RegExpExecArray | null;
    VELOCITY_REF_RE.lastIndex = 0;
    while ((m = VELOCITY_REF_RE.exec(cleaned))) {
        const norm = velocityNormalizeChain(m[1] ?? "");
        if (norm) out.add(norm);
    }
}

function extractVelocity(code: string): string[] {
    const paths = new Set<string>();
    const loopRoots = new Set<string>();
    let m: RegExpExecArray | null;

    // #foreach( $item in $items ) -> item is local, collection is data
    const feRe = /#foreach\s*\(\s*\$!?\{?([a-zA-Z_]\w*)\}?\s+in\s+([\s\S]*?)\)/g;
    while ((m = feRe.exec(code))) {
        loopRoots.add(m[1]!);
        addVelocityRefs(m[2] ?? "", paths);
    }

    // #set( $x = ... ) declares a local variable
    const setRe = /#set\s*\(\s*\$!?\{?([a-zA-Z_]\w*)\}?\s*=/g;
    while ((m = setRe.exec(code))) loopRoots.add(m[1]!);

    // general references across the body (covers #if/#elseif too)
    addVelocityRefs(code, paths);

    return finalize(paths, loopRoots);
}

// Detect the distinct data variable paths referenced by a template.
export function extractVariablePaths(code: string, engine: TemplateEngine): string[] {
    if (!code) return [];
    if (engine === "freemarker") return extractFreemarker(code);
    if (engine === "velocity") return extractVelocity(code);
    return [];
}
