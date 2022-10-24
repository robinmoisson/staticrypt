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
   * @returns {Promise<string>} The encoded text
   */
  function encode(msg, passphrase, salt) {
    return impl.hashPassphrase(passphrase, salt).then(function(hashedPassphrase) {
      return impl.encrypt(msg, hashedPassphrase).then(function(encrypted) {
        return impl.signMessage(hashedPassphrase, encrypted).then(function(hmac) {
          // we use the hashed passphrase in the HMAC because this is effectively what will be used a passphrase (so we can store
          // it in localStorage safely, we don't use the clear text passphrase)
          return hmac + encrypted;
        });
      });
    });
  }
  exports.encode = encode;

  /**
   * Top-level function for decoding a message.
   * Includes signature check, an decryption.
   *
   * @param {*} encoded
   * @param {*} hashedPassphrase
   * @returns {Promise<Object>} {success: true, decoded: string} | {succss: false, message: string}
   */
  function decode(signedMsg, hashedPassphrase) {
    const encryptedHMAC = signedMsg.substring(0, 64);
    const encryptedMsg = signedMsg.substring(64);
    return impl.signMessage(hashedPassphrase, encryptedMsg).then(function(decryptedHMAC) {
      if (decryptedHMAC !== encryptedHMAC) {
        return { success: false, message: "Signature mismatch" };
      }
      return impl.decrypt(encryptedMsg, hashedPassphrase).then(function(decoded) {
        return {
          success: true,
          decoded: decoded,
        };
      });
    });
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
