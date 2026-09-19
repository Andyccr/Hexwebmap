import assert from "node:assert/strict";
import { escapeHtml } from "../js/dom.js";

assert.equal(escapeHtml(`<img src=x onerror=alert(1)>`), "&lt;img src=x onerror=alert(1)&gt;");
assert.equal(escapeHtml(`a&b"c"`), "a&amp;b&quot;c&quot;");
console.log("dom tests ok");
