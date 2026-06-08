const test = require("node:test");
const assert = require("node:assert/strict");
const { renderTemplate } = require("../lib/formater.js");

test("replaces a /*[|key|]*/0 token with the matching data value", () => {
    const out = renderTemplate("hello /*[|name|]*/0!", { name: "world" });
    assert.equal(out, "hello world!");
});

test("accepts optional whitespace inside the token brackets", () => {
    const out = renderTemplate("a /*[| name |]*/0 b", { name: "X" });
    assert.equal(out, "a X b");
});

test("accepts optional whitespace before the trailing 0 (prettier-formatted)", () => {
    const out = renderTemplate("a /*[|name|]*/ 0 b", { name: "X" });
    assert.equal(out, "a X b");
});

test("replaces multiple occurrences of the same key", () => {
    const out = renderTemplate("/*[|x|]*/0 /*[|x|]*/0", { x: "Y" });
    assert.equal(out, "Y Y");
});

test("object values are JSON-stringified", () => {
    const out = renderTemplate("config = /*[|cfg|]*/0;", { cfg: { a: 1, b: "two" } });
    assert.equal(out, 'config = {"a":1,"b":"two"};');
});

test("missing key falls back to the bare key name (current behavior)", () => {
    const out = renderTemplate("hello /*[|missing|]*/0", { other: "x" });
    assert.equal(out, "hello missing");
});

test("non-token text is preserved unchanged", () => {
    const out = renderTemplate("plain text with /* not a token */", {});
    assert.equal(out, "plain text with /* not a token */");
});
