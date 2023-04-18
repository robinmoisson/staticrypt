#!/usr/bin/env node

"use strict";

// check node version before anything else
const nodeVersion = process.versions.node.split(".");
if (nodeVersion[0] < 16) {
    console.log("ERROR: Node version 16 or higher is required.");
    process.exit(1);
}

// parse .env file into process.env
require('dotenv').config();

const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js");
const { generateRandomSalt } = cryptoEngine;
const { encode } = codec.init(cryptoEngine);
const { parseCommandLineArguments, buildStaticryptJS, isOptionSetByUser, genFile, getFileContent,
    getValidatedSalt,
    getValidatedPassword, getConfig, writeConfig
} = require("./helpers.js");

// parse arguments
const yargs = parseCommandLineArguments();
const namedArgs = yargs.argv;

async function runStatiCrypt() {
    const hasSaltFlag = isOptionSetByUser("s", yargs);
    const hasShareFlag = isOptionSetByUser("share", yargs);

    const positionalArguments = namedArgs._;

    // validate the number of arguments
    if (!hasShareFlag && !(hasSaltFlag && !namedArgs.salt)) {
        if (positionalArguments.length === 0) {
            console.log("ERROR: Invalid number of arguments. Please provide an input file.\n");

            yargs.showHelp();
            process.exit(1);
        }
    }

    // get config file
    const configPath = namedArgs.config.toLowerCase() === "false" ? null : "./" + namedArgs.config;
    const config = getConfig(configPath);

    // if the 's' flag is passed without parameter, generate a salt, display & exit
    if (hasSaltFlag && !namedArgs.salt) {
        const generatedSalt = generateRandomSalt();

        // show salt
        console.log(generatedSalt);

        // write to config file if it doesn't exist
        if (!config.salt) {
            config.salt = generatedSalt;
            writeConfig(configPath, config);
        }

        process.exit(0);
    }

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
    if (config.salt !== salt) {
        config.salt = salt;
        writeConfig(configPath, config);
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
        template_color_primary: namedArgs.templateColorPrimary,
        template_color_secondary: namedArgs.templateColorSecondary,
    };

    const outputFilepath = namedArgs.directory.replace(/\/+$/, '') + "/" + inputFilepath;

    genFile(data, outputFilepath, namedArgs.template);
}

runStatiCrypt();
