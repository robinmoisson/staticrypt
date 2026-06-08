const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js").init(cryptoEngine);

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "encrypted-blobs", "basic.json"), "utf8"));

test("encode + decode round-trip with raw password", async () => {
    const encoded = await codec.encode("secret content", FIXTURE.password, FIXTURE.salt);
    const result = await codec.decode(encoded, FIXTURE.hashFull, FIXTURE.salt);
    assert.equal(result.success, true);
    assert.equal(result.decoded, "secret content");
});

test("encodeWithHashedPassword + decode round-trip", async () => {
    const encoded = await codec.encodeWithHashedPassword("hello", FIXTURE.hashFull);
    const result = await codec.decode(encoded, FIXTURE.hashFull, FIXTURE.salt);
    assert.equal(result.success, true);
    assert.equal(result.decoded, "hello");
});

test("decode of the committed fixture succeeds with the full hash", async () => {
    const result = await codec.decode(FIXTURE.encrypted, FIXTURE.hashFull, FIXTURE.salt);
    assert.equal(result.success, true);
    assert.equal(result.decoded, FIXTURE.plaintext);
});

test("decode fails on tampered HMAC", async () => {
    const encoded = await codec.encodeWithHashedPassword("hello", FIXTURE.hashFull);
    // flip a bit in the HMAC (first 64 chars)
    const tampered = (encoded[0] === "0" ? "1" : "0") + encoded.slice(1);
    const result = await codec.decode(tampered, FIXTURE.hashFull, FIXTURE.salt);
    assert.equal(result.success, false);
    assert.equal(result.message, "Signature mismatch");
});

test("decode fails on tampered ciphertext (HMAC catches it)", async () => {
    const encoded = await codec.encodeWithHashedPassword("hello", FIXTURE.hashFull);
    // flip a hex digit somewhere in the IV+ciphertext part (after the 64-char HMAC)
    const i = 70;
    const tampered = encoded.slice(0, i) + (encoded[i] === "0" ? "1" : "0") + encoded.slice(i + 1);
    const result = await codec.decode(tampered, FIXTURE.hashFull, FIXTURE.salt);
    assert.equal(result.success, false);
    assert.equal(result.message, "Signature mismatch");
});

test("wire format: encoded string = 64 hex HMAC + 32 hex IV + ciphertext", async () => {
    const encoded = await codec.encodeWithHashedPassword("xyz", FIXTURE.hashFull);
    assert.match(encoded.slice(0, 64), /^[0-9a-f]{64}$/, "HMAC prefix is 64 hex chars");
    assert.match(encoded.slice(64, 96), /^[0-9a-f]{32}$/, "IV is the next 32 hex chars");
    assert.match(encoded.slice(96), /^[0-9a-f]+$/, "ciphertext is hex");
});
