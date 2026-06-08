const test = require("node:test");
const assert = require("node:assert/strict");
const {
    convertCommonJSToBrowserJS,
    buildStaticryptJS,
    isCustomPasswordTemplateDefault,
    getValidatedSalt,
} = require("../cli/helpers.js");
const path = require("node:path");

test("convertCommonJSToBrowserJS produces an IIFE that returns exports", () => {
    const result = convertCommonJSToBrowserJS("lib/cryptoEngine");
    assert.ok(result.startsWith("((function(){"), "starts with IIFE wrapper");
    assert.ok(result.endsWith("})())"), "ends with IIFE wrapper");
    assert.ok(result.includes("const exports = {};"), "declares exports object");
    assert.ok(result.includes("return exports;"), "returns exports");
});

test("convertCommonJSToBrowserJS strips lines containing require(...)", () => {
    const result = convertCommonJSToBrowserJS("lib/cryptoEngine");
    assert.ok(!result.includes("require("), "no require() calls remain in bundled output");
    assert.ok(!result.includes("node:crypto"), "node-only branch removed");
});

test("buildStaticryptJS inlines codec and cryptoEngine into staticryptJs", () => {
    const result = buildStaticryptJS();
    // The result should contain the IIFE-wrapped sub-modules in place of the tokens.
    assert.ok(result.includes("hashPassword"), "cryptoEngine code is inlined");
    assert.ok(result.includes("function init(cryptoEngine)"), "codec init() is inlined");
    assert.ok(result.includes("function init(staticryptConfig, templateConfig)"), "staticryptJs init() is present");
    // After token replacement, no /*[|...|]*/0 placeholders remain.
    assert.ok(!/\/\*\[\|\s*\w+\s*\|]\*\/\s*0/.test(result), "no template tokens left after inlining");
});

test("isCustomPasswordTemplateDefault recognizes the default template path", () => {
    const defaultPath = path.join(__dirname, "..", "lib", "password_template.html");
    assert.equal(isCustomPasswordTemplateDefault(defaultPath), true);
    assert.equal(isCustomPasswordTemplateDefault("/some/other/template.html"), false);
});

test("getValidatedSalt prefers the --salt CLI flag over config and over generation", () => {
    const namedArgs = { salt: "abcd1234abcd1234abcd1234abcd1234" };
    const config = { salt: "ffff0000ffff0000ffff0000ffff0000" };
    assert.equal(getValidatedSalt(namedArgs, config), "abcd1234abcd1234abcd1234abcd1234");
});

test("getValidatedSalt falls back to config salt when no flag", () => {
    const config = { salt: "ffff0000ffff0000ffff0000ffff0000" };
    assert.equal(getValidatedSalt({}, config), "ffff0000ffff0000ffff0000ffff0000");
});

test("getValidatedSalt lowercases the --salt CLI flag", () => {
    const namedArgs = { salt: "ABCD1234ABCD1234ABCD1234ABCD1234" };
    assert.equal(getValidatedSalt(namedArgs, {}), "abcd1234abcd1234abcd1234abcd1234");
});
