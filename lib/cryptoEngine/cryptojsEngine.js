const CryptoJS = require("crypto-js");

/**
 * Salt and encrypt a msg with a password.
 * Inspired by https://github.com/adonespitogo
 */
function encrypt(msg, hashedPassphrase) {
  var iv = CryptoJS.lib.WordArray.random(128 / 8);

  var encrypted = CryptoJS.AES.encrypt(msg, hashedPassphrase, {
    iv: iv,
    padding: CryptoJS.pad.Pkcs7,
    mode: CryptoJS.mode.CBC,
  });

  // iv will be hex 16 in length (32 characters)
  // we prepend it to the ciphertext for use in decryption
  return iv.toString() + encrypted.toString();
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
  var iv = CryptoJS.enc.Hex.parse(encryptedMsg.substr(0, 32));
  var encrypted = encryptedMsg.substring(32);

  return CryptoJS.AES.decrypt(encrypted, hashedPassphrase, {
    iv: iv,
    padding: CryptoJS.pad.Pkcs7,
    mode: CryptoJS.mode.CBC,
  }).toString(CryptoJS.enc.Utf8);
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
  // we hash the passphrase in two steps: first 1k iterations, then we add iterations. This is because we used to use 1k,
  // so for backwards compatibility with remember-me/autodecrypt links, we need to support going from that to more
  // iterations
  var hashedPassphrase = hashLegacyRound(passphrase, salt);

  return hashSecondRound(hashedPassphrase, salt);
}
exports.hashPassphrase = hashPassphrase;

/**
 * This hashes the passphrase with 1k iterations. This is a low number, we need this function to support backwards
 * compatibility.
 *
 * @param {string} passphrase
 * @param {string} salt
 * @returns {string}
 */
function hashLegacyRound(passphrase, salt) {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString();
}
exports.hashLegacyRound = hashLegacyRound;

/**
 * Add a second round of iterations. This is because we used to use 1k, so for backwards compatibility with
 * remember-me/autodecrypt links, we need to support going from that to more iterations.
 *
 * @param hashedPassphrase
 * @param salt
 * @returns {string}
 */
function hashSecondRound(hashedPassphrase, salt) {
  return CryptoJS.PBKDF2(hashedPassphrase, salt, {
    keySize: 256 / 32,
    iterations: 14000,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
}
exports.hashSecondRound = hashSecondRound;

function generateRandomSalt() {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
}
exports.generateRandomSalt = generateRandomSalt;

function getRandomAlphanum() {
    var possibleCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    var byteArray;
    var parsedInt;

    // Keep generating new random bytes until we get a value that falls
    // within a range that can be evenly divided by possibleCharacters.length
    do {
        byteArray = CryptoJS.lib.WordArray.random(1);
        // extract the lowest byte to get an int from 0 to 255 (probably unnecessary, since we're only generating 1 byte)
        parsedInt = byteArray.words[0] & 0xff;
    } while (parsedInt >= 256 - (256 % possibleCharacters.length));

    // Take the modulo of the parsed integer to get a random number between 0 and totalLength - 1
    var randomIndex = parsedInt % possibleCharacters.length;

    return possibleCharacters[randomIndex];
}

/**
 * Generate a random string of a given length.
 *
 * @param {int} length
 * @returns {string}
 */
function generateRandomString(length) {
    var randomString = '';

    for (var i = 0; i < length; i++) {
      randomString += getRandomAlphanum();
    }

    return randomString;
}
exports.generateRandomString = generateRandomString;

function signMessage(hashedPassphrase, message) {
  return CryptoJS.HmacSHA256(
    message,
    CryptoJS.SHA256(hashedPassphrase).toString()
  ).toString();
}
exports.signMessage = signMessage;
