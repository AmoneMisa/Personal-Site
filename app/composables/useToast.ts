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

