import {Ellipse, FabricImage, type Canvas} from "fabric";
import type {Ref} from "vue";
import {ref} from "vue";
import type {
  PdfDeletedImage,
  PdfEditorState,
  PdfPhotoFrame,
} from "~/types/pdfEditor";
import {
  PDF_SERIALIZED_PROPERTIES,
  setFabricObjectByTopLeft,
} from "~/utils/pdfEditor/core";

type PdfImageToolsOptions = {
  page: Ref<number>;
  editor: PdfEditorState;
  deletedImages: Record<number, PdfDeletedImage[]>;
  photoFrames: Record<number, PdfPhotoFrame>;
  pageJson: Record<number, any>;
  getCanvas: () => Canvas | null;
  applyMode: () => void;
  pushHistory: () => void;
  scheduleSave: () => void;
  syncSelected: (object: any) => void;
};

function isImageObject(object: any) {
  return !!object && (object.type === "image" || typeof object.setSrc === "function");
}

export function usePdfImageTools(options: PdfImageToolsOptions) {
  const imageInput = ref<HTMLInputElement | null>(null);
  const replaceInput = ref<HTMLInputElement | null>(null);

  function openImagePicker() {
    imageInput.value?.click();
  }

  async function onPickImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !options.getCanvas()) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const canvas = options.getCanvas();
      if (!canvas) return;

      const image = await FabricImage.fromURL(reader.result as string);
      image.set({opacity: options.editor.opacity / 100});
      const width = image.width || 1;
      const height = image.height || 1;
      image.scale(Math.min(360 / width, 220 / height, 1));
      setFabricObjectByTopLeft(image, 80, 80);
      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      options.editor.mode = "move";
      options.applyMode();
    };
    reader.readAsDataURL(file);
  }

  function replaceSelectedImage() {
    const object: any = options.getCanvas()?.getActiveObject();
    if (object && typeof object.setSrc === "function") replaceInput.value?.click();
  }

  async function onPickReplaceImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    const object: any = options.getCanvas()?.getActiveObject();
    if (!file || !object || typeof object.setSrc !== "function") return;

    const previousWidth = object.getScaledWidth();
    const previousHeight = object.getScaledHeight();
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await object.setSrc(reader.result as string, {crossOrigin: "anonymous"});
        const naturalWidth = object.width || 1;
        const naturalHeight = object.height || 1;
        object.set({
          scaleX: previousWidth / naturalWidth,
          scaleY: previousHeight / naturalHeight,
        });
        object.setCoords();
        options.getCanvas()?.requestRenderAll();
        options.pushHistory();
        options.scheduleSave();
        refreshImageClip(object);
      } catch {
        // Preserve the original image when replacement fails.
      }
    };
    reader.readAsDataURL(file);
  }

  function onCanvasMouseDown(event: any) {
    const canvas = options.getCanvas();
    const object = event?.target;
    if (!canvas || event?.e?.button !== 2 || !isImageObject(object)) return;
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    replaceInput.value?.click();
  }

  function recoverPhotoFrame(pageNumber: number) {
    const canvas = options.getCanvas();
    if (!canvas || options.photoFrames[pageNumber]) return;

    for (const object of canvas.getObjects() as any[]) {
      const clipPath = object?.clipPath;
      if (isImageObject(object) && clipPath && typeof clipPath.rx === "number" && clipPath.absolutePositioned) {
        options.photoFrames[pageNumber] = {
          cx: clipPath.left,
          cy: clipPath.top,
          rx: clipPath.rx,
          ry: clipPath.ry,
        };
        return;
      }
    }
  }

  function refreshImageClip(object: any) {
    const canvas = options.getCanvas();
    if (!canvas || !isImageObject(object)) return;
    const frame = options.photoFrames[options.page.value];
    if (!frame) return;

    const center = object.getCenterPoint();
    const dx = (center.x - frame.cx) / frame.rx;
    const dy = (center.y - frame.cy) / frame.ry;
    if (dx * dx + dy * dy <= 1) {
      object.clipPath = new Ellipse({
        originX: "center",
        originY: "center",
        left: frame.cx,
        top: frame.cy,
        rx: frame.rx,
        ry: frame.ry,
        absolutePositioned: true,
      });
    } else if (object.clipPath) {
      object.clipPath = undefined;
      canvas.bringObjectToFront(object);
    }
    object.setCoords();
  }

  function fitImageToFrame(object: any) {
    const canvas = options.getCanvas();
    if (!canvas || !isImageObject(object)) return false;
    const frame = options.photoFrames[options.page.value];
    if (!frame) return false;

    const center = object.getCenterPoint();
    const dx = (center.x - frame.cx) / frame.rx;
    const dy = (center.y - frame.cy) / frame.ry;
    if (dx * dx + dy * dy > 1) return false;

    const naturalWidth = object.width || 1;
    const naturalHeight = object.height || 1;
    const scale = Math.max((frame.rx * 2) / naturalWidth, (frame.ry * 2) / naturalHeight);
    object.set({
      angle: 0,
      scaleX: scale,
      scaleY: scale,
      left: frame.cx - naturalWidth * scale / 2,
      top: frame.cy - naturalHeight * scale / 2,
    });
    object.clipPath = new Ellipse({
      originX: "center",
      originY: "center",
      left: frame.cx,
      top: frame.cy,
      rx: frame.rx,
      ry: frame.ry,
      absolutePositioned: true,
    });
    object.setCoords();
    return true;
  }

  function onImageDrop(object: any) {
    const canvas = options.getCanvas();
    if (!canvas) return;
    if (fitImageToFrame(object)) {
      canvas.requestRenderAll();
      options.syncSelected(object);
      options.pushHistory();
    } else {
      refreshImageClip(object);
    }
  }

  function trackDeletedImage(object: any) {
    if (!object || object.tool !== "pdfimg" || !object.orig) return;
    const original = object.orig;
    const deleted = options.deletedImages[options.page.value]
      || (options.deletedImages[options.page.value] = []);
    deleted.push({
      name: String(object.name || ""),
      x: original.x,
      y: original.y,
      w: original.w,
      h: original.h,
      dpi: original.dpi,
    });
  }

  function removeSelected() {
    const canvas = options.getCanvas();
    const object: any = canvas?.getActiveObject();
    if (!canvas || !object) return;

    if (typeof object.getObjects === "function") object.getObjects().forEach(trackDeletedImage);
    else trackDeletedImage(object);
    canvas.remove(object);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function clearPage() {
    const canvas = options.getCanvas();
    if (!canvas) return;
    canvas.getObjects().forEach(trackDeletedImage);
    canvas.clear();
    canvas.requestRenderAll();
    options.pageJson[options.page.value] = canvas.toJSON(PDF_SERIALIZED_PROPERTIES);
    options.scheduleSave();
  }

  return {
    imageInput,
    replaceInput,
    openImagePicker,
    onPickImage,
    replaceSelectedImage,
    onPickReplaceImage,
    onCanvasMouseDown,
    recoverPhotoFrame,
    refreshImageClip,
    onImageDrop,
    removeSelected,
    clearPage,
  };
}
