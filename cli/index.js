#!/usr/bin/env node

"use strict";

const fs = require("fs");

// parse .env file into process.env
require('dotenv').config();

const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js");
const { generateRandomSalt, generateRandomString } = cryptoEngine;
const { encode } = codec.init(cryptoEngine);
const { convertCommonJSToBrowserJS, exitWithError, isOptionSetByUser, genFile, getPassword, getFileContent, getSalt} = require("./helpers");
const { parseCommandLineArguments} = require("./helpers.js");

// parse arguments
const yargs = parseCommandLineArguments();
const namedArgs = yargs.argv;

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

    // get the file content
    const contents = getFileContent(inputFilepath);

    // encrypt input
    const encryptedMessage = await encode(contents, password, salt);

    const data = {
        decrypt_button: namedArgs.decryptButton,
        encrypted: encryptedMessage,
        instructions: namedArgs.instructions,
        is_remember_enabled: namedArgs.noremember ? "false" : "true",
        js_codec: convertCommonJSToBrowserJS("lib/codec"),
        js_crypto_engine: convertCommonJSToBrowserJS("lib/cryptoEngine"),
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
