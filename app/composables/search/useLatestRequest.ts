export function useLatestRequest() {
  let sequence = 0;
  const next = () => ++sequence;
  const current = () => sequence;
  const isLatest = (request: number) => request === sequence;
  const cancelPending = () => { sequence += 1; };
  return { next, current, isLatest, cancelPending };
}
