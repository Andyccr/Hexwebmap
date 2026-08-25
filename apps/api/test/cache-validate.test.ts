import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LruTtlCache, TokenBucket } from "../src/cache.ts";
import { HttpError, parseLatLon, parseProfile, requireQuery } from "../src/validate.ts";

describe("LruTtlCache", () => {
  it("evicts oldest when over capacity", () => {
    const c = new LruTtlCache<number>(2, 60_000);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    assert.equal(c.get("a"), undefined);
    assert.equal(c.get("b"), 2);
    assert.equal(c.get("c"), 3);
  });

  it("expires entries", async () => {
    const c = new LruTtlCache<string>(10, 20);
    c.set("k", "v");
    assert.equal(c.get("k"), "v");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(c.get("k"), undefined);
  });
});

describe("validate", () => {
  it("rejects empty queries", () => {
    assert.throws(() => requireQuery("  "), (e: unknown) => e instanceof HttpError);
  });

  it("parses coordinates", () => {
    assert.deepEqual(parseLatLon("39.9", "116.4"), { lat: 39.9, lon: 116.4 });
    assert.throws(() => parseLatLon("100", "0"), (e: unknown) => e instanceof HttpError);
  });

  it("accepts route profiles", () => {
    assert.equal(parseProfile("cycling"), "cycling");
    assert.throws(() => parseProfile("flight"), (e: unknown) => e instanceof HttpError);
  });
});

describe("TokenBucket", () => {
  it("blocks after burst", () => {
    const b = new TokenBucket(0, 2);
    assert.equal(b.take("x"), true);
    assert.equal(b.take("x"), true);
    assert.equal(b.take("x"), false);
  });
});
