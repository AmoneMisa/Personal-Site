import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMetroProximity,
  arcForCompassPoint,
  bearingBetween,
  bearingWithinArc,
  compassPointFor,
  destinationPoint,
  metresBetween,
  metroProximityIsEmpty,
  normalizeBearing,
  sectorPolygon,
} from '~/composables/flats/useMetroProximity.ts';

// Novza, Tashkent — geometry remains useful for drawing/editing the map overlay;
// result membership itself is decided in PostgreSQL before count/pagination.
const NOVZA = { name: 'Novza', lat: 41.2920278, lng: 69.2233417 };

function at(bearing, metres) {
  const point = destinationPoint(NOVZA, bearing, metres);
  return { lat: point.lat, lng: point.lng };
}

test('distance and bearing round-trip through destinationPoint', () => {
  for (const bearing of [0, 45, 137, 252, 270, 288, 359]) {
    const target = at(bearing, 780);
    assert.ok(Math.abs(metresBetween(NOVZA, target) - 780) < 0.5, `distance at ${bearing}`);
    assert.ok(Math.abs(normalizeBearing(bearingBetween(NOVZA, target) - bearing)) < 0.01
      || Math.abs(normalizeBearing(bearing - bearingBetween(NOVZA, target))) < 0.01, `bearing at ${bearing}`);
  }
});

test('an arc is the clockwise sweep, so it may straddle north', () => {
  assert.equal(bearingWithinArc(0, 340, 20), true);
  assert.equal(bearingWithinArc(350, 340, 20), true);
  assert.equal(bearingWithinArc(19, 340, 20), true);
  assert.equal(bearingWithinArc(180, 340, 20), false);
  assert.equal(bearingWithinArc(123, 90, 90), true);
});

test('legacy post-filter shim never changes backend membership', () => {
  const listings = [
    { id: 'west-inside', ...at(270, 600) },
    { id: 'west-edge', ...at(255, 770) },
    { id: 'west-too-far', ...at(270, 900) },
    { id: 'east-inside-radius', ...at(90, 400) },
    { id: 'north-inside-radius', ...at(0, 300) },
  ];
  const kept = applyMetroProximity(listings, {
    stations: [NOVZA],
    maxM: 780,
    bearingFrom: 252,
    bearingTo: 288,
  });
  assert.equal(kept, listings);
});

test('multi-station membership is not recomputed in the browser', () => {
  const other = { name: 'Other', lat: 41.31, lng: 69.28 };
  const listings = [
    { id: 'by-novza', ...at(270, 300) },
    { id: 'by-other', lat: other.lat + 0.001, lng: other.lng },
    { id: 'server-authoritative-third', lat: 41.35, lng: 69.35 },
  ];
  assert.equal(applyMetroProximity(listings, { stations: [NOVZA, other], maxM: 800 }), listings);
});

test('missing coordinates are a backend concern, not a browser-side drop', () => {
  const listings = [
    { id: 'no-coords', lat: null, lng: null },
    { id: 'nan', lat: Number.NaN, lng: 69.2 },
    { id: 'far-east', ...at(90, 5000) },
  ];
  assert.equal(applyMetroProximity(listings, { stations: [NOVZA], maxM: 780 }), listings);
});

test('an inert overlay is recognized without changing results', () => {
  const listings = [{ id: 'a', ...at(90, 9000) }];
  assert.equal(metroProximityIsEmpty({ stations: [] }), true);
  assert.equal(metroProximityIsEmpty({ stations: [NOVZA] }), true);
  assert.equal(metroProximityIsEmpty({ stations: [NOVZA], maxM: 500 }), false);
  assert.equal(applyMetroProximity(listings, { stations: [] }), listings);
  assert.equal(applyMetroProximity(listings, { stations: [NOVZA] }), listings);
});

test('the drawn wedge closes through the station, a full circle does not', () => {
  const wedge = sectorPolygon(NOVZA, 780, 252, 288);
  assert.deepEqual(wedge[0], { lat: NOVZA.lat, lng: NOVZA.lng });
  for (const point of wedge.slice(1)) {
    assert.ok(Math.abs(metresBetween(NOVZA, point) - 780) < 0.5);
  }
  const circle = sectorPolygon(NOVZA, 780);
  assert.ok(metresBetween(NOVZA, circle[0]) > 700, 'a full circle has no apex vertex');
});

test('compass points and their arcs agree with each other', () => {
  assert.equal(compassPointFor(247.5, 292.5), 'W');
  assert.equal(compassPointFor(252, 288), 'W');
  assert.equal(compassPointFor(340, 20), 'N');
  assert.deepEqual(arcForCompassPoint('W'), { from: 247.5, to: 292.5 });
  assert.deepEqual(arcForCompassPoint('N'), { from: 337.5, to: 22.5 });
});
