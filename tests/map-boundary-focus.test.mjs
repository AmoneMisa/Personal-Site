import test from "node:test";
import assert from "node:assert/strict";
import { primaryBoundaryGeometry } from "../app/utils/mapBoundaryFocus.ts";

test("map focus uses the largest part of a district multipolygon", () => {
  const primary = [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]];
  const exclave = [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]];
  const boundary = { type: "MultiPolygon", coordinates: [exclave, primary] };

  assert.deepEqual(primaryBoundaryGeometry(boundary), {
    type: "Polygon",
    coordinates: primary,
  });
  assert.equal(boundary.coordinates.length, 2, "render geometry must remain intact");
});

test("map focus preserves ordinary polygon geometry", () => {
  const boundary = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] };
  assert.equal(primaryBoundaryGeometry(boundary), boundary);
});
