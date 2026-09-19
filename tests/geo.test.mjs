import assert from "node:assert/strict";
import {
  bboxOfLine,
  mergeHits,
  parseCoordinateQuery,
  pathLengthMeters,
  rankHits,
  simplifyPath,
  wrapLon,
} from "../js/geo.js";

assert.equal(wrapLon(190), -170);
assert.equal(wrapLon(-190), 170);
assert.equal(wrapLon(0), 0);
assert.equal(wrapLon(540), -180);
assert.equal(wrapLon(Number.NaN), 0);

assert.deepEqual(parseCoordinateQuery("40.71, -74.01"), { lat: 40.71, lon: -74.01 });
assert.deepEqual(parseCoordinateQuery("103.8 1.3"), { lat: 1.3, lon: 103.8 });
assert.equal(parseCoordinateQuery("tokyo"), null);

const line = [
  [0, 0],
  [0.0001, 0],
  [1, 0],
];
const simple = simplifyPath(line, 50);
assert.equal(simple.length, 2);
assert.deepEqual(simple[0], [0, 0]);
assert.deepEqual(simple[1], [1, 0]);

const long = pathLengthMeters([
  [0, 0],
  [0, 1],
]);
assert.ok(long > 100_000 && long < 120_000);

const bbox = bboxOfLine([
  [10, 20],
  [-5, 40],
  [8, -2],
]);
assert.deepEqual(bbox, [-5, -2, 10, 40]);

const ranked = rankHits(
  [
    { name: "Paris", label: "France", lat: 48.8, lon: 2.3 },
    { name: "Par", label: "elsewhere", lat: 0, lon: 0 },
    { name: "Tokyo", label: "Japan", lat: 35.6, lon: 139.7 },
  ],
  "par",
  { lat: 48.85, lon: 2.35 },
);
assert.equal(ranked[0].name, "Par");
assert.equal(ranked[1].name, "Paris");

const merged = mergeHits(
  [{ osmType: "N", osmId: 1, lat: 1, lon: 1, name: "a" }],
  [
    { osmType: "N", osmId: 1, lat: 1, lon: 1, name: "dup" },
    { osmType: "N", osmId: 2, lat: 2, lon: 2, name: "b" },
  ],
  8,
);
assert.equal(merged.length, 2);
assert.equal(merged[0].name, "a");

console.log("geo tests ok");
