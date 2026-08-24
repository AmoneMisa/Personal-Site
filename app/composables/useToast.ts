type ToastInput = {
  title?: string;
  description?: string;
  color?: string;
  icon?: string;
};

const TOAST_HOST_ID = "site-toast-host";

function ensureToastHost(): HTMLElement | null {
  if (!import.meta.client) return null;
  let host = document.getElementById(TOAST_HOST_ID);
  if (host) return host;

  host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-atomic", "false");
  Object.assign(host.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "10000",
    display: "grid",
    gap: "10px",
    width: "min(420px, calc(100vw - 32px))",
    pointerEvents: "none",
  });
  document.body.appendChild(host);
  return host;
}

function addToast(input: ToastInput) {
  const host = ensureToastHost();
  if (!host) return;

  const toast = document.createElement("div");
  toast.setAttribute("role", "status");
  toast.style.cssText = [
    "pointer-events:auto",
    "border:1px solid rgba(224,103,154,.45)",
    "border-radius:12px",
    "background:#12162d",
    "color:#f4f5fb",
    "box-shadow:0 16px 42px rgba(0,0,0,.38)",
    "padding:14px 16px",
    "font:500 14px/1.45 Inter,system-ui,sans-serif",
  ].join(";");

  const title = document.createElement("div");
  title.textContent = input.title || "";
  title.style.cssText = "font-weight:700;color:#e0679a;margin-bottom:3px";
  toast.appendChild(title);

  if (input.description) {
    const description = document.createElement("div");
    description.textContent = input.description;
    description.style.cssText = "color:#c7c9d9";
    toast.appendChild(description);
  }

  toast.addEventListener("click", () => toast.remove());
  host.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

/**
 * Lightweight site-native toast API.
 * Kept intentionally provider-free: Personal-Site does not use Nuxt UI.
 */
export function useToast() {
  return { add: addToast };
}
