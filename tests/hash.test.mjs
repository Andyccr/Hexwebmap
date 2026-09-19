import assert from "node:assert/strict";
import { parseMapHash, serializeMapHash } from "../js/hash.js";

const view = { zoom: 10.5, lat: 31.23, lon: 121.47, bearing: 0, pitch: 0 };
const hash = serializeMapHash(view, "liberty");
assert.match(hash, /^#map=/);
const parsed = parseMapHash(hash);
assert.equal(parsed.lat.toFixed(5), "31.23000");
assert.equal(parsed.lon.toFixed(5), "121.47000");
assert.equal(parsed.style, "liberty");

assert.equal(parseMapHash("#nope"), null);
assert.equal(parseMapHash("#map=abc/1/2"), null);
assert.ok(parseMapHash("#s=dark").style === "dark");

const tilted = parseMapHash("#map=8/40/116/45.0/20.0&s=fiord");
assert.equal(tilted.bearing, 45);
assert.equal(tilted.pitch, 20);
assert.equal(tilted.style, "fiord");

console.log("hash tests ok");
