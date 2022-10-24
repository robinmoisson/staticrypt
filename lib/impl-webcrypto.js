const { webcrypto: crypto } = require("crypto");
const { stringify } = require("querystring");
const { StringDecoder } = require("string_decoder");
const { subtle } = crypto;

const IV_BITS = 16 * 8;
const HEX_BITS = 4;
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#parameters
const ENCRYPTION_ALGO = "AES-GCM";
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits#parameters

/**
 * Translates between utf8 encoded hexadecimal strings
 * and Uint8Array bytes.
 *
 * Mirrors the API of CryptoJS.enc.Hex
 */
const HexEncoder = {
  /**
   * hex string -> bytes
   * @param {string} hexString
   * @returns {Uint8Array}
   */
  parse: function (hexString) {
    if (hexString.length % 2 != 0) throw "Invalid hexString";
    var arrayBuffer = new Uint8Array(hexString.length / 2);

    for (var i = 0; i < hexString.length; i += 2) {
      var byteValue = parseInt(hexString.substr(i, 2), 16);
      if (byteValue == NaN) throw "Invalid hexString";
      arrayBuffer[i / 2] = byteValue;
    }
    return arrayBuffer;
  },

  /**
   * bytes -> hex string
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  stringify: function (bytes) {
    var hexBytes = [];

    for (var i = 0; i < bytes.length; ++i) {
      var byteString = bytes[i].toString(16);
      if (byteString.length < 2) byteString = "0" + byteString;
      hexBytes.push(byteString);
    }
    return hexBytes.join("");
  },
};

/**
 * Translates between utf8 strings and Uint8Array bytes.
 */
const UTF8Encoder = {
  parse: function (str) {
    return new TextEncoder("utf-8").encode(str);
  },

  stringify: function (bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  },
};

/**
 * Salt and encrypt a msg with a password.
 * Inspired by https://github.com/adonespitogo
 */
async function encrypt(msg, hashedPassphrase) {
  // Must be 16 bytes, unpredictable, and preferably cryptographically random. However, it need not be secret.
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#parameters
  const iv = crypto.getRandomValues(new Uint8Array(IV_BITS / 8));

  const key = await subtle.importKey(
    "raw",
    HexEncoder.parse(hashedPassphrase),
    ENCRYPTION_ALGO,
    false,
    ["encrypt"]
  );
  const encrypted = await subtle.encrypt(
    {
      name: ENCRYPTION_ALGO,
      iv: iv,
    },
    key,
    UTF8Encoder.parse(msg)
  );
  // iv will be 32 hex characters
  // we prepend it to the ciphertext for use in decryption
  return HexEncoder.stringify(iv) + 
    HexEncoder.stringify(new Uint8Array(encrypted));
}
exports.encrypt = encrypt;

/**
 * Decrypt a salted msg using a password.
 * Inspired by https://github.com/adonespitogo
 *
 * @param {string} encryptedMsg
 * @param {string} hashedPassphrase
 * @returns {string}
 */
async function decrypt(encryptedMsg, hashedPassphrase) {
  /// APHCURSOR
  const ivLength = IV_BITS / HEX_BITS;
  var iv = HexEncoder.parse(encryptedMsg.substr(0, ivLength));
  var encrypted = encryptedMsg.substring(ivLength);

  const key = await subtle.importKey(
    "raw",
    HexEncoder.parse(hashedPassphrase),
    ENCRYPTION_ALGO,
    false,
    ["decrypt"]
  );

  const outBuffer = await subtle.decrypt(
    {
      name: ENCRYPTION_ALGO,
      iv: iv,
    },
    key,
    HexEncoder.parse(encrypted)
  );

  return UTF8Encoder.stringify(new Uint8Array(outBuffer));
}
exports.decrypt = decrypt;

/**
 * Salt and hash the passphrase so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {string} passphrase
 * @param {string} salt
 * @returns string
 */
async function hashPassphrase(passphrase, salt) {
  const key = await subtle.importKey(
    "raw",
    UTF8Encoder.parse(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const keyBytes = await subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      // iterations: 10000,
      iterations: 10,
      salt: UTF8Encoder.parse(salt),
    },
    key,
    256
  );
  return HexEncoder.stringify(new Uint8Array(keyBytes));
}
exports.hashPassphrase = hashPassphrase;

function generateRandomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(128 / 8));
  return HexEncoder.stringify(new Uint8Array(bytes));
}
exports.generateRandomSalt = generateRandomSalt;

async function signMessage(hashedPassphrase, message) {
  const key = await subtle.importKey(
    "raw",
    HexEncoder.parse(hashedPassphrase),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, UTF8Encoder.parse(message));

  return HexEncoder.stringify(new Uint8Array(signature));
}
exports.signMessage = signMessage;
