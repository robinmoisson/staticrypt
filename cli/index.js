#!/usr/bin/env node

"use strict";

const fs = require("fs");

// parse .env file into process.env
require('dotenv').config();

const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js");
const { generateRandomSalt } = cryptoEngine;
const { encode } = codec.init(cryptoEngine);
const { parseCommandLineArguments, buildStaticryptJS, isOptionSetByUser, genFile, getPassword, getFileContent, getSalt,
    getValidatedSalt,
    getValidatedPassword, getConfig
} = require("./helpers.js");

// parse arguments
const yargs = parseCommandLineArguments();
const namedArgs = yargs.argv;

async function runStatiCrypt() {
    const hasSaltFlag = isOptionSetByUser("s", yargs);
    const hasShareFlag = isOptionSetByUser("share", yargs);

    const positionalArguments = namedArgs._;

    // validate the number of arguments
    if (!hasShareFlag && !hasSaltFlag) {
        if (positionalArguments.length === 0) {
            yargs.showHelp();
            process.exit(1);
        }
    }

    // if the 's' flag is passed without parameter, generate a salt, display & exit
    if (hasSaltFlag && !namedArgs.salt) {
        console.log(generateRandomSalt());
        process.exit(0);
    }

    // get config file
    const config = getConfig(namedArgs.config);

    // get the salt & password
    const salt = getValidatedSalt(namedArgs, config);
    const password = await getValidatedPassword(namedArgs.password, namedArgs.short);

    // display the share link with the hashed password if the --share flag is set
    if (hasShareFlag) {
        const url = namedArgs.share || "";

        const hashedPassword = await cryptoEngine.hashPassphrase(password, salt);

        console.log(url + "#staticrypt_pwd=" + hashedPassword);
        process.exit(0);
    }

    // write salt to config file
    const isUsingconfigFile = namedArgs.config.toLowerCase() !== "false";
    const configPath = "./" + namedArgs.config;
    if (isUsingconfigFile && config.salt !== salt) {
        config.salt = salt;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    }

    // get the file content
    const inputFilepath = positionalArguments[0].toString();
    const contents = getFileContent(inputFilepath);

    // encrypt input
    const encryptedMsg = await encode(contents, password, salt);

    const isRememberEnabled = namedArgs.remember !== "false";

    const data = {
        is_remember_enabled: JSON.stringify(isRememberEnabled),
        js_staticrypt: buildStaticryptJS(),
        staticrypt_config: {
            encryptedMsg,
            isRememberEnabled,
            rememberDurationInDays: namedArgs.remember,
            salt,
        },
        template_button: namedArgs.templateButton,
        template_error: namedArgs.templateError,
        template_instructions: namedArgs.templateInstructions,
        template_placeholder: namedArgs.templatePlaceholder,
        template_remember: namedArgs.templateRemember,
        template_title: namedArgs.templateTitle,
    };

    const outputFilepath = namedArgs.directory.replace(/\/+$/, '') + "/" + inputFilepath;

    genFile(data, outputFilepath, namedArgs.template);
}

runStatiCrypt();
