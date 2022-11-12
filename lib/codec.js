/**
 * Initialize the codec with the provided cryptoEngine - this return functions to encode and decode messages.
 *
 * @param cryptoEngine - the engine to use for encryption / decryption
 */
function init(cryptoEngine) {
  const exports = {};
  /**
   * Top-level function for encoding a message.
   * Includes passphrase hashing, encryption, and signing.
   *
   * @param {string} msg
   * @param {string} passphrase
   * @param {string} salt
   *
   * @returns {string} The encoded text
   */
  function encode(msg, passphrase, salt) {
    const hashedPassphrase = cryptoEngine.hashPassphrase(passphrase, salt);
    const encrypted = cryptoEngine.encrypt(msg, hashedPassphrase);
    // we use the hashed passphrase in the HMAC because this is effectively what will be used a passphrase (so we can store
    // it in localStorage safely, we don't use the clear text passphrase)
    const hmac = cryptoEngine.signMessage(hashedPassphrase, encrypted);

    return hmac + encrypted;
  }
  exports.encode = encode;

  /**
   * Top-level function for decoding a message.
   * Includes signature check, an decryption.
   *
   * @param {string} signedMsg
   * @param {string} hashedPassphrase
   *
   * @returns {Object} {success: true, decoded: string} | {success: false, message: string}
   */
  function decode(signedMsg, hashedPassphrase) {
    const encryptedHMAC = signedMsg.substring(0, 64);
    const encryptedMsg = signedMsg.substring(64);
    const decryptedHMAC = cryptoEngine.signMessage(hashedPassphrase, encryptedMsg);

    if (decryptedHMAC !== encryptedHMAC) {
      return { success: false, message: "Signature mismatch" };
    }
    return {
      success: true,
      decoded: cryptoEngine.decrypt(encryptedMsg, hashedPassphrase),
    };
  }
  exports.decode = decode;

  return exports;
}
exports.init = init;
