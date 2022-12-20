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
const { generateRandomSalt } = cryptoEngine;
const { encode } = codec.init(cryptoEngine);

const SCRIPT_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js";
const SCRIPT_TAG =
  '<script src="' +
  SCRIPT_URL +
  '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

const yargs = Yargs.usage("Usage: staticrypt <filename> [<passphrase>] [options]")
  .option("c", {
    alias: "config",
    type: "string",
    describe: 'Path to the config file. Set to "false" to disable.',
    default: ".staticrypt.json",
  })
  .option("decrypt-button", {
    type: "string",
    describe: 'Label to use for the decrypt button. Default: "DECRYPT".',
    default: "DECRYPT",
  })
  .option("e", {
    alias: "embed",
    type: "boolean",
    describe:
      "Whether or not to embed crypto-js in the page (or use an external CDN).",
    default: true,
  })
  .option("f", {
    alias: "file-template",
    type: "string",
    describe: "Path to custom HTML template with passphrase prompt.",
    default: path.join(__dirname, "..", "lib", "password_template.html"),
  })
  .option("i", {
    alias: "instructions",
    type: "string",
    describe: "Special instructions to display to the user.",
    default: "",
  })
  .option("label-error", {
    type: "string",
    describe: "Error message to display on entering wrong passphrase.",
    default: "Bad password!",
  })
  .option("noremember", {
    type: "boolean",
    describe: 'Set this flag to remove the "Remember me" checkbox.',
    default: false,
  })
  .option("o", {
    alias: "output",
    type: "string",
    describe: "File name/path for the generated encrypted file.",
    default: null,
  })
  .option("passphrase-placeholder", {
    type: "string",
    describe: "Placeholder to use for the passphrase input.",
    default: "Password",
  })
  .option("r", {
    alias: "remember",
    type: "number",
    describe:
      'Expiration in days of the "Remember me" checkbox that will save the (salted + hashed) passphrase ' +
      'in localStorage when entered by the user. Default: "0", no expiration.',
    default: 0,
  })
  .option("remember-label", {
    type: "string",
    describe: 'Label to use for the "Remember me" checkbox.',
    default: "Remember me",
  })
  // do not give a default option to this parameter - we want to see when the flag is included with no
  // value and when it's not included at all
  .option("s", {
    alias: "salt",
    describe:
      'Set the salt manually. It should be set if you want to use "Remember me" through multiple pages. It ' +
      "needs to be a 32-character-long hexadecimal string.\nInclude the empty flag to generate a random salt you " +
      'can use: "statycrypt -s".',
    type: "string",
  })
  // do not give a default option to this parameter - we want to see when the flag is included with no
  // value and when it's not included at all
  .option("share", {
    describe:
      'Get a link containing your hashed password that will auto-decrypt the page. Pass your URL as a value to append '
        + '"?staticrypt_pwd=<hashed_pwd>", or leave empty to display the hash to append.',
    type: "string",
  })
  .option("t", {
    alias: "title",
    type: "string",
    describe: "Title for the output HTML page.",
    default: "Protected Page",
  });
const namedArgs = yargs.argv;

// if the 's' flag is passed without parameter, generate a salt, display & exit
if (isOptionSetByUser("s", yargs) && !namedArgs.salt) {
  console.log(generateRandomSalt());
  process.exit(0);
}

// validate the number of arguments
const positionalArguments = namedArgs._;
if (positionalArguments.length > 2 || positionalArguments.length === 0) {
  Yargs.showHelp();
  process.exit(1);
}

// parse input
const inputFilepath = positionalArguments[0].toString(),
  password = getPassword(positionalArguments);

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

// encrypt input
const encryptedMessage = encode(contents, password, salt);

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
  js_codec: convertCommonJSToBrowserJS("lib/codec"),
  js_crypto_engine: convertCommonJSToBrowserJS("lib/cryptoEngine/cryptojsEngine"),
  label_error: namedArgs.labelError,
  passphrase_placeholder: namedArgs.passphrasePlaceholder,
  remember_duration_in_days: namedArgs.remember,
  remember_me: namedArgs.rememberLabel,
  salt: salt,
  title: namedArgs.title,
};

const outputFilePath = namedArgs.output !== null
    ? namedArgs.output
    : inputFilepath.replace(/\.html$/, "") + "_encrypted.html";

genFile(data, outputFilePath, namedArgs.f);
