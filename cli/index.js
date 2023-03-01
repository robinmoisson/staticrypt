#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const Yargs = require("yargs");

// parse .env file into process.env
require('dotenv').config();

const cryptoEngine = require("../lib/cryptoEngine/cryptojsEngine");
const codec = require("../lib/codec");
const { convertCommonJSToBrowserJS, exitEarly, isOptionSetByUser, genFile, getPassword, getFileContent, getSalt} = require("./helpers");
const { isCustomPasswordTemplateLegacy, parseCommandLineArguments} = require("./helpers.js");
const { generateRandomSalt, generateRandomString } = cryptoEngine;
const { encode } = codec.init(cryptoEngine);

const SCRIPT_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js";
const SCRIPT_TAG =
  '<script src="' +
  SCRIPT_URL +
  '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

// parse arguments
const yargs = parseCommandLineArguments();
const namedArgs = yargs.argv;

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
      + `try on public files, and you are most safe when using a long password. You can hide this warning by increasing `
      + `the length or adding the '--short' flag.\n`
      + `Here's a strong generated password you could use: `
      + generateRandomString(21)
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
  exitEarly(
    "The salt should be a 32 character long hexadecimal string (only [0-9a-f] characters allowed)"
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
    const hashedPassphrase = cryptoEngine.hashPassphrase(password, salt);

    console.log(url + "?staticrypt_pwd=" + hashedPassphrase);
}

// get the file content
const contents = getFileContent(inputFilepath);

// TODO: remove in the next major version bump. This is to allow a security update to some versions without breaking
//  older ones. If the password template is custom AND created before 2.2.0 we need to use the old hashing algorithm.
const isLegacy = isCustomPasswordTemplateLegacy(namedArgs.f);

if (isLegacy) {
    console.log(
        "#################################\n\n" +
        "[StatiCrypt] SECURITY WARNING: You are using an old version of the password template, which has been found to " +
        "be less secure. Please update your custom password_template logic to match version 2.2.0 or higher." +
        "\nYou can find the template here: https://github.com/robinmoisson/staticrypt/blob/main/lib/password_template.html" +
        "\n\n#################################"
    );
}

// encrypt input
const encryptedMessage = encode(contents, password, salt, isLegacy);

// create crypto-js tag (embedded or not)
let cryptoTag = SCRIPT_TAG;
if (namedArgs.embed) {
  try {
    const embedContents = fs.readFileSync(
      path.join(__dirname, "..", "lib", "kryptojs-3.1.9-1.min.js"),
      "utf8"
    );

    cryptoTag = "<script>" + embedContents + "</script>";
  } catch (e) {
    exitEarly("Failure: embed file does not exist!");
  }
}

const data = {
  crypto_tag: cryptoTag,
  decrypt_button: namedArgs.decryptButton,
  embed: namedArgs.embed,
  encrypted: encryptedMessage,
  instructions: namedArgs.instructions,
  is_remember_enabled: namedArgs.noremember ? "false" : "true",
  // TODO: remove on next major version bump. This is a hack to pass the salt to the injected js_codec in a backward
  //  compatible way (not requiring to update the password_template).
  js_codec: convertCommonJSToBrowserJS("lib/codec").replace('##SALT##', salt),
  js_crypto_engine: convertCommonJSToBrowserJS("lib/cryptoEngine/cryptojsEngine"),
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
