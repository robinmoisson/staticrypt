const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cryptoEngine = require("../lib/cryptoEngine.js");

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "encrypted-blobs", "basic.json"), "utf8"));

test("HexEncoder round-trips arbitrary bytes (via encrypt/decrypt path)", async () => {
    // HexEncoder isn't exported directly; we exercise it through encrypt/decrypt.
    const cipher = await cryptoEngine.encrypt("abc", FIXTURE.hashFull);
    const plain = await cryptoEngine.decrypt(cipher, FIXTURE.hashFull);
    assert.equal(plain, "abc");
});

test("encrypt produces fresh ciphertext each call (random IV) but always decrypts", async () => {
    const a = await cryptoEngine.encrypt("same input", FIXTURE.hashFull);
    const b = await cryptoEngine.encrypt("same input", FIXTURE.hashFull);
    assert.notEqual(a, b, "two encryptions of the same input must differ (random IV)");
    assert.equal(await cryptoEngine.decrypt(a, FIXTURE.hashFull), "same input");
    assert.equal(await cryptoEngine.decrypt(b, FIXTURE.hashFull), "same input");
});

test("encrypt output starts with 32 hex chars of IV", async () => {
    const cipher = await cryptoEngine.encrypt("x", FIXTURE.hashFull);
    assert.match(cipher.slice(0, 32), /^[0-9a-f]{32}$/);
});

test("hashLegacyRound matches pinned fixture (1000 iters SHA-1)", async () => {
    const hash = await cryptoEngine.hashLegacyRound(FIXTURE.password, FIXTURE.salt);
    assert.equal(hash, FIXTURE.hashLegacyOnly);
});

test("hashSecondRound matches pinned fixture (14000 iters SHA-256 on top of legacy)", async () => {
    const hash = await cryptoEngine.hashSecondRound(FIXTURE.hashLegacyOnly, FIXTURE.salt);
    assert.equal(hash, FIXTURE.hashLegacyAndSecond);
});

test("hashThirdRound matches pinned fixture (585000 iters SHA-256 on top of 2nd)", async () => {
    const hash = await cryptoEngine.hashThirdRound(FIXTURE.hashLegacyAndSecond, FIXTURE.salt);
    assert.equal(hash, FIXTURE.hashFull);
});

test("hashPassword full chain matches the manual composition", async () => {
    const hash = await cryptoEngine.hashPassword(FIXTURE.password, FIXTURE.salt);
    assert.equal(hash, FIXTURE.hashFull);
});

test("hashPassword output is 64 hex chars (256-bit key)", async () => {
    const hash = await cryptoEngine.hashPassword("other", FIXTURE.salt);
    assert.match(hash, /^[0-9a-f]{64}$/);
});

test("generateRandomSalt returns 32 hex chars", () => {
    const salt = cryptoEngine.generateRandomSalt();
    assert.match(salt, /^[0-9a-f]{32}$/);
});

test("generateRandomSalt returns different values across calls", () => {
    assert.notEqual(cryptoEngine.generateRandomSalt(), cryptoEngine.generateRandomSalt());
});

test("generateRandomString returns the requested length of alphanums", () => {
    const s = cryptoEngine.generateRandomString(21);
    assert.equal(s.length, 21);
    assert.match(s, /^[A-Za-z0-9]{21}$/);
});

test("signMessage is deterministic for the same inputs", async () => {
    const a = await cryptoEngine.signMessage(FIXTURE.hashFull, "message");
    const b = await cryptoEngine.signMessage(FIXTURE.hashFull, "message");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/); // HMAC-SHA-256 = 32 bytes = 64 hex
});

test("signMessage changes with a single-bit message change", async () => {
    const a = await cryptoEngine.signMessage(FIXTURE.hashFull, "message");
    const b = await cryptoEngine.signMessage(FIXTURE.hashFull, "messagf");
    assert.notEqual(a, b);
});

test("decrypt throws on tampered ciphertext", async () => {
    const cipher = await cryptoEngine.encrypt("abc", FIXTURE.hashFull);
    // flip a hex digit in the ciphertext portion (after the 32-char IV)
    const tampered = cipher.slice(0, 32) + (cipher[32] === "0" ? "1" : "0") + cipher.slice(33);
    await assert.rejects(() => cryptoEngine.decrypt(tampered, FIXTURE.hashFull));
});
