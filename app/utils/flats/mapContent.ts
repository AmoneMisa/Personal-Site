export function mapText(value: string, className = ""): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = value;
  return element;
}

export function mapColor(value: unknown): string {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
    ? value : "#8b5cf6";
}

export function districtLabel(label: string, color: string, dimmed: boolean): HTMLSpanElement {
  const element = mapText(label, `flat-zone-label${dimmed ? " flat-zone-label_dim" : ""}`);
  element.style.borderColor = mapColor(color);
  return element;
}

export function amenityMarker(symbol: string, color: string): HTMLSpanElement {
  const element = mapText(symbol, "flat-amenity-marker");
  element.style.setProperty("--amenity-color", mapColor(color));
  return element;
}
