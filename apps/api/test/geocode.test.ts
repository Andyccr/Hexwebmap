import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasHan, mergeHits, photonLang } from "../src/geocode.ts";

describe("geocode helpers", () => {
  it("maps Photon languages and rejects zh", () => {
    assert.equal(photonLang("en"), "en");
    assert.equal(photonLang("fr"), "fr");
    assert.equal(photonLang("zh"), undefined);
    assert.equal(photonLang("zh-CN"), undefined);
  });

  it("detects Han script", () => {
    assert.equal(hasHan("东京"), true);
    assert.equal(hasHan("Tokyo"), false);
  });

  it("merges hits without duplicate OSM ids", () => {
    const a = {
      id: "R:1",
      name: "Tokyo",
      label: "Tokyo",
      lat: 35.6,
      lon: 139.7,
      osmType: "R",
      osmId: 1,
    };
    const b = { ...a, id: "R:1-dup", name: "Tōkyō" };
    const c = {
      id: "N:2",
      name: "Shinjuku",
      label: "Shinjuku",
      lat: 35.7,
      lon: 139.7,
      osmType: "N",
      osmId: 2,
    };
    const merged = mergeHits([a], [b, c], 8);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.name, "Tokyo");
    assert.equal(merged[1]?.name, "Shinjuku");
  });
});
