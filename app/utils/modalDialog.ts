interface DialogScope {
  element: HTMLElement;
  opener: HTMLElement | null;
  branches: Set<HTMLElement>;
}

const dialogs: DialogScope[] = [];
const inertBefore = new Map<HTMLElement, boolean>();
let scrollBefore: { overflow: string; padding: string } | null = null;
let observer: MutationObserver | null = null;
const top = () => dialogs.at(-1);
const roots = (scope: DialogScope) => [scope.element, ...scope.branches];
const contains = (scope: DialogScope, node: Node | null) => !!node && roots(scope).some((root) => root.contains(node));

function reconcileInert() {
  for (const [element, wasInert] of inertBefore) element.toggleAttribute("inert", wasInert);
  const scope = top();
  if (!scope) {
    inertBefore.clear();
    return;
  }
  const allowed = roots(scope);
  for (const root of allowed) {
    let node: HTMLElement | null = root;
    while (node?.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || allowed.some((item) => sibling.contains(item))) continue;
        if (!inertBefore.has(sibling)) inertBefore.set(sibling, sibling.hasAttribute("inert"));
        sibling.setAttribute("inert", "");
      }
      if (node.parentElement === document.body) break;
      node = node.parentElement;
    }
  }
}

function focusable(scope: DialogScope): HTMLElement[] {
  const selector = "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
  return roots(scope).flatMap((root) => [...root.querySelectorAll<HTMLElement>(selector)])
    .filter((element) => !element.closest("[inert],[hidden]") && element.getClientRects().length > 0);
}

function focusInside(scope: DialogScope) {
  (focusable(scope)[0] ?? scope.element).focus({ preventScroll: true });
}

function onFocus(event: FocusEvent) {
  const scope = top();
  if (scope && !contains(scope, event.target as Node)) focusInside(scope);
}

function onKeydown(event: KeyboardEvent) {
  const scope = top();
  if (!scope || event.key !== "Tab") return;
  const items = focusable(scope);
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) {
    event.preventDefault();
    scope.element.focus({ preventScroll: true });
  } else if (!contains(scope, document.activeElement) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function isTopModalDialog(element: HTMLElement | null): boolean {
  return top()?.element === element;
}

export const hasOpenModalDialogs = () => dialogs.length > 0;

/** Includes a teleported select popup in the dialog that owns its trigger. */
export function registerModalBranch(anchor: HTMLElement, element: HTMLElement): () => void {
  const scope = [...dialogs].reverse().find((dialog) => contains(dialog, anchor));
  if (!scope) return () => {};
  scope.branches.add(element);
  reconcileInert();
  return () => {
    scope.branches.delete(element);
    reconcileInert();
  };
}

export function activateModalDialog(element: HTMLElement): () => void {
  const scope: DialogScope = { element, branches: new Set(), opener: document.activeElement instanceof HTMLElement ? document.activeElement : null };
  const tabindex = element.getAttribute("tabindex");
  element.setAttribute("tabindex", "-1");
  if (!dialogs.length) {
    scrollBefore = { overflow: document.body.style.overflow, padding: document.body.style.paddingRight };
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("focusin", onFocus, true);
    observer = new MutationObserver(reconcileInert);
    observer.observe(document.body, { childList: true });
  }
  dialogs.push(scope);
  reconcileInert();
  focusInside(scope);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const wasTop = top() === scope;
    dialogs.splice(dialogs.indexOf(scope), 1);
    if (tabindex == null) element.removeAttribute("tabindex");
    else element.setAttribute("tabindex", tabindex);
    reconcileInert();
    if (!dialogs.length) {
      observer?.disconnect();
      observer = null;
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("focusin", onFocus, true);
      document.body.style.overflow = scrollBefore?.overflow ?? "";
      document.body.style.paddingRight = scrollBefore?.padding ?? "";
      scrollBefore = null;
    }
    if (wasTop) {
      if (scope.opener?.isConnected && (!top() || contains(top()!, scope.opener))) scope.opener.focus({ preventScroll: true });
      else if (top()) focusInside(top()!);
    }
  };
}
