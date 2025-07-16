const cryptoEngine = /*[|js_crypto_engine|]*/ 0;
const codec = /*[|js_codec|]*/ 0;
const decode = codec.init(cryptoEngine).decode;

/**
 * Initialize the staticrypt module, that exposes functions callbable by the password_template.
 * @param {{
 *  staticryptIvUniqueVariableName: string,
 *  staticryptHmacUniqueVariableName: string,
 *  isRememberEnabled: boolean,
 *  rememberDurationInDays: number,
 *  staticryptSaltUniqueVariableName: string,
 * }} staticryptConfig - object of data that is stored on the password_template at encryption time.
 *
 * @param {{
 *  rememberExpirationKey: string,
 *  rememberPassphraseKey: string,
 *  replaceHtmlCallback: function,
 *  clearLocalStorageCallback: function,
 * }} templateConfig - object of data that can be configured by a custom password_template.
 */
function init(staticryptConfig, templateConfig) {
    const exports = {};

    /**
     * Get and return encrypted Uint8Array
     * @returns {Uint8Array}
     */
    async function getEncrypted() {
        let encrypted = null;
        const encryptedDataDiv = document.getElementById("staticrypt-encrypted-data");

        if (encryptedDataDiv) {
            const dataUrl = encryptedDataDiv.dataset.encrypted;

            const response = await fetch(dataUrl);
            const arrayBuffer = await response.arrayBuffer();

            // Delete the element from the DOM to free up memory
            encryptedDataDiv.remove();

            encrypted = new Uint8Array(arrayBuffer);
        }
        return encrypted;
    }

    /**
     * Decrypt our encrypted page, replace the whole HTML.
     *
     * @param {Uint8Array} hashedPassword
     * @returns {Promise<boolean>}
     */
    async function decryptAndReplaceHtml(hashedPassword) {
        const iv = cryptoEngine.HexEncoder.parse(staticryptConfig.staticryptIvUniqueVariableName);
        const hmac = cryptoEngine.HexEncoder.parse(staticryptConfig.staticryptHmacUniqueVariableName);
        const salt = cryptoEngine.HexEncoder.parse(staticryptConfig.staticryptSaltUniqueVariableName);

        const { replaceHtmlCallback } = templateConfig;

        // Encrypted may be very large, we avoid creating a named variable
        // for the Uint8Array so it will immediately be eligible for garbage
        // collection.
        let result = await decode(iv, await getEncrypted(), hmac, hashedPassword, salt);
        if (!result.success) {
            return false;
        }
        const plainHTML = cryptoEngine.UTF8Encoder.stringify(result.decoded);

        // no further use for result and result.decoded can be vary large
        result = null;

        // if the user configured a callback call it, otherwise just replace the whole HTML
        if (typeof replaceHtmlCallback === "function") {
            replaceHtmlCallback(plainHTML);
        } else {
            document.write(plainHTML);
            document.close();
        }

        return true;
    }

    /**
     * Attempt to decrypt the page and replace the whole HTML.
     *
     * @param {string} password
     * @param {boolean} isRememberChecked
     *
     * @returns {Promise<{isSuccessful: boolean, hashedPassword?: Uint8Array}>} - we return an object, so that if we want to
     *   expose more information in the future we can do it without breaking the password_template
     */
    async function handleDecryptionOfPage(passwordString, isRememberChecked) {
        const password = cryptoEngine.UTF8Encoder.parse(passwordString);
        const salt = cryptoEngine.HexEncoder.parse(staticryptConfig.staticryptSaltUniqueVariableName);

        // decrypt and replace the whole page
        const hashedPassword = await cryptoEngine.hashPassword(password, salt);
        return handleDecryptionOfPageFromHash(hashedPassword, isRememberChecked);
    }
    exports.handleDecryptionOfPage = handleDecryptionOfPage;

    async function handleDecryptionOfPageFromHash(hashedPassword, isRememberChecked) {
        const { isRememberEnabled, rememberDurationInDays } = staticryptConfig;
        const { rememberExpirationKey, rememberPassphraseKey } = templateConfig;

        const isDecryptionSuccessful = await decryptAndReplaceHtml(hashedPassword);

        if (!isDecryptionSuccessful) {
            return {
                isSuccessful: false,
                hashedPassword,
            };
        }

        // remember the hashedPassword and set its expiration if necessary
        if (isRememberEnabled && isRememberChecked) {
            const hashedPasswordString = cryptoEngine.HexEncoder.stringify(hashedPassword);
            window.localStorage.setItem(rememberPassphraseKey, hashedPasswordString);

            // set the expiration if the duration isn't 0 (meaning no expiration)
            if (rememberDurationInDays > 0) {
                window.localStorage.setItem(
                    rememberExpirationKey,
                    (new Date().getTime() + rememberDurationInDays * 24 * 60 * 60 * 1000).toString()
                );
            }
        }

        return {
            isSuccessful: true,
            hashedPassword,
        };
    }
    exports.handleDecryptionOfPageFromHash = handleDecryptionOfPageFromHash;

    /**
     * Clear localstorage from staticrypt related values
     */
    function clearLocalStorage() {
        const { clearLocalStorageCallback, rememberExpirationKey, rememberPassphraseKey } = templateConfig;

        if (typeof clearLocalStorageCallback === "function") {
            clearLocalStorageCallback();
        } else {
            localStorage.removeItem(rememberPassphraseKey);
            localStorage.removeItem(rememberExpirationKey);
        }
    }

    async function handleDecryptOnLoad() {
        let isSuccessful = await decryptOnLoadFromUrl();

        if (!isSuccessful) {
            isSuccessful = await decryptOnLoadFromRememberMe();
        }

        return { isSuccessful };
    }
    exports.handleDecryptOnLoad = handleDecryptOnLoad;

    /**
     * Clear storage if we are logging out
     *
     * @returns {boolean} - whether we logged out
     */
    function logoutIfNeeded() {
        const logoutKey = "staticrypt_logout";

        // handle logout through query param
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.has(logoutKey)) {
            clearLocalStorage();
            return true;
        }

        // handle logout through URL fragment
        const hash = window.location.hash.substring(1);
        if (hash.includes(logoutKey)) {
            clearLocalStorage();
            return true;
        }

        return false;
    }

    /**
     * To be called on load: check if we want to try to decrypt and replace the HTML with the decrypted content, and
     * try to do it if needed.
     *
     * @returns {Promise<boolean>} true if we derypted and replaced the whole page, false otherwise
     */
    async function decryptOnLoadFromRememberMe() {
        const { rememberDurationInDays } = staticryptConfig;
        const { rememberExpirationKey, rememberPassphraseKey } = templateConfig;

        // if we are loging out, terminate
        if (logoutIfNeeded()) {
            return false;
        }

        // if there is expiration configured, check if we're not beyond the expiration
        if (rememberDurationInDays && rememberDurationInDays > 0) {
            const expiration = localStorage.getItem(rememberExpirationKey),
                isExpired = expiration && new Date().getTime() > parseInt(expiration);

            if (isExpired) {
                clearLocalStorage();
                return false;
            }
        }

        const hashedPasswordString = localStorage.getItem(rememberPassphraseKey);

        if (hashedPasswordString) {
            const hashedPassword = cryptoEngine.HexEncoder.parse(hashedPasswordString);

            // try to decrypt
            const isDecryptionSuccessful = await decryptAndReplaceHtml(hashedPassword);

            // if the decryption is unsuccessful the password might be wrong - silently clear the saved data and let
            // the user fill the password form again
            if (!isDecryptionSuccessful) {
                clearLocalStorage();
                return false;
            }

            return true;
        }

        return false;
    }

    async function decryptOnLoadFromUrl() {
        const passwordKey = "staticrypt_pwd";
        const rememberMeKey = "remember_me";

        // try to get the password from the query param (for backward compatibility - we now want to avoid this method,
        // since it sends the hashed password to the server which isn't needed)
        const queryParams = new URLSearchParams(window.location.search);
        const hashedPasswordQuery = queryParams.get(passwordKey);
        const rememberMeQuery = queryParams.get(rememberMeKey);

        const urlFragment = window.location.hash.substring(1);
        // get the password from the url fragment
        const hashedPasswordRegexMatch = urlFragment.match(new RegExp(passwordKey + "=([^&]*)"));
        const hashedPasswordFragment = hashedPasswordRegexMatch ? hashedPasswordRegexMatch[1] : null;
        const rememberMeFragment = urlFragment.includes(rememberMeKey);

        const hashedPasswordString = hashedPasswordFragment || hashedPasswordQuery;
        const hashedPassword = cryptoEngine.HexEncoder.parse(hashedPasswordString);
        const rememberMe = rememberMeFragment || rememberMeQuery;

        if (hashedPassword) {
            return handleDecryptionOfPageFromHash(hashedPassword, rememberMe);
        }

        return false;
    }

    return exports;
}
exports.init = init;
