const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js").init(cryptoEngine);

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "encrypted-blobs", "basic.json"), "utf8"));

test("decode succeeds with fully hashed password (no retry needed)", async () => {
    const result = await codec.decode(FIXTURE.encrypted, FIXTURE.hashFull, FIXTURE.salt);
    assert.equal(result.success, true);
    assert.equal(result.decoded, FIXTURE.plaintext);
});

test("backward-compat: decode succeeds with hashLegacyAndSecond (attempt 0 applies hashThirdRound)", async () => {
    // Simulates an old localStorage token that was hashed with 1000 + 14000 iters but not the final 585k.
    const result = await codec.decode(FIXTURE.encrypted, FIXTURE.hashLegacyAndSecond, FIXTURE.salt);
    assert.equal(result.success, true);
    assert.equal(result.decoded, FIXTURE.plaintext);
});

test("backward-compat: decode succeeds with hashLegacyOnly (attempt 1 applies hashSecondRound + hashThirdRound)", async () => {
    // Simulates a very old token that was hashed with only the original 1000 iters SHA-1.
    const result = await codec.decode(FIXTURE.encrypted, FIXTURE.hashLegacyOnly, FIXTURE.salt);
    assert.equal(result.success, true);
    assert.equal(result.decoded, FIXTURE.plaintext);
});

test("backward-compat: decode fails after both retry attempts with wrong password", async () => {
    // A completely wrong hash should fail even after the retry chain.
    const wrong = "0".repeat(64);
    const result = await codec.decode(FIXTURE.encrypted, wrong, FIXTURE.salt);
    assert.equal(result.success, false);
    assert.equal(result.message, "Signature mismatch");
});
