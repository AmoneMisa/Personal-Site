import type { TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";
import { freemarkerPathFromExpr, velocityNormalizeChain } from "./extractVariablePaths";

function escapeHtmlText(v: string): string {
    return String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

// Velocity references: $var, ${var}, $!var, $!{var}
const VELOCITY_REF_RE = /\$!?\{?\s*([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*(?:\s*\([^)]*\))?|\[\d+\])*)\s*\}?/g;

// Substitute template variable interpolations with fake values for preview only.
// Unknown paths are left untouched so the user can see what still needs a value.
// Structural directives (<#if>, <#list>, #foreach, ...) are left as-is.
export function renderWithFakeData(
    code: string,
    engine: TemplateEngine,
    values: Record<string, string>,
): string {
    if (!code) return code;

    if (engine === "freemarker") {
        return code.replace(/\$\{([^}]*)\}/g, (full, inner: string) => {
            const path = freemarkerPathFromExpr(inner);
            if (path && Object.prototype.hasOwnProperty.call(values, path)) {
                return escapeHtmlText(values[path] ?? "");
            }
            return full;
        });
    }

    if (engine === "velocity") {
        return code.replace(VELOCITY_REF_RE, (full, chain: string) => {
            const path = velocityNormalizeChain(chain);
            if (path && Object.prototype.hasOwnProperty.call(values, path)) {
                return escapeHtmlText(values[path] ?? "");
            }
            return full;
        });
    }

    return code;
}
