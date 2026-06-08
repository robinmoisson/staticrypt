// Regenerates committed fixtures in test/fixtures/encrypted-blobs/.
// Run by hand: `node test/fixtures/generate.js`.
// CI does NOT run this; it consumes the committed JSON output.

const fs = require("fs");
const path = require("path");
const cryptoEngine = require("../../lib/cryptoEngine.js");
const codec = require("../../lib/codec.js").init(cryptoEngine);

const OUT_DIR = path.join(__dirname, "encrypted-blobs");

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Fixed inputs — chosen for readability and to cover non-ASCII.
    const password = "testpassword123";
    const salt = "abcd1234abcd1234abcd1234abcd1234";
    const plaintext = "Hello, world! héllo wörld";

    // Compute every intermediate hash so the compat tests can exercise each retry branch.
    const hashLegacyOnly = await cryptoEngine.hashLegacyRound(password, salt);
    const hashLegacyAndSecond = await cryptoEngine.hashSecondRound(hashLegacyOnly, salt);
    const hashFull = await cryptoEngine.hashThirdRound(hashLegacyAndSecond, salt);

    // Sanity: hashFull must equal the public hashPassword() output.
    const hashFullViaPublic = await cryptoEngine.hashPassword(password, salt);
    if (hashFull !== hashFullViaPublic) {
        throw new Error("hashPassword() drifted from manual 3-round chain");
    }

    // Encode with the fully hashed password — this is what's stored in real pages.
    const encrypted = await codec.encodeWithHashedPassword(plaintext, hashFull);

    const fixture = {
        plaintext,
        password,
        salt,
        hashLegacyOnly,
        hashLegacyAndSecond,
        hashFull,
        encrypted,
    };

    fs.writeFileSync(path.join(OUT_DIR, "basic.json"), JSON.stringify(fixture, null, 2) + "\n");
    console.log("Wrote", path.join(OUT_DIR, "basic.json"));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
