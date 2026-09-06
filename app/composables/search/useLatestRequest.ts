export function useLatestRequest() {
  let sequence = 0;
  let controller: AbortController | undefined;
  const next = () => {
    controller?.abort();
    controller = new AbortController();
    return ++sequence;
  };
  const current = () => sequence;
  const isLatest = (request: number) => request === sequence;
  const signal = () => controller?.signal;
  const cancelPending = () => {
    controller?.abort();
    controller = undefined;
    sequence += 1;
  };
  return { next, current, isLatest, signal, cancelPending };
}
