import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../app/components/flats/FlatMap.client.vue', import.meta.url), 'utf8');
const automaticStart = source.indexOf('function fitToPoints()');
const manualStart = source.indexOf('function fitToPointsNow()', automaticStart);
const renderAreaStart = source.indexOf('function renderArea()', manualStart);
const automatic = source.slice(automaticStart, source.lastIndexOf('/**', manualStart));
const manual = source.slice(manualStart, renderAreaStart);
const filterWatchStart = source.indexOf('watch(() => stableQueryKey(normalizedRouteQuery())');
const secondFilterWatchStart = source.indexOf('watch(() => stableQueryKey(normalizedRouteQuery())', filterWatchStart + 1);
const filterWatch = source.slice(filterWatchStart, secondFilterWatchStart);

function cameraHarness() {
  const calls = [];
  const context = vm.createContext({
    map: { fitBounds: (...args) => calls.push(args) },
    focusedPoint: { value: null },
    props: {},
    preserveCamera: false,
    lastFitSig: '',
    renderedPoints: { value: [{ id: 'near-metro', lat: 41.3, lng: 69.2 }] },
    pointKey: (p) => p.id,
    selectedZoneFromProps: () => null,
    renderFocusedPoint() {},
    stableQueryKey: () => '',
    normalizedRouteQuery: () => ({}),
    watch: (_key, callback) => { context.changeFilters = callback; },
    loadFullMapFeed() {},
  });
  vm.runInContext(ts.transpile(`${automatic}\n${manual}\n${filterWatch}`), context);
  return { context, calls };
}

test('initial map feed can finish framing after the first card page', () => {
  const { context, calls } = cameraHarness();
  context.fitToPoints();
  context.renderedPoints.value.push({ id: 'second', lat: 41.4, lng: 69.3 });
  context.fitToPoints();
  assert.equal(calls.length, 2);
});

test('clearing metro filters preserves the camera when broader results arrive', () => {
  const { context, calls } = cameraHarness();
  context.fitToPoints();
  context.changeFilters();
  context.renderedPoints.value.push({ id: 'far-away', lat: 45, lng: 70 });
  context.fitToPoints();
  assert.equal(calls.length, 1);
  context.fitToPointsNow();
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0].length, 2);
  context.renderedPoints.value.push({ id: 'refresh', lat: 44, lng: 71 });
  context.fitToPoints();
  assert.equal(calls.length, 2);
});

test('initial results do not override a city scope or a user-chosen view', () => {
  const { context, calls } = cameraHarness();
  context.props.cityZone = { id: 'city' };
  context.fitToPoints();
  context.props.cityZone = null;
  context.preserveCamera = true;
  context.fitToPoints();
  assert.equal(calls.length, 0);
});
