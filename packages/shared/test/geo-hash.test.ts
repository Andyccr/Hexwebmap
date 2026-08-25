import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bboxFromPhotonExtent,
  formatDistance,
  haversineMeters,
  parseCoordinateQuery,
  pathLengthMeters,
} from "../src/geo.ts";
import { parseMapHash, serializeMapHash } from "../src/hash.ts";

describe("geo", () => {
  it("computes Paris–London roughly 344 km", () => {
    const m = haversineMeters([2.3522, 48.8566], [-0.1276, 51.5074]);
    assert.ok(m > 330_000 && m < 360_000);
  });

  it("sums path length", () => {
    const len = pathLengthMeters([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    assert.ok(len > 200_000);
  });

  it("parses lat,lon queries", () => {
    assert.deepEqual(parseCoordinateQuery("39.9, 116.4"), { lat: 39.9, lon: 116.4 });
    assert.deepEqual(parseCoordinateQuery("116.4, 39.9"), { lat: 39.9, lon: 116.4 });
    assert.equal(parseCoordinateQuery("hello"), null);
  });

  it("normalizes photon extent", () => {
    assert.deepEqual(bboxFromPhotonExtent([10, 50, 20, 40]), [10, 40, 20, 50]);
  });

  it("formats metric distances", () => {
    assert.equal(formatDistance(120, "en"), "120 m");
    assert.equal(formatDistance(12_400, "zh"), "12.4 公里");
  });
});

describe("hash", () => {
  it("round-trips a 2D view", () => {
    const hash = serializeMapHash(
      { zoom: 12.4, lat: 51.505, lon: -0.09, bearing: 0, pitch: 0 },
      "liberty",
    );
    const parsed = parseMapHash(hash);
    assert.ok(parsed);
    assert.equal(parsed.style, "liberty");
    assert.ok(Math.abs((parsed.zoom ?? 0) - 12.4) < 0.01);
    assert.ok(Math.abs((parsed.lat ?? 0) - 51.505) < 1e-4);
  });

  it("reads OSM-style hashes", () => {
    const parsed = parseMapHash("#map=6/51.507/-0.127");
    assert.ok(parsed);
    assert.equal(parsed.lat?.toFixed(3), "51.507");
    assert.equal(parsed.lon?.toFixed(3), "-0.127");
  });
});
