const isNode = typeof window === "undefined";
const crypto = isNode ? require("node:crypto").webcrypto : window.crypto;
const { subtle } = crypto;

const IV_BITS = 16 * 8;
const ENCRYPTION_ALGO = "AES-CBC";

/**
 * Compare 2 arrays and return true if they are equal.
 *
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
function isArrayEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}
exports.isArrayEqual = isArrayEqual;

/**
 * Translates between utf8 encoded hexadecimal strings
 * and Uint8Array.
 */
const HexEncoder = isNode
    ? {
          // Node version

          /**
           * hex string -> Uint8Array
           * @param {string|null} hexString
           * @returns {Uint8Array|null}
           */
          parse: function (hexString) {
              const bytes = Buffer.from(hexString, "hex");
              return bytes;
          },

          /**
           * Uint8Array -> hex string
           * @param {Uint8Array|null} bytes
           * @returns {string|null}
           */
          stringify: function (bytes) {
              const buffer = Buffer.from(bytes);
              const hexString = buffer.toString("hex");

              return hexString;
          },
      }
    : {
          // Browser version

          /**
           * hex string -> Uint8Array
           * @param {string} hexString
           * @returns {Uint8Array}
           */
          parse: function (hexString) {
              if (!hexString) {
                  return null;
              }

              if (hexString.length % 2 !== 0) {
                  throw new Error("Invalid hex string length");
              }

              const bytes = new Uint8Array(hexString.length / 2);

              for (let i = 0; i < hexString.length; i += 2) {
                  const byte = parseInt(hexString.substring(i, i + 2), 16);
                  if (isNaN(byte)) {
                      throw new Error("Invalid character in hex string.");
                  }
                  bytes[i / 2] = byte;
              }

              return bytes;
          },

          /**
           * Uint8Array -> hex string
           * @param {Uint8Array} bytes
           * @returns {string}
           */
          stringify: function (bytes) {
              if (!bytes) {
                  return null;
              }

              return Array.from(bytes)
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join("");
          },
      };
exports.HexEncoder = HexEncoder;

/**
 * Translates between utf8 string and Uint8Array.
 */
const UTF8Encoder = {
    /**
     * string -> Uint8Array
     * @param {string|null} str
     * @returns {Uint8Array|null}
     */
    parse: function (str) {
        if (!str) {
            return null;
        }
        return new TextEncoder().encode(str);
    },

    /**
     * Uint8Array -> string
     * @param {Uint8Array|null} bytes
     * @returns {string|null}
     */
    stringify: function (bytes) {
        if (!bytes) {
            return null;
        }
        return new TextDecoder().decode(bytes);
    },
};
exports.UTF8Encoder = UTF8Encoder;

/**
 * Salt and encrypt a msg with a password.
 *
 * @param {Uint8Array} msg
 * @param {Uint8Array} hashedPassword
 *
 * @returns { Promise<{iv: Uint8Array, encrypted: Uint8Array}> }
 */
async function encrypt(msg, hashedPassword) {
    // Must be 16 bytes, unpredictable, and preferably cryptographically random. However, it need not be secret.
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#parameters

    const iv = crypto.getRandomValues(new Uint8Array(IV_BITS / 8));

    const key = await subtle.importKey("raw", hashedPassword, ENCRYPTION_ALGO, false, ["encrypt"]);

    const encrypted = await subtle.encrypt(
        {
            name: ENCRYPTION_ALGO,
            iv: iv,
        },
        key,
        msg
    );

    // return iv with the ciphertext for use in decryption
    return {
        iv: iv,
        encrypted: new Uint8Array(encrypted),
    };
}
exports.encrypt = encrypt;

/**
 * Decrypt a salted msg using a password.
 *
 * @param {Uint8Array} iv
 * @param {Uint8Array} encrypted
 * @param {Uint8Array} hashedPassword
 * @returns { Promise<Uint8Array> }
 */
async function decrypt(iv, encrypted, hashedPassword) {
    const key = await subtle.importKey("raw", hashedPassword, ENCRYPTION_ALGO, false, ["decrypt"]);

    const decryptedBuffer = await subtle.decrypt(
        {
            name: ENCRYPTION_ALGO,
            iv: iv,
        },
        key,
        encrypted
    );

    return new Uint8Array(decryptedBuffer);
}
exports.decrypt = decrypt;

/**
 * Salt and hash the password so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {Uint8Array} password
 * @param {Uint8Array} salt
 * @returns { Promise<Uint8Array> }
 */
async function hashPassword(password, salt) {
    // we hash the password in multiple steps, each adding more iterations. This is because we used to allow less
    // iterations, so for backward compatibility reasons, we need to support going from that to more iterations.
    let hashedPassword = await hashLegacyRound(password, salt);

    hashedPassword = await hashSecondRound(hashedPassword, salt);

    return hashThirdRound(hashedPassword, salt);
}
exports.hashPassword = hashPassword;

/**
 * This hashes the password with 1k iterations. This is a low number, we need this function to support backwards
 * compatibility.
 *
 * @param {Uint8Array} password
 * @param {Uint8Array} salt
 * @returns { Promise<Uint8Array> }
 */
async function hashLegacyRound(password, salt) {
    return await pbkdf2(password, salt, 1000, "SHA-1");
}
exports.hashLegacyRound = hashLegacyRound;

/**
 * Add a second round of iterations. This is because we used to use 1k, so for backwards compatibility with
 * remember-me/autodecrypt links, we need to support going from that to more iterations.
 *
 * @param {Uint8Array} hashedPassword
 * @param {Uint8Array} salt
 * @returns { Promise<Uint8Array> }
 */
async function hashSecondRound(hashedPassword, salt) {
    return await pbkdf2(hashedPassword, salt, 14000, "SHA-256");
}
exports.hashSecondRound = hashSecondRound;

/**
 * Add a third round of iterations to bring total number to 600k. This is because we used to use 1k, then 15k, so for
 * backwards compatibility with remember-me/autodecrypt links, we need to support going from that to more iterations.
 *
 * @param {Uint8Array} hashedPassword
 * @param {Uint8Array} salt
 * @returns { Promise<Uint8Array> }
 */
async function hashThirdRound(hashedPassword, salt) {
    return await pbkdf2(hashedPassword, salt, 585000, "SHA-256");
}
exports.hashThirdRound = hashThirdRound;

/**
 * Salt and hash the password so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {Uint8Array} password
 * @param {Uint8Array} salt
 * @param {int} iterations
 * @param {string} hashAlgorithm
 * @returns { Promise<Uint8Array> }
 */
async function pbkdf2(password, salt, iterations, hashAlgorithm) {
    const key = await subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);

    const derivedKey = await subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: hashAlgorithm,
            iterations,
            salt: salt,
        },
        key,
        256
    );

    return new Uint8Array(derivedKey);
}

function generateRandomSaltString() {
    const bytes = crypto.getRandomValues(new Uint8Array(128 / 8));

    return HexEncoder.stringify(new Uint8Array(bytes));
}
exports.generateRandomSaltString = generateRandomSaltString;

async function signMessage(hashedPassword, message) {
    const key = await subtle.importKey(
        "raw",
        hashedPassword,
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign"]
    );
    const signature = await subtle.sign("HMAC", key, message);

    return new Uint8Array(signature);
}
exports.signMessage = signMessage;

async function digestMessage(message) {
    const digest = await subtle.digest("SHA-256", message);
    const digestBytes = new Uint8Array(digest);
    return digestBytes;
}
exports.digestMessage = digestMessage;

function getRandomAlphanum() {
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let byteArray;
    let parsedInt;

    // Keep generating new random bytes until we get a value that falls
    // within a range that can be evenly divided by possibleCharacters.length
    // to ensure each character is selected without bias
    do {
        byteArray = crypto.getRandomValues(new Uint8Array(1));
        // extract the lowest byte to get an int from 0 to 255 (probably unnecessary, since we're only generating 1 byte)
        parsedInt = byteArray[0] & 0xff;
    } while (parsedInt >= 256 - (256 % possibleCharacters.length));

    // Take the modulo of the parsed integer to get a random number between 0 and totalLength - 1
    const randomIndex = parsedInt % possibleCharacters.length;

    return possibleCharacters[randomIndex];
}

/**
 * Generate a random string of a given length.
 *
 * @param {int} length
 * @returns {string}
 */
function generateRandomString(length) {
    let randomString = "";

    for (let i = 0; i < length; i++) {
        randomString += getRandomAlphanum();
    }

    return randomString;
}
exports.generateRandomString = generateRandomString;
