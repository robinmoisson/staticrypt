const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js").init(cryptoEngine);

const CLI = path.join(__dirname, "..", "cli", "index.js");
const PASSWORD = "longenoughtestpassword123";
const SALT = "abcd1234abcd1234abcd1234abcd1234";

function mkTmp() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "staticrypt-e2e-"));
}

test("CLI encrypts an HTML file producing the expected wire-format payload", async () => {
    const tmp = mkTmp();
    const input = path.join(tmp, "input.html");
    fs.writeFileSync(input, "<h1>secret</h1>");

    const outDir = path.join(tmp, "encrypted");
    const result = spawnSync(
        "node",
        [CLI, input, "-p", PASSWORD, "--salt", SALT, "--short", "-d", outDir, "-c", "false"],
        { encoding: "utf8" }
    );
    assert.equal(result.status, 0, `CLI exited non-zero. stderr: ${result.stderr}\nstdout: ${result.stdout}`);

    const output = fs.readFileSync(path.join(outDir, "input.html"), "utf8");

    // Extract the encrypted payload and salt from the output HTML.
    const cipherMatch = output.match(/"staticryptEncryptedMsgUniqueVariableName":\s*"([^"]+)"/);
    const saltMatch = output.match(/"staticryptSaltUniqueVariableName":\s*"([^"]+)"/);
    assert.ok(cipherMatch, "output contains the encrypted message");
    assert.ok(saltMatch, "output contains the salt");
    assert.equal(saltMatch[1], SALT);

    // Verify the wire format & round-trip via the lib.
    assert.match(cipherMatch[1].slice(0, 64), /^[0-9a-f]{64}$/, "first 64 chars are HMAC hex");
    assert.match(cipherMatch[1].slice(64, 96), /^[0-9a-f]{32}$/, "next 32 chars are IV hex");

    const hashed = await cryptoEngine.hashPassword(PASSWORD, SALT);
    const decoded = await codec.decode(cipherMatch[1], hashed, SALT);
    assert.equal(decoded.success, true);
    assert.equal(decoded.decoded, "<h1>secret</h1>");

    fs.rmSync(tmp, { recursive: true, force: true });
});

test("CLI --decrypt reverses an encrypted file back to the original plaintext", () => {
    const tmp = mkTmp();
    const input = path.join(tmp, "input.html");
    fs.writeFileSync(input, "<p>original content</p>");

    const encDir = path.join(tmp, "enc");
    const encResult = spawnSync(
        "node",
        [CLI, input, "-p", PASSWORD, "--salt", SALT, "--short", "-d", encDir, "-c", "false"],
        { encoding: "utf8" }
    );
    assert.equal(encResult.status, 0, `encrypt step failed: ${encResult.stderr}`);

    const decDir = path.join(tmp, "dec");
    const decResult = spawnSync(
        "node",
        [
            CLI,
            path.join(encDir, "input.html"),
            "-p",
            PASSWORD,
            "--salt",
            SALT,
            "--decrypt",
            "-d",
            decDir,
            "-c",
            "false",
        ],
        { encoding: "utf8" }
    );
    assert.equal(decResult.status, 0, `decrypt step failed: ${decResult.stderr}`);

    const decrypted = fs.readFileSync(path.join(decDir, "input.html"), "utf8");
    assert.equal(decrypted, "<p>original content</p>");

    fs.rmSync(tmp, { recursive: true, force: true });
});

test("CLI rejects an invalid salt", () => {
    const tmp = mkTmp();
    const input = path.join(tmp, "input.html");
    fs.writeFileSync(input, "<p>x</p>");

    const result = spawnSync(
        "node",
        [CLI, input, "-p", PASSWORD, "--salt", "not-32-hex-chars", "--short", "-c", "false"],
        { encoding: "utf8" }
    );
    assert.notEqual(result.status, 0, "CLI must exit non-zero on invalid salt");
    assert.match(result.stdout + result.stderr, /salt/i);

    fs.rmSync(tmp, { recursive: true, force: true });
});
