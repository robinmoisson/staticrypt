/**
 * Initialize the codec with the provided cryptoEngine - this return functions to encode and decode messages.
 *
 * @param cryptoEngine - the engine to use for encryption / decryption
 */
function init(cryptoEngine) {
    // TODO: remove on next major version bump. This is a hack to make the salt available in all functions here in a
    //  backward compatible way (not requiring to  change the password_template).
    const backwardCompatibleSalt = '##SALT##';

    const exports = {};

    /**
     * Top-level function for encoding a message.
     * Includes password hashing, encryption, and signing.
     *
     * @param {string} msg
     * @param {string} password
     * @param {string} salt
     * @param {boolean} isLegacy - whether to use the legacy hashing algorithm (1k iterations) or not
     *
     * @returns {string} The encoded text
     */
    function encode(msg, password, salt, isLegacy = false) {
        // TODO: remove in the next major version bump. This is to not break backwards compatibility with the old way of hashing
        const hashedPassphrase = isLegacy
            ? cryptoEngine.hashLegacyRound(password, salt)
            : cryptoEngine.hashPassphrase(password, salt);
        const encrypted = cryptoEngine.encrypt(msg, hashedPassphrase);
        // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
        // it in localStorage safely, we don't use the clear text password)
        const hmac = cryptoEngine.signMessage(hashedPassphrase, encrypted);

        return hmac + encrypted;
    }
    exports.encode = encode;

    /**
     * Top-level function for decoding a message.
     * Includes signature check and decryption.
     *
     * @param {string} signedMsg
     * @param {string} hashedPassphrase
     * @param {string} backwardCompatibleHashedPassword
     *
     * @returns {Object} {success: true, decoded: string} | {success: false, message: string}
     */
    function decode(signedMsg, hashedPassphrase, backwardCompatibleHashedPassword = '') {
        const encryptedHMAC = signedMsg.substring(0, 64);
        const encryptedMsg = signedMsg.substring(64);
        const decryptedHMAC = cryptoEngine.signMessage(hashedPassphrase, encryptedMsg);

        if (decryptedHMAC !== encryptedHMAC) {
            // TODO: remove in next major version bump. This is to not break backwards compatibility with the old 1k
            //  iterations in PBKDF2 - if the key we try isn't working, it might be because it's a remember-me/autodecrypt
            //  link key, generated with 1k iterations. Try again with the updated iteration count.
            if (!backwardCompatibleHashedPassword) {
                return decode(
                    signedMsg,
                    cryptoEngine.hashSecondRound(hashedPassphrase, backwardCompatibleSalt),
                    hashedPassphrase
                );
            }

            return { success: false, message: "Signature mismatch" };
        }

        // TODO: remove in next major version bump. If we're trying to double hash for backward compatibility reasons,
        //  and the attempt is successful, we check if we should update the stored password in localStorage. This avoids
        //  having to compute the upgrade each time.
        if (backwardCompatibleHashedPassword) {
            if (window && window.localStorage) {
                const storedPassword = window.localStorage.getItem('staticrypt_passphrase');

                // check the stored password is actually the backward compatible one, so we don't save the new one and trigger
                // the "remember-me" by mistake, leaking the password
                if (storedPassword === backwardCompatibleHashedPassword) {
                    window.localStorage.setItem('staticrypt_passphrase', hashedPassphrase);
                }
            }
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
