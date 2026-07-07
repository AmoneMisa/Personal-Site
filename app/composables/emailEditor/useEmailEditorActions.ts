import { computed, watch, watchEffect } from "vue";
import type { ReturnType } from "./useEmailEditorState";
import { collectDiagnostics } from "~/utils/emailEditor/diagnostics/collectDiagnostics";
import { inlineStyleToStyleTag } from "~/utils/emailEditor/transform/inlineStyleToStyleTag";
import { extractVariablePaths } from "~/utils/emailEditor/fakeData/extractVariablePaths";
import { defaultFakeValue } from "~/utils/emailEditor/fakeData/defaultFakeValue";

export function useEmailEditorActions(state: ReturnType<typeof import("./useEmailEditorState")["useEmailEditorState"]>) {
    watchEffect(() => {
        state.diagnostics.value = collectDiagnostics({
            code: state.code.value,
            templateEngine: state.templateEngine.value,
            previewClient: state.previewClient.value,
        });
    });

    const activeDiagnostic = computed(() => {
        const id = state.activeDiagnosticId.value;
        if (!id) return null;
        return state.diagnostics.value.find((d) => d.id === id) ?? null;
    });

    // Variable paths detected in the current template (only while fake data is on).
    const detectedVariablePaths = computed<string[]>(() => {
        if (!state.fakeData.enabled) return [];
        return extractVariablePaths(state.code.value, state.templateEngine.value);
    });

    // Seed newly detected paths with a friendly sample value (keep edited ones).
    watch(
        detectedVariablePaths,
        (paths) => {
            for (const p of paths) {
                if (!Object.prototype.hasOwnProperty.call(state.fakeData.values, p)) {
                    state.fakeData.values[p] = defaultFakeValue(p);
                }
            }
        },
        { immediate: true },
    );

    // Opening the window when the feature is switched on.
    watch(
        () => state.fakeData.enabled,
        (on) => {
            if (on) state.fakeData.open = true;
        },
    );

    function setFakeValue(path: string, value: string) {
        state.fakeData.values[path] = value;
    }

    function addFakePath(path: string) {
        const key = String(path ?? "").trim();
        if (!key) return;
        if (!Object.prototype.hasOwnProperty.call(state.fakeData.values, key)) {
            state.fakeData.values[key] = defaultFakeValue(key);
        }
    }

    function removeFakePath(path: string) {
        delete state.fakeData.values[path];
    }

    function onToolbarAction(action: string) {
        if (action === "moveInlineStylesToStyleTag") return moveInlineStylesToStyleTag();
        if (action === "openInsertImage") return (state.modals.insertImage = true);
        if (action === "openInsertLink") return (state.modals.insertLink = true);
        if (action === "openInsertTemplate") return (state.modals.insertTemplate = true);
        if (action === "openFakeData") return (state.fakeData.open = true);
    }

    function moveInlineStylesToStyleTag() {
        const next = inlineStyleToStyleTag(state.code.value);
        state.code.value = next;
        state.monacoApi.value?.replaceRange(0, state.monacoApi.value.getText().length, next);
    }

    function insertImage(payload: { src: string; alt: string; width: number | null; height: number | null }) {
        const attrs = [
            `src="${escapeHtmlAttribute(payload.src)}"`,
            `alt="${escapeHtmlAttribute(payload.alt || "")}"`,
            payload.width ? `width="${payload.width}"` : "",
            payload.height ? `height="${payload.height}"` : "",
            'style="display:block; border:0; outline:none; text-decoration:none;"',
        ].filter(Boolean).join(" ");

        const html = `<img ${attrs} />`;
        state.monacoApi.value?.insertSnippet(html);
        state.code.value = state.monacoApi.value?.getText() ?? state.code.value;
        state.modals.insertImage = false;
    }

    function insertLink(payload: { href: string; text: string }) {
        const html = `<a href="${escapeHtmlAttribute(payload.href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(payload.text || payload.href)}</a>`;
        state.monacoApi.value?.insertSnippet(html);
        state.code.value = state.monacoApi.value?.getText() ?? state.code.value;
        state.modals.insertLink = false;
    }

    function insertTemplate(payload: { snippet: string }) {
        state.monacoApi.value?.insertSnippet(payload.snippet);
        state.code.value = state.monacoApi.value?.getText() ?? state.code.value;
        state.modals.insertTemplate = false;
    }

    function jumpToDiagnostic(id: string) {
        state.activeDiagnosticId.value = id;
        const d = state.diagnostics.value.find((x) => x.id === id);
        if (!d) return;
        state.monacoApi.value?.revealOffsets(d.startOffset, d.endOffset);
    }

    function openColorPickerAt(p: { clientX: number; clientY: number; startOffset: number; endOffset: number; current: string }) {
        state.colorPicker.open = true;
        state.colorPicker.anchorClientX = p.clientX;
        state.colorPicker.anchorClientY = p.clientY;
        state.colorPicker.replaceRange = { startOffset: p.startOffset, endOffset: p.endOffset };
        state.colorPicker.originalText = p.current;
        const normalized = normalizeColorToHex(p.current);
        if (normalized) state.colorPicker.color = normalized;
    }

    function closeColorPicker() {
        state.colorPicker.open = false;
        state.colorPicker.replaceRange = null;
        state.colorPicker.originalText = "";
    }

    function applyColorFromPicker() {
        const r = state.colorPicker.replaceRange;
        if (!r) return;

        const replacement = state.colorPicker.preferHex
            ? state.colorPicker.color
            : hexToRgbaLike(state.colorPicker.color, state.colorPicker.originalText);

        state.monacoApi.value?.replaceRange(r.startOffset, r.endOffset, replacement);
        state.code.value = state.monacoApi.value?.getText() ?? state.code.value;
        closeColorPicker();
    }

    return {
        onToolbarAction,
        moveInlineStylesToStyleTag,
        insertImage,
        insertLink,
        insertTemplate,
        jumpToDiagnostic,
        openColorPickerAt,
        applyColorFromPicker,
        closeColorPicker,
        activeDiagnostic,
        detectedVariablePaths,
        setFakeValue,
        addFakePath,
        removeFakePath,
    };
}

function escapeHtmlAttribute(v: string) {
    return String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeHtmlText(v: string) {
    return String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function normalizeColorToHex(v: string): string | null {
    const s = v.trim();

    if (/^#([0-9a-fA-F]{3})$/.test(s)) {
        const r = s[1], g = s[2], b = s[3];
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    if (/^#([0-9a-fA-F]{6})$/.test(s)) return s.toUpperCase();

    const rgb = s.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (!rgb) return null;

    const rr = clamp255(Number(rgb[1]));
    const gg = clamp255(Number(rgb[2]));
    const bb = clamp255(Number(rgb[3]));

    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`.toUpperCase();
}

function clamp255(n: number) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(n: number) {
    return n.toString(16).padStart(2, "0");
}

function hexToRgbaLike(hex: string, original: string) {
    const m = hex.match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return hex;

    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);

    const hasAlpha = /^rgba\(/i.test(original.trim());
    const alphaMatch = original.match(/rgba\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([0-9.]+)\s*\)/i);
    const alpha = alphaMatch ? alphaMatch[1] : "1";

    return hasAlpha ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
}
