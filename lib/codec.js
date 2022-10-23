/**
 * This file includes functions shared across all crytography implementations in lib/
 * as well as cli and www clients.
 */
function init(impl) {
  const exports = {};
  /**
   * Top-level function for encoding a message.
   * Includes passphrase hashing, encryption, and signing.
   *
   * @param {string} msg
   * @param {string} passphase
   * @param {sting} salt
   * @returns {string} The encoded text
   */
  function encode(msg, passphrase, salt) {
    const hashedPassphrase = impl.hashPassphrase(passphrase, salt);
    const encrypted = impl.encrypt(msg, hashedPassphrase);
    // we use the hashed passphrase in the HMAC because this is effectively what will be used a passphrase (so we can store
    // it in localStorage safely, we don't use the clear text passphrase)
    const hmac = impl.signMessage(hashedPassphrase, encrypted);
    return hmac + encrypted;
  }
  exports.encode = encode;

  /**
   * Top-level function for decoding a message.
   * Includes signature check, an decryption.
   *
   * @param {*} encoded
   * @param {*} hashedPassphrase
   * @returns {Object} {success: true, decoded: string} | {succss: false, message: string}
   */
  function decode(signedMsg, hashedPassphrase) {
    const encryptedHMAC = signedMsg.substring(0, 64);
    const encryptedMsg = signedMsg.substring(64);
    const decryptedHMAC = impl.signMessage(hashedPassphrase, encryptedMsg);

    if (decryptedHMAC !== encryptedHMAC) {
      return { success: false, message: "Signature mismatch" };
    }
    return {
      success: true,
      decoded: impl.decrypt(encryptedMsg, hashedPassphrase),
    };
  }
  exports.decode = decode;

  return exports;
}
exports.init = init;

/**
 * Replace the placeholder tags (between '{tag}') in 'tpl' string with provided data.
 *
 * @param tpl
 * @param data
 * @returns string
 */
function render(tpl, data) {
  return tpl.replace(/{(.*?)}/g, function (_, key) {
    if (data && data[key] !== undefined) {
      return data[key];
    }

    return "";
  });
}
exports.render = render;
