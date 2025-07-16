#!/usr/bin/env node

"use strict";

// check node version before anything else
const nodeVersion = process.versions.node.split(".");
if (nodeVersion[0] < 16) {
    console.log("ERROR: Node version 16 or higher is required.");
    process.exit(1);
}

// parse .env file into process.env
require("dotenv").config();

const pathModule = require("path");
const fs = require("fs");

const cryptoEngine = require("../lib/cryptoEngine.js");
const codec = require("../lib/codec.js");
const { generateRandomSaltString } = cryptoEngine;
const { decode, encodeWithHashedPassword } = codec.init(cryptoEngine);
const {
    OUTPUT_DIRECTORY_DEFAULT_PATH,
    buildStaticryptJS,
    exitWithError,
    genFile,
    getConfig,
    getFileContent,
    getFileContentBytes,
    getPasswordString,
    getValidatedSaltString,
    isOptionSetByUser,
    parseCommandLineArguments,
    recursivelyApplyCallbackToHtmlFiles,
    validatePasswordString,
    writeConfig,
    writeFile,
    getFullOutputPath,
} = require("./helpers.js");

// parse arguments
const yargs = parseCommandLineArguments();
const namedArgs = yargs.argv;

async function runStatiCrypt() {
    const hasSaltFlag = isOptionSetByUser("s", yargs);
    const hasShareFlag = isOptionSetByUser("share", yargs);

    const positionalArguments = namedArgs._;

    // require at least one positional argument unless some specific flags are passed
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
        const generatedSaltString = generateRandomSaltString();

        // show salt
        console.log(generatedSaltstring);

        // write to config file if it doesn't exist
        if (!config.salt) {
            config.salt = generatedSaltstring;
            writeConfig(configPath, config);
        }

        return;
    }

    // get the salt & password
    const saltString = getValidatedSaltString(namedArgs, config);
    const salt = cryptoEngine.HexEncoder.parse(saltString);

    const passwordString = await getPasswordString(namedArgs.password);
    const password = cryptoEngine.UTF8Encoder.parse(passwordString);

    const hashedPassword = await cryptoEngine.hashPassword(password, salt);
    const hashedPasswordString = cryptoEngine.HexEncoder.stringify(hashedPassword);

    // display the share link with the hashed password if the --share flag is set
    if (hasShareFlag) {
        await validatePasswordString(passwordString, namedArgs.short);

        let url = namedArgs.share || "";
        url += "#staticrypt_pwd=" + hashedPasswordString;

        if (namedArgs.shareRemember) {
            url += `&remember_me`;
        }

        console.log(url);
        return;
    }

    // only process a directory if the --recursive flag is set
    const directoriesInArguments = positionalArguments.filter((path) => fs.statSync(path).isDirectory());
    if (directoriesInArguments.length > 0 && !namedArgs.recursive) {
        exitWithError(
            `'${directoriesInArguments[0].toString()}' is a directory. Use the -r|--recursive flag to process directories.`
        );
    }

    // if asking for decryption, decrypt all the files
    if (namedArgs.decrypt) {
        const isOutputDirectoryDefault =
            namedArgs.directory === OUTPUT_DIRECTORY_DEFAULT_PATH && !isOptionSetByUser("d", yargs);
        const outputDirectory = isOutputDirectoryDefault ? "decrypted" : namedArgs.directory;

        positionalArguments.forEach((path) => {
            recursivelyApplyCallbackToHtmlFiles(
                (fullPath, fullRootDirectory) => {
                    decodeAndGenerateFile(fullPath, fullRootDirectory, hashedPassword, outputDirectory);
                },
                path,
                namedArgs.directory
            );
        });

        return;
    }

    await validatePasswordString(passwordString, namedArgs.short);

    // write salt to config file
    if (config.salt !== saltString) {
        config.salt = saltString;
        writeConfig(configPath, config);
    }

    const isRememberEnabled = namedArgs.remember !== "false";

    const baseTemplateData = {
        is_remember_enabled: JSON.stringify(isRememberEnabled),
        js_staticrypt: buildStaticryptJS(),
        template_button: namedArgs.templateButton,
        template_color_primary: namedArgs.templateColorPrimary,
        template_color_secondary: namedArgs.templateColorSecondary,
        template_error: namedArgs.templateError,
        template_instructions: namedArgs.templateInstructions,
        template_placeholder: namedArgs.templatePlaceholder,
        template_remember: namedArgs.templateRemember,
        template_title: namedArgs.templateTitle,
        template_toggle_show: namedArgs.templateToggleShow,
        template_toggle_hide: namedArgs.templateToggleHide,
    };

    // encode all the files
    positionalArguments.forEach((path) => {
        recursivelyApplyCallbackToHtmlFiles(
            (fullPath, fullRootDirectory) => {
                encodeAndGenerateFile(
                    fullPath,
                    fullRootDirectory,
                    hashedPassword,
                    saltString,
                    baseTemplateData,
                    isRememberEnabled,
                    namedArgs
                );
            },
            path,
            namedArgs.directory
        );
    });
}

async function decodeAndGenerateFile(path, fullRootDirectory, hashedPassword, outputDirectory) {
    // get the file content
    const encryptedFileContent = getFileContent(path);

    // extract the cipher text from the encrypted file
    const ivMatch = encryptedFileContent.match(/"staticryptIvUniqueVariableName":\s*"([^"]+)"/);
    const hmacMatch = encryptedFileContent.match(/"staticryptHmacUniqueVariableName":\s*"([^"]+)"/);
    const saltMatch = encryptedFileContent.match(/"staticryptSaltUniqueVariableName":\s*"([^"]+)"/);

    let encryptedMatch = encryptedFileContent.match(/data-encrypted="data:application\/octet-stream\;base64\,([^"]+)"/);

    if (!encryptedMatch || !ivMatch || !hmacMatch || !saltMatch) {
        return console.log(`ERROR: could not extract cipher text, iv, hmac, or salt from ${path}`);
    }

    const encrypted = cryptoEngine.Base64Encoder.parse(encryptedMatch[1]);
    encryptedMatch = null;

    const iv = cryptoEngine.HexEncoder.parse(ivMatch[1]);
    const hmac = cryptoEngine.HexEncoder.parse(hmacMatch[1]);
    const salt = cryptoEngine.HexEncoder.parse(saltMatch[1]);

    // decrypt input
    const { success, decoded } = await decode(iv, encrypted, hmac, hashedPassword, salt);

    if (!success) {
        return console.log(`ERROR: could not decrypt ${path}`);
    }

    const outputFilepath = getFullOutputPath(path, fullRootDirectory, outputDirectory);

    writeFile(outputFilepath, decoded);
}

async function encodeAndGenerateFile(
    path,
    rootDirectoryFromArguments,
    hashedPassword,
    saltString,
    baseTemplateData,
    isRememberEnabled,
    namedArgs
) {
    // encrypt input
    const encryptedMsg = await encodeWithHashedPassword(getFileContentBytes(path), hashedPassword);

    let rememberDurationInDays = parseInt(namedArgs.remember);
    rememberDurationInDays = isNaN(rememberDurationInDays) ? 0 : rememberDurationInDays;

    const staticryptConfig = {
        staticryptIvUniqueVariableName: cryptoEngine.HexEncoder.stringify(encryptedMsg.iv),
        staticryptHmacUniqueVariableName: cryptoEngine.HexEncoder.stringify(encryptedMsg.hmac),

        isRememberEnabled,
        rememberDurationInDays,
        staticryptSaltUniqueVariableName: saltString,
    };
    const templateData = {
        ...baseTemplateData,
        encrypted_data: cryptoEngine.Base64Encoder.stringify(encryptedMsg.encrypted),
        staticrypt_config: staticryptConfig,
    };

    // remove the base path so that the actual output path is relative to the base path
    const relativePath = pathModule.relative(rootDirectoryFromArguments, path);
    const outputFilepath = namedArgs.directory + "/" + relativePath;

    genFile(templateData, outputFilepath, namedArgs.template);
}

runStatiCrypt();
