function passphraseStorageFactory (storageType) {
    return {
        store: function (passphrase) {
            return window[storageType].setItem("passphrase", passphrase)
        },
        get: function () {
            return window[storageType].getItem("passphrase")
        },
        remove: function () {
            return window[storageType].removeItem("passphrase")
        }
    }
}

const passphraseStorage = passphraseStorageFactory(storageType)