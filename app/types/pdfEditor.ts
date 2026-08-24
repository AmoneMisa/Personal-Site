export type PdfLinkRegion = {x: number; y: number; w: number; h: number; uri: string};
export type PdfAlignGuide = {k: string; v: boolean; pos: number; start: number; end: number};
export type PdfImageClip = {cx: number; cy: number; rx: number; ry: number};
export type PdfImageRegion = {
  id?: string;
  name: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  clip?: PdfImageClip;
};
export type PdfDeletedImage = {name: string; x: number; y: number; w: number; h: number; dpi: number};
export type PdfPhotoFrame = {cx: number; cy: number; rx: number; ry: number};
export type PdfEditorMode = "move" | "pen" | "highlighter" | "signature" | "rect" | "circle" | "text" | "image";
export type PdfBrushShape = "round" | "square";
export type PdfTextAlign = "left" | "center" | "right" | "justify";

export type PdfEditorState = {
  mode: PdfEditorMode;
  color: string;
  opacity: number;
  size: number;
  brushShape: PdfBrushShape;
  fullMode: boolean;
  textValue: string;
  textFont: string;
  textSize: number;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;
  signatureSize: number;
};

export type PdfSelectedObjectState = {
  exists: boolean;
  isText: boolean;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: PdfTextAlign;
  color: string;
  opacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
};

export type PdfDraft = {
  v: 1;
  updatedAt: number;
  pages: Record<number, any>;
  deletedImages?: Record<number, PdfDeletedImage[]>;
  ui?: {page?: number; zoom?: number};
};

export type PdfOriginalRun = {
  n: number;
  fontSize?: number;
  fontName?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

export type PdfOriginalBlock = {
  id?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text: string;
  fontSize?: number;
  fontName?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  lineHeight?: number;
  lineRuns?: PdfOriginalRun[][];
};

export type PdfOriginalBlockMeta = {
  id: string | null;
  page: number;
  dpi: number;
  x: number;
  y: number;
  w: number;
  h: number;
  xPt?: number;
  yPt?: number;
  wPt?: number;
  hPt?: number;
  text: string;
  fontSize: number | null;
  fontSizePt?: number | null;
  fontName: string | null;
  bold: boolean;
  italic: boolean;
  color: string | null;
};

export type PdfTextEditBlock = {
  id?: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  fontSizePt: number;
  fontName: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: string;
  color: string;
  opacity: number;
  angle: number;
  orig: PdfOriginalBlockMeta | null;
};

export type PdfImageEdit = {
  name: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  angle: number;
  deleted: boolean;
  orig: {xPt: number; yPt: number; wPt: number; hPt: number};
};
