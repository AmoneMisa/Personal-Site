import type { Canvas } from "fabric";
import { ref } from "vue";
import type { PdfAlignGuide } from "~/types/pdfEditor";

type Edges = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
};

const SNAP_PX = 6;

function edgesOf(object: any): Edges {
  const rect = object.getBoundingRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
  };
}

export function usePdfAlignmentGuides(getCanvas: () => Canvas | null) {
  const alignGuides = ref<PdfAlignGuide[]>([]);

  function clearGuides() {
    if (alignGuides.value.length) alignGuides.value = [];
  }

  function onObjectMoving(event: any) {
    const canvas = getCanvas();
    const object = event?.target;
    if (!canvas || !object) {
      clearGuides();
      return;
    }

    if (object.type === "activeselection" || Math.round(object.angle || 0) % 360 !== 0) {
      clearGuides();
      return;
    }

    const others = canvas.getObjects().filter((item: any) => item !== object && item.visible !== false);
    const movingEdges = edgesOf(object);
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const verticalCandidates: { t: number; a: number; b: number }[] = [
      { t: canvasWidth / 2, a: 0, b: canvasHeight },
    ];
    const horizontalCandidates: { t: number; a: number; b: number }[] = [
      { t: canvasHeight / 2, a: 0, b: canvasWidth },
    ];

    for (const item of others) {
      const edges = edgesOf(item);
      verticalCandidates.push(
        { t: edges.left, a: edges.top, b: edges.bottom },
        { t: edges.cx, a: edges.top, b: edges.bottom },
        { t: edges.right, a: edges.top, b: edges.bottom },
      );
      horizontalCandidates.push(
        { t: edges.top, a: edges.left, b: edges.right },
        { t: edges.cy, a: edges.left, b: edges.right },
        { t: edges.bottom, a: edges.left, b: edges.right },
      );
    }

    let bestX: { d: number; t: number; a: number; b: number } | null = null;
    for (const moving of [movingEdges.left, movingEdges.cx, movingEdges.right]) {
      for (const candidate of verticalCandidates) {
        const distance = candidate.t - moving;
        if (Math.abs(distance) <= SNAP_PX && (bestX === null || Math.abs(distance) < Math.abs(bestX.d))) {
          bestX = { d: distance, t: candidate.t, a: candidate.a, b: candidate.b };
        }
      }
    }

    let bestY: { d: number; t: number; a: number; b: number } | null = null;
    for (const moving of [movingEdges.top, movingEdges.cy, movingEdges.bottom]) {
      for (const candidate of horizontalCandidates) {
        const distance = candidate.t - moving;
        if (Math.abs(distance) <= SNAP_PX && (bestY === null || Math.abs(distance) < Math.abs(bestY.d))) {
          bestY = { d: distance, t: candidate.t, a: candidate.a, b: candidate.b };
        }
      }
    }

    if (bestX) object.left = (object.left || 0) + bestX.d;
    if (bestY) object.top = (object.top || 0) + bestY.d;
    if (bestX || bestY) object.setCoords();

    const guides: PdfAlignGuide[] = [];
    const snappedEdges = edgesOf(object);
    if (bestX) {
      guides.push({
        k: "v",
        v: true,
        pos: bestX.t,
        start: Math.min(bestX.a, snappedEdges.top),
        end: Math.max(bestX.b, snappedEdges.bottom),
      });
    }
    if (bestY) {
      guides.push({
        k: "h",
        v: false,
        pos: bestY.t,
        start: Math.min(bestY.a, snappedEdges.left),
        end: Math.max(bestY.b, snappedEdges.right),
      });
    }
    alignGuides.value = guides;
  }

  return { alignGuides, clearGuides, onObjectMoving };
}
