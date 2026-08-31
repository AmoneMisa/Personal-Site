import {ref, reactive, computed, watch, type Component, type ShallowUnwrapRef} from "vue";
import type {Truth} from "~/utils/mergeJson/pick";
import {
    safeParseJson,
    cloneDeep,
    collectLeafPaths,
    getByPath,
    setByPath,
    type JsonValue,
    sortJsonDeep,
    loadJsonFromFile,
    normalizeLoadedJson, keyExistsOrConflicts,
} from "~/utils/mergeJson/json";
import {makeDiffSet} from "~/utils/mergeJson/diff";
import {matchesInPane} from "~/utils/mergeJson/search";
import {buildAutoResultTree} from "~/utils/mergeJson/autoResult";
import {fixJsonText} from "~/utils/mergeJson/jsonFix";
import {parseFlatTextToTree, toFlatText} from "~/utils/mergeJson/flat";
import RenameModal from "~/components/mergeJson/RenameModal.vue";
import DeleteBlockModal from "~/components/mergeJson/DeleteBlockModal.vue";
import {downloadBlob} from "~/utils/files";
import type {MergeJsonDecoration} from "~/types/mergeJson";

export type SortMode = "asc" | "desc";
export type ViewMode = "json" | "tree" | "flat";
export type Pane = "A" | "B" | "R";
export type Pick = "AUTO" | "A" | "B" | "EDITED" | "ADDED";
export type MergeJsonUi = ShallowUnwrapRef<ReturnType<typeof useMergeJsonState>>;

export function useMergeJsonState() {
    const viewMode = ref<ViewMode>("json");
    const minify = ref(false);
    const showAddKey = ref(false);

    const truth = ref<Truth>("A");
    const sortMode = ref<SortMode>("asc");

    const onlyDiff = ref(false);
    const query = ref("");

    const selectedKey = ref("");

    const errorA = ref<string | null>(null);
    const errorB = ref<string | null>(null);
    const errorR = ref<string | null>(null);

    const jsonA = ref<JsonValue>({});
    const jsonB = ref<JsonValue>({});

    const resultTextJson = ref<string>("{}");
    const resultObj = ref<JsonValue>({});
    const isDirty = ref(false);

    const pickByKey = reactive<Partial<Record<string, Pick>>>({});
    const addedKeys = reactive(new Set<string>());

    type ModalState = {
        open: boolean;
        component: Component | null;
        props: Record<string, any>;
        onConfirm: (payload?: any) => void;
    };

    const modal = reactive<ModalState>({
        open: false,
        component: null,
        props: {},
        onConfirm: () => {
        },
    });

    function closeModal() {
        modal.open = false;
        modal.component = null;
        modal.props = {};
        modal.onConfirm = () => {
        };
    }

    const accept = ".json,.yaml,.yml,.xml,.csv,application/json,text/*";

    function jsonStringify(v: any) {
        return minify.value ? JSON.stringify(v) : JSON.stringify(v, null, 2);
    }

    const autoResultTree = computed<JsonValue>(() =>
        buildAutoResultTree(jsonA.value, jsonB.value, truth.value)
    );

    function setResultFromAuto() {
        const txt = jsonStringify(autoResultTree.value);
        resultTextJson.value = txt;
        const parsed = safeParseJson(txt);
        resultObj.value = parsed.ok ? (parsed.value as JsonValue) : {};
        errorR.value = null;
        isDirty.value = false;
    }

    const diffSet = computed(() => makeDiffSet(jsonA.value, jsonB.value));

    const allLeafKeys = computed(() => {
        const keys = new Set<string>([
            ...collectLeafPaths(jsonA.value as any),
            ...collectLeafPaths(jsonB.value as any),
            ...collectLeafPaths(resultObj.value as any),
        ]);
        const arr = Array.from(keys).filter(Boolean);
        arr.sort((a, b) => a.localeCompare(b));
        if (sortMode.value === "desc") arr.reverse();
        return arr;
    });

    function match(pane: Pane, path: string) {
        return matchesInPane({
            aRoot: jsonA.value,
            bRoot: jsonB.value,
            rRoot: resultObj.value,
            pane,
            path,
            query: query.value
        });
    }

    function getMatches(pane: Pane) {
        const q = query.value.trim();
        if (!q) return [];

        return allLeafKeys.value.filter((k) =>
            matchesInPane({
                aRoot: jsonA.value,
                bRoot: jsonB.value,
                rRoot: resultObj.value,
                pane,
                path: k,
                query: q
            })
        );
    }

    const matchesA = computed(() => getMatches("A"));
    const matchesB = computed(() => getMatches("B"));
    const matchesR = computed(() => getMatches("R"));

    const matchesCount = computed(() => matchesR.value.length);

    const matchIndex = ref(0);
    function validateResult() {
        const raw = (resultTextJson.value || "").trim() || "{}";
        const p = safeParseJson(raw);
        if (!p.ok) {
            errorR.value = p.error;
            return false;
        }

        resultObj.value = p.value as JsonValue;
        errorR.value = null;
        return true;
    }

    watch(query, () => {
        matchIndex.value = 0;
    });

    function jumpToMatch(dir: 1 | -1) {
        const list = matchesR.value;
        if (!list.length) return;

        const n = list.length;
        matchIndex.value = (matchIndex.value + dir + n) % n;

        const k = list[matchIndex.value];
        selectedKey.value = k;
        revealKey.value = k;
    }

    function openRename() {
        const from = selectedKey.value?.trim();
        if (!from) return;

        modal.open = true;
        modal.component = RenameModal;
        modal.props = { from };

        modal.onConfirm = (payload?: any) => {
            const to = String(payload?.to ?? "").trim();
            if (!to) return;
            applyRename(from, to);
        };
    }

    function openDeleteBlock() {
        const p = selectedKey.value?.trim();
        if (!p) return;

        modal.open = true;
        modal.component = DeleteBlockModal;
        modal.props = { path: p };

        modal.onConfirm = () => {
            deleteBlock(p);
        };
    }

    const revealKey = ref<string | null>(null);

    watch(query, (v) => {
        const q = v.trim();
        if (!q) {
            revealKey.value = null;
            return;
        }
        const found = allLeafKeys.value.find((k) => match("R", k));
        if (found) {
            selectedKey.value = found;
            revealKey.value = found;
        }
    });

    const editedKeys = computed(() => {
        const set = new Set<string>();
        for (const k of allLeafKeys.value) {
            const a = getByPath(autoResultTree.value as any, k);
            const r = getByPath(resultObj.value as any, k);
            if (r === undefined && a === undefined) continue;
            if (String(r ?? "") !== String(a ?? "")) set.add(k);
        }
        return set;
    });

    watch(editedKeys, (s) => {
        for (const k of s) {
            if (pickByKey[k] === "A" || pickByKey[k] === "B" || pickByKey[k] === "ADDED") continue;
            pickByKey[k] = "EDITED";
        }
    });

    function patchResultValue(path: string, value: any) {
        const base = cloneDeep(resultObj.value);
        setByPath(base as any, path, value);
        resultTextJson.value = jsonStringify(base);
        resultObj.value = base as JsonValue;
        errorR.value = null;
        isDirty.value = true;
    }

    function useA() {
        if (!selectedKey.value) return;
        const v = getByPath(jsonA.value as any, selectedKey.value);
        if (v === undefined) return;
        pickByKey[selectedKey.value] = "A";
        patchResultValue(selectedKey.value, v);
    }

    function useB() {
        if (!selectedKey.value) return;
        const v = getByPath(jsonB.value as any, selectedKey.value);
        if (v === undefined) return;
        pickByKey[selectedKey.value] = "B";
        patchResultValue(selectedKey.value, v);
    }

    function resetSelected() {
        if (!selectedKey.value) return;
        const v = getByPath(autoResultTree.value as any, selectedKey.value);
        if (v === undefined) return;
        Reflect.deleteProperty(pickByKey, selectedKey.value);
        patchResultValue(selectedKey.value, v);
    }

    function takeAllFrom(which: Truth) {
        truth.value = which;
        for (const k of Object.keys(pickByKey)) Reflect.deleteProperty(pickByKey, k);
        addedKeys.clear();
        setResultFromAuto();
    }

    function onFixJson() {
        const r = fixJsonText(resultTextJson.value);
        if (!r.ok) {
            errorR.value = r.error;
            return;
        }
        resultTextJson.value = jsonStringify(r.value);
        resultObj.value = r.value as any;
        errorR.value = null;
        isDirty.value = true;
    }

    function sortResultNow() {
        const p = safeParseJson(resultTextJson.value.trim() || "{}");
        if (!p.ok) {
            errorR.value = p.error;
            return;
        }
        const sorted = sortJsonDeep(p.value, sortMode.value);
        resultTextJson.value = jsonStringify(sorted);
        resultObj.value = sorted;
        errorR.value = null;
        isDirty.value = true;
    }

    const viewTextA = computed(() => {
        const src = onlyDiff.value ? buildDiffOnlyTree(jsonA.value, diffSet.value) : jsonA.value;
        return viewMode.value === "flat" ? toFlatText(src, sortMode.value) : jsonStringify(src);
    });

    const viewTextB = computed(() => {
        const src = onlyDiff.value ? buildDiffOnlyTree(jsonB.value, diffSet.value) : jsonB.value;
        return viewMode.value === "flat" ? toFlatText(src, sortMode.value) : jsonStringify(src);
    });

    const resultTextFlat = computed(() => {
        const src = onlyDiff.value ? buildDiffOnlyTree(resultObj.value, diffSet.value) : resultObj.value;
        return toFlatText(src, sortMode.value);
    });

    function onResultJsonChange(v: string) {
        resultTextJson.value = v;
        const parsed = safeParseJson(v.trim() || "{}");
        if (!parsed.ok) {
            errorR.value = parsed.error;
            isDirty.value = true;
            return;
        }
        resultObj.value = parsed.value as JsonValue;
        errorR.value = null;
        isDirty.value = true;
    }

    function onResultFlatChange(v: string) {
        const parsed = parseFlatTextToTree(v);
        if (!parsed.ok) {
            errorR.value = parsed.error;
            isDirty.value = true;
            return;
        }
        resultTextJson.value = jsonStringify(parsed.value);
        resultObj.value = parsed.value;
        errorR.value = null;
        isDirty.value = true;
    }

    function onMinifyToggle(v: boolean) {
        minify.value = v;
        const p = safeParseJson(resultTextJson.value.trim() || "{}");
        if (!p.ok) return;
        resultTextJson.value = jsonStringify(p.value);
        resultObj.value = p.value as JsonValue;
        errorR.value = null;
    }

    function setSort(mode: SortMode) {
        sortMode.value = mode;
        sortResultNow();
    }

    function hiddenKeysForPane(pane: Pane) {
        const keys = allLeafKeys.value;
        return keys.filter((k) => {
            if (onlyDiff.value && !diffSet.value.has(k)) return true;
            return !!(query.value.trim() && !match(pane, k));

        });
    }

    const hiddenKeysA = computed(() => hiddenKeysForPane("A"));
    const hiddenKeysB = computed(() => hiddenKeysForPane("B"));
    const hiddenKeysR = computed(() => hiddenKeysForPane("R"));

    function isDiffLocal(path: string) {
        const a = getByPath(jsonA.value as any, path);
        const b = getByPath(jsonB.value as any, path);
        if (a === undefined && b === undefined) return false;
        return JSON.stringify(a) !== JSON.stringify(b);
    }

    function decoForPane(pane: Pane): MergeJsonDecoration[] {
        const out: MergeJsonDecoration[] = [];
        const keys = allLeafKeys.value;

        const q = query.value.trim();
        const found = q ? getMatches(pane) : [];

        for (const k of keys) {
            if (found.length && found.includes(k)) out.push({ path: k, kind: "find" });

            if (addedKeys.has(k) || pickByKey[k] === "ADDED") {
                if (pane === "R") out.push({path: k, kind: "added"});
                continue;
            }

            if (editedKeys.value.has(k) || pickByKey[k] === "EDITED") {
                if (pane === "R") out.push({path: k, kind: "edited"});
                continue;
            }

            const hasA = getByPath(jsonA.value as any, k) !== undefined;
            const hasB = getByPath(jsonB.value as any, k) !== undefined;

            const conflictPicked =
                isDiffLocal(k) && (pickByKey[k] === "A" || pickByKey[k] === "B" || pickByKey[k] === "EDITED");
            if (conflictPicked) {
                out.push({path: k, kind: "conflict"});
                continue;
            }

            const onlyAKey = hasA && !hasB;
            const onlyBKey = hasB && !hasA;

            const picked = pickByKey[k] === "A" ? "A" : pickByKey[k] === "B" ? "B" : truth.value;

            if (picked === "A" && onlyAKey) {
                if (pane !== "B") out.push({path: k, kind: "new"});
            }
            if (picked === "B" && onlyBKey) {
                if (pane !== "A") out.push({path: k, kind: "new"});
            }
        }

        return out;
    }

    const decorationsA = computed(() => decoForPane("A"));
    const decorationsB = computed(() => decoForPane("B"));
    const decorationsR = computed(() => decoForPane("R"));

    function selectKey(k: string) {
        selectedKey.value = (k || "").trim();
    }

    function onAddKey(payload: { key: string; value: string }) {
        const key = payload.key.trim();
        if (!key) return;

        const chk = keyExistsOrConflicts(resultObj.value, key);
        if (!chk.ok) {
            if (chk.reason === "exists") errorR.value = `Key already exists: ${key}`;
            else if (chk.reason === "prefixIsValue") errorR.value = `Cannot create "${key}": "${(chk as any).at}" is a value`;
            else if (chk.reason === "wouldShadowTree") errorR.value = `Cannot create "${key}": it would replace an existing object`;
            else errorR.value = "Invalid key";
            return;
        }

        const v = payload.value.trim() || "null";
        const parsed = safeParseJson(v);
        if (!parsed.ok) {
            errorR.value = parsed.error;
            return;
        }

        addedKeys.add(key);
        pickByKey[key] = "ADDED";
        patchResultValue(key, normalizeLoadedJson(parsed.value));
        selectedKey.value = key;
    }

    function applyRename(fromPrefix: string, toPrefix: string) {
        const from = fromPrefix.trim();
        const to = toPrefix.trim();
        if (!from || !to) return;

        const base: any = cloneDeep(resultObj.value);

        const keys = collectLeafPaths(base);
        const affected = keys.filter((k) => k === from || k.startsWith(from + "."));

        for (const k of affected) {
            const v = getByPath(base, k);
            const rest = k === from ? "" : k.slice(from.length + 1);
            const nk = rest ? `${to}.${rest}` : to;

            setByPath(base, nk, v);

            const parts = k.split(".").filter(Boolean);
            const last = parts.pop();
            const parent = getByPath(base, parts.join("."));
            if (parent && typeof parent === "object" && last) Reflect.deleteProperty(parent, last);
        }

        resultObj.value = base as JsonValue;
        resultTextJson.value = jsonStringify(base);
        errorR.value = null;
        isDirty.value = true;
    }

    function deleteBlock(path: string) {
        const p = path.trim();
        if (!p) return;

        const base: any = cloneDeep(resultObj.value);

        const parts = p.split(".").filter(Boolean);
        const last = parts.pop();
        const parent = getByPath(base, parts.join("."));
        if (parent && typeof parent === "object" && last) Reflect.deleteProperty(parent, last);

        resultObj.value = base as JsonValue;
        resultTextJson.value = jsonStringify(base);
        errorR.value = null;
        isDirty.value = true;
    }

    const canRename = computed(() => !!selectedKey.value);
    const canDeleteBlock = computed(() => !!selectedKey.value);

    const canDownload = computed(() => {
        const p = safeParseJson(resultTextJson.value.trim() || "{}");
        return p.ok;
    });

    function download(opts: { filename: string }) {
        const blob = new Blob([resultTextJson.value], {type: "application/json;charset=utf-8"});
        downloadBlob(blob, opts.filename || "merged.json");
    }

    const canFix = computed(() => (resultTextJson.value || "").trim().length > 0);

    function fixCurrent() {
        onFixJson();
    }

    async function onFilesA(files: File[]) {
        errorA.value = null;
        try {
            if (!files.length) return;
            const {obj} = await loadJsonFromFile(files[0]);
            jsonA.value = normalizeLoadedJson(obj) as JsonValue;
        } catch (e: any) {
            errorA.value = e?.message || "Invalid file";
        }
    }

    async function onFilesB(files: File[]) {
        errorB.value = null;
        try {
            if (!files.length) return;
            const {obj} = await loadJsonFromFile(files[0]);
            jsonB.value = normalizeLoadedJson(obj) as JsonValue;
        } catch (e: any) {
            errorB.value = e?.message || "Invalid file";
        }
    }

    function buildDiffOnlyTree(root: any, diff: Set<string>) {
        const walk = (node: any, prefix = ""): any => {
            if (node == null || typeof node !== "object" || Array.isArray(node)) {
                return prefix && diff.has(prefix) ? node : undefined;
            }

            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(node)) {
                if (k === "_meta") continue;
                const p = prefix ? `${prefix}.${k}` : k;
                const child = walk(v, p);
                if (child !== undefined) out[k] = child;
            }

            return Object.keys(out).length ? out : undefined;
        };

        return walk(root, "") ?? {};
    }

    watch([jsonA, jsonB, truth], () => setResultFromAuto(), {deep: true, immediate: true});

    return {
        viewMode,
        minify,
        showAddKey,
        truth,
        sortMode,
        onlyDiff,
        query,
        selectedKey,
        errorA,
        errorB,
        errorR,
        jsonA,
        jsonB,
        resultTextJson,
        resultObj,
        isDirty,
        pickByKey,
        addedKeys,
        editedKeys,
        autoResultTree,
        diffSet,
        allLeafKeys,
        viewTextA,
        viewTextB,
        resultTextFlat,
        hiddenKeysA,
        hiddenKeysB,
        hiddenKeysR,
        decorationsA,
        decorationsB,
        decorationsR,
        revealKey,
        modal,
        closeModal,
        accept,
        selectKey,
        useA,
        useB,
        resetSelected,
        takeAllFrom,
        fixCurrent,
        canFix,
        setSort,
        onResultJsonChange,
        onResultFlatChange,
        onMinifyToggle,
        onAddKey,
        canRename,
        openRename,
        canDeleteBlock,
        openDeleteBlock,
        canDownload,
        download,
        onFilesA,
        onFilesB,
        match,
        matchesA,
        matchesB,
        matchesR,
        matchesCount,
        matchIndex,
        jumpToMatch,
        validateResult
    };
}
