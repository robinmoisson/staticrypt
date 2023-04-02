#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

// parse .env file into process.env
require('dotenv').config();

const { convertCommonJSToBrowserJS, exitWithError, isOptionSetByUser, genFile, getPassword, getFileContent, getSalt} = require("./helpers");
const { isCustomPasswordTemplateLegacy, parseCommandLineArguments, isPasswordTemplateUsingAsync} = require("./helpers.js");

const CRYPTOJS_SCRIPT_TAG =
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js" ' +
    'integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

// parse arguments
const yargs = parseCommandLineArguments();
const namedArgs = yargs.argv;

// set the crypto engine
const isWebcrypto = namedArgs.engine === "webcrypto";
const isNodeMissingWebCrypto = require("node:crypto").webcrypto === undefined;

if (isWebcrypto && isNodeMissingWebCrypto) {
    exitWithError("WebCrypto is not included in your Node.js version. Please upgrade your node version to >= 16, or use the cryptoJS engine.");
}

// only call "require" for the webcrypto engine if we are actually using it, to avoid errors in older node versions
const cryptoEngine = isWebcrypto ? require("../lib/cryptoEngine/webcryptoEngine") : require("../lib/cryptoEngine/cryptojsEngine");
const { generateRandomSalt, generateRandomString } = cryptoEngine;

async function runStatiCrypt() {
    // if the 's' flag is passed without parameter, generate a salt, display & exit
    if (isOptionSetByUser("s", yargs) && !namedArgs.salt) {
        console.log(generateRandomSalt());
        process.exit(0);
    }

    // validate the number of arguments
    const positionalArguments = namedArgs._;
    if (positionalArguments.length > 2 || positionalArguments.length === 0) {
        yargs.showHelp();
        process.exit(1);
    }

    // parse input
    const inputFilepath = positionalArguments[0].toString(),
        password = getPassword(positionalArguments);

    if (password.length < 16 && !namedArgs.short) {
        console.log(
            `WARNING: Your password is less than 16 characters (length: ${password.length}). Brute-force attacks are easy to `
            + `try on public files, and you are most safe when using a long password.\n\n`
            + `👉️ Here's a strong generated password you could use: `
            + generateRandomString(21)
            + "\n\nThe file was encrypted with your password. You can hide this warning by increasing your password length or"
            + " adding the '--short' flag."
        )
    }

    // get config file
    const isUsingconfigFile = namedArgs.config.toLowerCase() !== "false";
    const configPath = "./" + namedArgs.config;
    let config = {};
    if (isUsingconfigFile && fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    // get the salt
    const salt = getSalt(namedArgs, config);

    // validate the salt
    if (salt.length !== 32 || /[^a-f0-9]/.test(salt)) {
        exitWithError(
            "the salt should be a 32 character long hexadecimal string (only [0-9a-f] characters allowed)"
            + "\nDetected salt: " + salt
        );
    }

    // write salt to config file
    if (isUsingconfigFile && config.salt !== salt) {
        config.salt = salt;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    }

    // display the share link with the hashed password if the --share flag is set
    if (isOptionSetByUser("share", yargs)) {
        const url = namedArgs.share || "";

        const hashedPassword = await cryptoEngine.hashPassphrase(password, salt);

        console.log(url + "#staticrypt_pwd=" + hashedPassword);
    }

    // TODO: remove in the next major version bump. This is to allow a security update to some versions without breaking
    //  older ones. If the password template is custom AND created before 2.2.0 we need to use the old hashing algorithm.
    const isLegacy = isCustomPasswordTemplateLegacy(namedArgs.f);

    if (isLegacy) {
        console.log(
            "#################################\n\n" +
            "SECURITY WARNING [StatiCrypt]: You are using an old version of the password template, which has been found to " +
            "be less secure. Please update your custom password_template logic to match the latest version." +
            "\nYou can find instructions here: https://github.com/robinmoisson/staticrypt/issues/161" +
            "\n\n#################################"
        );
    }

    if (!isWebcrypto) {
        if (!isNodeMissingWebCrypto) {
            console.log(
                "WARNING: If you are viewing the file over HTTPS or locally, we recommend " +
                (isPasswordTemplateUsingAsync(namedArgs.f) ? "" : "updating your password template to the latest version and ") +
                "using the '--engine webcrypto' more secure engine. It will become the default in StatiCrypt next major version."
            );
        }
    } else if (!isPasswordTemplateUsingAsync(namedArgs.f) && isWebcrypto) {
        exitWithError(
            "The '--engine webcrypto' engine is only available for password templates that use async/await. Please " +
            "update your password template to the latest version or use the '--engine cryptojs' engine."
        )
    }

    // create crypto-js tag (embedded or not)
    let cryptoTag = CRYPTOJS_SCRIPT_TAG;
    if (isWebcrypto) {
        cryptoTag = "";
    } else if (namedArgs.embed) {
        try {
            const embedContents = fs.readFileSync(
                path.join(__dirname, "..", "lib", "kryptojs-3.1.9-1.min.js"),
                "utf8"
            );

            cryptoTag = "<script>" + embedContents + "</script>";
        } catch (e) {
            exitWithError("Embed file does not exist.");
        }
    }

    const cryptoEngineString = isWebcrypto
        ? convertCommonJSToBrowserJS("lib/cryptoEngine/webcryptoEngine")
        : convertCommonJSToBrowserJS("lib/cryptoEngine/cryptojsEngine");

    // get the file content
    const contents = getFileContent(inputFilepath);

    // get appropriate codec for password_template version
    const codec = isLegacy ? require("../lib/codec-sync.js") : require("../lib/codec.js");
    const { encode } = codec.init(cryptoEngine);

    // encrypt input
    const encryptedMessage = await encode(contents, password, salt, isLegacy);

    let codecString;
    if (isWebcrypto) {
        codecString = convertCommonJSToBrowserJS("lib/codec");
    } else {
        // TODO: remove on next major version bump. The replace is a hack to pass the salt to the injected js_codec in
        //  a backward compatible way (not requiring to update the password_template). Same for using a "sync" version
        //  of the codec.
        codecString = convertCommonJSToBrowserJS("lib/codec-sync").replace('##SALT##', salt);
    }

    const data = {
        crypto_tag: cryptoTag,
        decrypt_button: namedArgs.decryptButton,
        // TODO: deprecated option here for backward compat, remove on next major version bump
        embed: isWebcrypto ? false : namedArgs.embed,
        encrypted: encryptedMessage,
        instructions: namedArgs.instructions,
        is_remember_enabled: namedArgs.noremember ? "false" : "true",
        js_codec: codecString,
        js_crypto_engine: cryptoEngineString,
        label_error: namedArgs.labelError,
        passphrase_placeholder: namedArgs.passphrasePlaceholder,
        remember_duration_in_days: namedArgs.remember,
        remember_me: namedArgs.rememberLabel,
        salt: salt,
        title: namedArgs.title,
    };

    const outputFilepath = namedArgs.output !== null
        ? namedArgs.output
        : inputFilepath.replace(/\.html$/, "") + "_encrypted.html";

    genFile(data, outputFilepath, namedArgs.f);
}

runStatiCrypt();
