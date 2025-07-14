/**
 * Initialize the codec with the provided cryptoEngine - this return functions to encode and decode messages.
 *
 * @param cryptoEngine - the engine to use for encryption / decryption
 */
function init(cryptoEngine) {
    const exports = {};

    /**
     * Implement digest signing:
     *
     *     hmac = sign( hashedPassword, iv + digest(encrypted) )
     *
     * To avoid having to make copy of encrypted.
     *
     * @param {Uint8Array} iv
     * @param {Uint8Array|null} encrypted
     * @param {Uint8Array} hashedPassword
     * @param {Uint8Array|null} encryptedDataHash
     *
     * @returns {Promise<Uint8Array>} The calculated hmac
     */
    async function signDigest(iv, encrypted, hashedPassword, encryptedDataHash = null) {
        // we use a hash of the encrypted bytes as a proxy for the actual bytes
        // when generating the HMAC to avoid making a copy of the encrypted bytes

        if (!encryptedDataHash) {
            encryptedDataHash = await cryptoEngine.digestMessage(encrypted);
        }

        const messageBuffer = new Uint8Array(iv.length + encryptedDataHash.length);
        messageBuffer.set(iv);
        messageBuffer.set(encryptedDataHash, iv.length);

        const hmac = await cryptoEngine.signMessage(hashedPassword, messageBuffer);

        return hmac;
    }

    /**
     * Top-level function for encoding a message.
     * Includes password hashing, encryption, and signing.
     *
     * @param {Uint8Array} msg
     * @param {Uint8Array} password
     * @param {Uint8Array} salt
     *
     * @returns {Promise<Uint8Array>} The encoded text
     */
    async function encode(msg, password, salt) {
        const hashedPassword = await cryptoEngine.hashPassword(password, salt);
        const authEncryptionData = await encodeWithHashedPassword(msg, hashedPassword);

        return authEncryptionData;
    }
    exports.encode = encode;

    /**
     * Encode using a password that has already been hashed. This is useful to encode multiple messages in a row, that way
     * we don't need to hash the password multiple times.
     *
     * @param {Uint8Array} msg
     * @param {Uint8Array} hashedPassword
     *
     * @returns { Promise<{iv: Uint8Array, encrypted: Uint8Array, hmac: Uint8Array}> }
     */
    async function encodeWithHashedPassword(msg, hashedPassword) {
        const encryptionData = await cryptoEngine.encrypt(msg, hashedPassword);

        // we use the hashed password in the HMAC because this is effectively what will be used a password (so we can store
        // it in localStorage safely, we don't use the clear text password)

        const hmac = await signDigest(encryptionData.iv, encryptionData.encrypted, hashedPassword);

        return {
            ...encryptionData,
            hmac: hmac,
        };
    }
    exports.encodeWithHashedPassword = encodeWithHashedPassword;

    /**
     * Top-level function for decoding a message.
     * Includes signature check and decryption.
     *
     * @param {Uint8Array} iv
     * @param {Uint8Array} encrypted
     * @param {Uint8Array} hmac
     * @param {Uint8Array} hashedPassword
     * @param {Uint8Array} salt
     * @param {int} backwardCompatibleAttempt
     * @param {Uint8Array} originalPassword
     *
     * @returns { Promise<{success: true, decoded: Uint8Array} | {success: false, message: string}> }
     */
    async function decode(
        iv,
        encrypted,
        hmac,
        hashedPassword,
        salt,
        backwardCompatibleAttempt = 0,
        originalPassword = null
    ) {
        const encryptedDataHash = await cryptoEngine.digestMessage(encrypted);

        const calculatedHMAC = await signDigest(iv, null, hashedPassword, encryptedDataHash);

        if (!cryptoEngine.isArrayEqual(calculatedHMAC, hmac)) {
            // we have been raising the number of iterations in the hashing algorithm multiple times, so to support the old
            // remember-me/autodecrypt links we need to try bringing the old hashes up to speed.

            originalPassword = originalPassword || hashedPassword;
            if (backwardCompatibleAttempt === 0) {
                const updatedHashedPassword = await cryptoEngine.hashThirdRound(originalPassword, salt);

                return decode(
                    iv,
                    encrypted,
                    hmac,
                    updatedHashedPassword,
                    salt,
                    backwardCompatibleAttempt + 1,
                    originalPassword
                );
            }
            if (backwardCompatibleAttempt === 1) {
                let updatedHashedPassword = await cryptoEngine.hashSecondRound(originalPassword, salt);
                updatedHashedPassword = await cryptoEngine.hashThirdRound(updatedHashedPassword, salt);

                return decode(
                    iv,
                    encrypted,
                    hmac,
                    updatedHashedPassword,
                    salt,
                    backwardCompatibleAttempt + 1,
                    originalPassword
                );
            }

            return { success: false, message: "Signature mismatch" };
        }

        return {
            success: true,
            decoded: await cryptoEngine.decrypt(iv, encrypted, hashedPassword),
        };
    }
    exports.decode = decode;

    return exports;
}
exports.init = init;
