const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js").init(cryptoEngine);
const { buildStaticryptJS } = require("../cli/helpers.js");
const { buildWindow } = require("./setup/jsdomEnv.js");

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "encrypted-blobs", "basic.json"), "utf8"));

const STATICRYPT_JS_SOURCE = buildStaticryptJS();

// Standard templateConfig matching what's hardcoded in lib/password_template.html.
const TEMPLATE_CONFIG_LITERAL = `{
    rememberExpirationKey: "staticrypt_expiration",
    rememberPassphraseKey: "staticrypt_passphrase",
    replaceHtmlCallback: (html) => { window.__replacedWith = html; },
    clearLocalStorageCallback: undefined
}`;

/**
 * Build a fresh jsdom window with the staticrypt runtime evaluated in it,
 * exposing `window.staticrypt` (the init() result) and `window.__replacedWith`
 * (whatever the page would have been replaced with).
 */
function bootStaticrypt(staticryptConfig, url) {
    const window = buildWindow("<!DOCTYPE html><html><body></body></html>", url);
    const initScript = `
        const staticryptModuleExports = ${STATICRYPT_JS_SOURCE};
        window.staticrypt = staticryptModuleExports.init(
            ${JSON.stringify(staticryptConfig)},
            ${TEMPLATE_CONFIG_LITERAL}
        );
    `;
    window.eval(initScript);
    return window;
}

const STD_CONFIG = {
    staticryptEncryptedMsgUniqueVariableName: FIXTURE.encrypted,
    staticryptSaltUniqueVariableName: FIXTURE.salt,
    isRememberEnabled: true,
    rememberDurationInDays: 30,
};

test("init exposes handleDecryptionOfPage, handleDecryptionOfPageFromHash, handleDecryptOnLoad", () => {
    const window = bootStaticrypt(STD_CONFIG, "https://example.com/");
    assert.equal(typeof window.staticrypt.handleDecryptionOfPage, "function");
    assert.equal(typeof window.staticrypt.handleDecryptionOfPageFromHash, "function");
    assert.equal(typeof window.staticrypt.handleDecryptOnLoad, "function");
});

test("correct password decrypts and triggers replaceHtmlCallback with plaintext", async () => {
    const window = bootStaticrypt(STD_CONFIG, "https://example.com/");
    const result = await window.staticrypt.handleDecryptionOfPage(FIXTURE.password, false);
    assert.equal(result.isSuccessful, true);
    assert.equal(window.__replacedWith, FIXTURE.plaintext);
});

test("wrong password returns isSuccessful=false and does NOT replace HTML", async () => {
    const window = bootStaticrypt(STD_CONFIG, "https://example.com/");
    const result = await window.staticrypt.handleDecryptionOfPage("wrong-password", false);
    assert.equal(result.isSuccessful, false);
    assert.equal(window.__replacedWith, undefined);
});

test("remember-me writes hashedPassword + expiration to localStorage under documented keys", async () => {
    const window = bootStaticrypt(STD_CONFIG, "https://example.com/");
    await window.staticrypt.handleDecryptionOfPage(FIXTURE.password, true);
    assert.equal(window.localStorage.getItem("staticrypt_passphrase"), FIXTURE.hashFull);
    const exp = parseInt(window.localStorage.getItem("staticrypt_expiration"), 10);
    assert.ok(Number.isFinite(exp), "expiration is a finite integer");
    assert.ok(exp > Date.now(), "expiration is in the future");
});

test("handleDecryptOnLoad: remember-me path decrypts on revisit when localStorage has the hash", async () => {
    // First visit: prime localStorage.
    const w1 = bootStaticrypt(STD_CONFIG, "https://example.com/");
    await w1.staticrypt.handleDecryptionOfPage(FIXTURE.password, true);
    const storedHash = w1.localStorage.getItem("staticrypt_passphrase");
    const storedExp = w1.localStorage.getItem("staticrypt_expiration");

    // Second visit: new window, prime localStorage with the values, then call handleDecryptOnLoad.
    const w2 = bootStaticrypt(STD_CONFIG, "https://example.com/");
    w2.localStorage.setItem("staticrypt_passphrase", storedHash);
    w2.localStorage.setItem("staticrypt_expiration", storedExp);
    const { isSuccessful } = await w2.staticrypt.handleDecryptOnLoad();
    assert.equal(isSuccessful, true);
    assert.equal(w2.__replacedWith, FIXTURE.plaintext);
});

test("handleDecryptOnLoad: expired remember-me clears localStorage and does NOT decrypt", async () => {
    const window = bootStaticrypt(STD_CONFIG, "https://example.com/");
    window.localStorage.setItem("staticrypt_passphrase", FIXTURE.hashFull);
    window.localStorage.setItem("staticrypt_expiration", "1"); // long expired
    const { isSuccessful } = await window.staticrypt.handleDecryptOnLoad();
    assert.equal(isSuccessful, false);
    assert.equal(window.localStorage.getItem("staticrypt_passphrase"), null);
    assert.equal(window.localStorage.getItem("staticrypt_expiration"), null);
});

test("handleDecryptOnLoad: URL fragment #staticrypt_pwd=<hash> auto-decrypts", async () => {
    const window = bootStaticrypt(STD_CONFIG, `https://example.com/#staticrypt_pwd=${FIXTURE.hashFull}`);
    const { isSuccessful } = await window.staticrypt.handleDecryptOnLoad();
    // decryptOnLoadFromUrl returns the full handleDecryptionOfPageFromHash result object (truthy on success)
    assert.ok(isSuccessful, "expected isSuccessful to be truthy");
    assert.equal(window.__replacedWith, FIXTURE.plaintext);
});

test("handleDecryptOnLoad: legacy query param ?staticrypt_pwd=<hash> auto-decrypts", async () => {
    const window = bootStaticrypt(STD_CONFIG, `https://example.com/?staticrypt_pwd=${FIXTURE.hashFull}`);
    const { isSuccessful } = await window.staticrypt.handleDecryptOnLoad();
    // decryptOnLoadFromUrl returns the full handleDecryptionOfPageFromHash result object (truthy on success)
    assert.ok(isSuccessful, "expected isSuccessful to be truthy");
    assert.equal(window.__replacedWith, FIXTURE.plaintext);
});

test("logout via ?staticrypt_logout clears localStorage and skips decrypt", async () => {
    const window = bootStaticrypt(STD_CONFIG, "https://example.com/?staticrypt_logout");
    window.localStorage.setItem("staticrypt_passphrase", FIXTURE.hashFull);
    window.localStorage.setItem("staticrypt_expiration", String(Date.now() + 1_000_000));
    const { isSuccessful } = await window.staticrypt.handleDecryptOnLoad();
    assert.equal(isSuccessful, false);
    assert.equal(window.localStorage.getItem("staticrypt_passphrase"), null);
});
