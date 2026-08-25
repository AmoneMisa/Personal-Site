import type { Canvas } from "fabric";
import type { Ref } from "vue";
import { computed, reactive } from "vue";
import {PDF_SERIALIZED_PROPERTIES} from "~/utils/pdfEditor/core";

type PdfCanvasHistoryOptions = {
  page: Ref<number>;
  pageJson: Record<number, any>;
  getCanvas: () => Canvas | null;
  scheduleSave: () => void;
};

export function usePdfCanvasHistory(options: PdfCanvasHistoryOptions) {
  const history = reactive({
    stack: [] as any[],
    idx: -1,
    lock: false,
  });

  const canUndo = computed(() => history.idx > 0);
  const canRedo = computed(() => history.idx >= 0 && history.idx < history.stack.length - 1);

  function pushHistory() {
    const canvas = options.getCanvas();
    if (!canvas || history.lock) return;

    const snapshot = canvas.toJSON(PDF_SERIALIZED_PROPERTIES);
    history.stack = history.stack.slice(0, history.idx + 1);
    history.stack.push(snapshot);
    history.idx = history.stack.length - 1;
    options.pageJson[options.page.value] = snapshot;
    options.scheduleSave();
  }

  function restoreAt(index: number) {
    const canvas = options.getCanvas();
    if (!canvas) return;

    history.idx = index;
    const snapshot = history.stack[history.idx];
    history.lock = true;
    canvas.loadFromJSON(snapshot, () => {
      history.lock = false;
      canvas.requestRenderAll();
      options.pageJson[options.page.value] = snapshot;
      options.scheduleSave();
    });
  }

  function undo() {
    if (!canUndo.value) return;
    restoreAt(history.idx - 1);
  }

  function redo() {
    if (!canRedo.value) return;
    restoreAt(history.idx + 1);
  }

  function resetHistory() {
    history.stack = [];
    history.idx = -1;
    history.lock = false;
  }

  return { history, canUndo, canRedo, pushHistory, undo, redo, resetHistory };
}
