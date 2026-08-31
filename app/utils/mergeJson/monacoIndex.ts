import { parseTree } from "jsonc-parser";

export type PathRange = { start: number; end: number }; // offsets
export type JsonIndex = {
    leaf: Map<string, PathRange>;     // path -> value range
    node: Map<string, PathRange>;     // path -> full node range (for hiding blocks)
    key: Map<string, PathRange>;      // path -> key token range (optional)
};

export function buildJsonIndex(text: string): JsonIndex {
    const root = parseTree(text);
    const leaf = new Map<string, PathRange>();
    const node = new Map<string, PathRange>();
    const key = new Map<string, PathRange>();

    if (!root) return { leaf, node, key };

    const push = (m: Map<string, PathRange>, p: string, n: any) => {
        m.set(p, { start: n.offset, end: n.offset + n.length });
    };

    const walk = (n: any, path: (string | number)[]) => {
        const p = path.join(".");
        if (p) push(node, p, n);

        if (n.type === "object") {
            for (const prop of n.children ?? []) {
                // property: [keyNode, valueNode]
                const kNode = prop.children?.[0];
                const vNode = prop.children?.[1];
                const k = kNode?.value;
                if (typeof k !== "string" || !vNode) continue;

                const nextPath = [...path, k];
                const next = nextPath.join(".");
                push(key, next, kNode);
                walk(vNode, nextPath);
            }
            return;
        }

        if (n.type === "array") {
            (n.children ?? []).forEach((c: any, i: number) => walk(c, [...path, i]));
            return;
        }

        if (p) push(leaf, p, n);
    };

    walk(root, []);
    return { leaf, node, key };
}

