const CryptoJS = require("crypto-js");

var IV_BITS = 16 * 8;
var HEX_BITS = 4;

/**
 * Salt and encrypt a msg with a password.
 * Inspired by https://github.com/adonespitogo
 */
function encrypt(msg, hashedPassphrase) {
  var iv = CryptoJS.lib.WordArray.random(IV_BITS / 8);

  var encrypted = CryptoJS.AES.encrypt(msg, hashedPassphrase, {
    iv: iv,
    padding: CryptoJS.pad.Pkcs7,
    mode: CryptoJS.mode.CBC,
  });

  // iv will be hex 16 in length (32 characters)
  // we prepend it to the ciphertext for use in decryption
  var encoded = iv.toString() + encrypted.toString();
  return Promise.resolve(encoded);
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
function decrypt(encryptedMsg, hashedPassphrase) {
  var ivLength = IV_BITS / HEX_BITS;
  var iv = CryptoJS.enc.Hex.parse(encryptedMsg.substr(0, ivLength));
  var encrypted = encryptedMsg.substring(ivLength);

  const decrypted = CryptoJS.AES.decrypt(encrypted, hashedPassphrase, {
    iv: iv,
    padding: CryptoJS.pad.Pkcs7,
    mode: CryptoJS.mode.CBC,
  }).toString(CryptoJS.enc.Utf8);

  return Promise.resolve(decrypted);
}
exports.decrypt = decrypt;

/**
 * Salt and hash the passphrase so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {string} passphrase
 * @param {string} salt
 * @returns string
 */
function hashPassphrase(passphrase, salt) {
  var hashedPassphrase = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations: 1000,
  });

  return Promise.resolve(hashedPassphrase.toString());
}
exports.hashPassphrase = hashPassphrase;

function generateRandomSalt() {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
}
exports.generateRandomSalt = generateRandomSalt;

function signMessage(hashedPassphrase, message) {
  const signature = CryptoJS.HmacSHA256(
    message,
    CryptoJS.SHA256(hashedPassphrase).toString()
  ).toString();
  return Promise.resolve(signature);
}
exports.signMessage = signMessage;
