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
        const hashedPassword = await cryptoEngine.hashPassword(password, salt);

        const encrypted = await cryptoEngine.encrypt(msg, hashedPassword);

        // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
        // it in localStorage safely, we don't use the clear text password)
        const hmac = await cryptoEngine.signMessage(hashedPassword, encrypted);

        return hmac + encrypted;
    }
    exports.encode = encode;

    /**
     * Encode using a password that has already been hashed. This is useful to encode multiple messages in a row, that way
     * we don't need to hash the password multiple times.
     *
     * @param {string} msg
     * @param {string} hashedPassword
     *
     * @returns {string} The encoded text
     */
    async function encodeWithHashedPassword(msg, hashedPassword) {
        const encrypted = await cryptoEngine.encrypt(msg, hashedPassword);

        // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
        // it in localStorage safely, we don't use the clear text password)
        const hmac = await cryptoEngine.signMessage(hashedPassword, encrypted);

        return hmac + encrypted;
    }
    exports.encodeWithHashedPassword = encodeWithHashedPassword;

    /**
     * Top-level function for decoding a message.
     * Includes signature check and decryption.
     *
     * @param {string} signedMsg
     * @param {string} hashedPassword
     * @param {string} salt
     * @param {int} backwardCompatibleAttempt
     * @param {string} originalPassword
     *
     * @returns {Object} {success: true, decoded: string} | {success: false, message: string}
     */
    async function decode(signedMsg, hashedPassword, salt, backwardCompatibleAttempt = 0, originalPassword = "") {
        const encryptedHMAC = signedMsg.substring(0, 64);
        const encryptedMsg = signedMsg.substring(64);
        const decryptedHMAC = await cryptoEngine.signMessage(hashedPassword, encryptedMsg);

        if (decryptedHMAC !== encryptedHMAC) {
            // we have been raising the number of iterations in the hashing algorithm multiple times, so to support the old
            // remember-me/autodecrypt links we need to try bringing the old hashes up to speed.
            originalPassword = originalPassword || hashedPassword;
            if (backwardCompatibleAttempt === 0) {
                const updatedHashedPassword = await cryptoEngine.hashThirdRound(originalPassword, salt);

                return decode(signedMsg, updatedHashedPassword, salt, backwardCompatibleAttempt + 1, originalPassword);
            }
            if (backwardCompatibleAttempt === 1) {
                let updatedHashedPassword = await cryptoEngine.hashSecondRound(originalPassword, salt);
                updatedHashedPassword = await cryptoEngine.hashThirdRound(updatedHashedPassword, salt);

                return decode(signedMsg, updatedHashedPassword, salt, backwardCompatibleAttempt + 1, originalPassword);
            }

            return { success: false, message: "Signature mismatch" };
        }

        return {
            success: true,
            decoded: await cryptoEngine.decrypt(encryptedMsg, hashedPassword),
        };
    }
    exports.decode = decode;

    return exports;
}
exports.init = init;
