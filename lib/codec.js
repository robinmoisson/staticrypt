/**
 * Initialize the codec with the provided cryptoEngine - this return functions to encode and decode messages.
 *
 * @param cryptoEngine - the engine to use for encryption / decryption
 */
function init(cryptoEngine) {
  const exports = {};

  /**
   * Top-level function for encoding a message.
   * Includes password hashing, encryption, and signing.
   *
   * @param {string} msg
   * @param {string} password
   * @param {string} salt
   *
   * @returns {string} The encoded text
   */
  async function encode(msg, password, salt) {
    const hashedPassphrase = await cryptoEngine.hashPassphrase(password, salt);


    const encrypted = await cryptoEngine.encrypt(msg, hashedPassphrase);
    // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
    // it in localStorage safely, we don't use the clear text password)
    const hmac = await cryptoEngine.signMessage(hashedPassphrase, encrypted);

    return hmac + encrypted;
  }
  exports.encode = encode;

  /**
   * Top-level function for decoding a message.
   * Includes signature check and decryption.
   *
   * @param {string} signedMsg
   * @param {string} hashedPassphrase
   * @param {string} salt
   * @param {int} backwardCompatibleAttempt
   * @param {string} originalPassphrase
   *
   * @returns {Object} {success: true, decoded: string} | {success: false, message: string}
   */
  async function decode(
      signedMsg,
      hashedPassphrase,
      salt,
      backwardCompatibleAttempt = 0,
      originalPassphrase = ''
  ) {
    const encryptedHMAC = signedMsg.substring(0, 64);
    const encryptedMsg = signedMsg.substring(64);
    const decryptedHMAC = await cryptoEngine.signMessage(hashedPassphrase, encryptedMsg);

    if (decryptedHMAC !== encryptedHMAC) {
      // we have been raising the number of iterations in the hashing algorithm multiple times, so to support the old
      // remember-me/autodecrypt links we need to try bringing the old hashes up to speed.
      originalPassphrase = originalPassphrase || hashedPassphrase;
      if (backwardCompatibleAttempt === 0) {
        const updatedHashedPassphrase = await cryptoEngine.hashThirdRound(originalPassphrase, salt);

        return decode(signedMsg, updatedHashedPassphrase, salt, backwardCompatibleAttempt + 1, originalPassphrase);
      }
      if (backwardCompatibleAttempt === 1) {
        let updatedHashedPassphrase = await cryptoEngine.hashSecondRound(originalPassphrase, salt);
        updatedHashedPassphrase = await cryptoEngine.hashThirdRound(updatedHashedPassphrase, salt);

        return decode(signedMsg, updatedHashedPassphrase, salt, backwardCompatibleAttempt + 1, originalPassphrase);
      }

      return { success: false, message: "Signature mismatch" };
    }

    return {
      success: true,
      decoded: await cryptoEngine.decrypt(encryptedMsg, hashedPassphrase),
    };
  }
  exports.decode = decode;

  return exports;
}
exports.init = init;
