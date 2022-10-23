#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const Yargs = require("yargs");
const impl = require("../lib/impl-cryptojs");
const codec = require("../lib/codec");
const { generateRandomSalt } = impl;
const { encode } = codec.init(impl);

const SCRIPT_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js";
const SCRIPT_TAG =
  '<script src="' +
  SCRIPT_URL +
  '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

/**
 * A dead-simple alternative to webpack or rollup for inlining simple
 * CommonJS modules in a browser <script>.
 * - Removes all lines containing require().
 * - Wraps the module in an immediately invoked function that returns `exports`.
 */
function transcludeModule(modulePath) {
  const resolvedPath = path.join(__dirname, ...modulePath.split("/")) + ".js";
  const moduleText = fs
    .readFileSync(resolvedPath, "utf8")
    .replaceAll(/^.*\brequire\(.*$\n/gm, "");

  return `
((function(){
  const exports = {};
  ${moduleText}
  return exports;
})())
  `.trim();
}

/**
 * Check if a particular option has been set by the user. Useful for distinguishing default value with flag without
 * parameter.
 *
 * Ex use case: '-s' means "give me a salt", '-s 1234' means "use 1234 as salt"
 *
 * From https://github.com/yargs/yargs/issues/513#issuecomment-221412008
 *
 * @param option
 * @param yargs
 * @returns {boolean}
 */
function isOptionSetByUser(option, yargs) {
  function searchForOption(option) {
    return process.argv.indexOf(option) > -1;
  }

  if (searchForOption(`-${option}`) || searchForOption(`--${option}`)) {
    return true;
  }

  // Handle aliases for same option
  for (let aliasIndex in yargs.parsed.aliases[option]) {
    const alias = yargs.parsed.aliases[option][aliasIndex];

    if (searchForOption(`-${alias}`) || searchForOption(`--${alias}`))
      return true;
  }

  return false;
}

const yargs = Yargs.usage("Usage: staticrypt <filename> <passphrase> [options]")
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
  .option("noremember", {
    type: "boolean",
    describe: 'Set this flag to remove the "Remember me" checkbox.',
    default: false,
  })
  .option("o", {
    alias: "output",
    type: "string",
    describe: "File name / path for generated encrypted file.",
    default: null,
  })
  .option("passphrase-placeholder", {
    type: "string",
    describe: "Placeholder to use for the passphrase input.",
    default: "Passphrase",
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
  // do not give a default option to this 'remember' parameter - we want to see when the flag is included with no
  // value and when it's not included at all
  .option("s", {
    alias: "salt",
    describe:
      'Set the salt manually. It should be set if you want use "Remember me" through multiple pages. It ' +
      "needs to be a 32 character long hexadecimal string.\nInclude the empty flag to generate a random salt you " +
      'can use: "statycrypt -s".',
    type: "string",
  })
  .option("t", {
    alias: "title",
    type: "string",
    describe: "Title for output HTML page.",
    default: "Protected Page",
  });
const namedArgs = yargs.argv;

// if the 's' flag is passed without parameter, generate a salt, display & exit
if (isOptionSetByUser("s", yargs) && !namedArgs.salt) {
  console.log(generateRandomSalt());
  process.exit(0);
}

// validate the number of arguments
if (namedArgs._.length !== 2) {
  Yargs.showHelp();
  process.exit(1);
}

// get config file
const isUsingconfigFile = namedArgs.config.toLowerCase() !== "false";
const configPath = "./" + namedArgs.config;
let config = {};
if (isUsingconfigFile && fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

/**
 * Get the salt to use
 */
let salt;
// either a salt was provided by the user through the flag --salt
if (!!namedArgs.salt) {
  salt = String(namedArgs.salt).toLowerCase();
}
// or we try to read the salt from config file
else if (!!config.salt) {
  salt = config.salt;
}
// or we generate a salt
else {
  salt = generateRandomSalt();
}

// validate the salt
if (salt.length !== 32 || /[^a-f0-9]/.test(salt)) {
  console.log(
    "The salt should be a 32 character long hexadecimal string (only [0-9a-f] characters allowed)"
  );
  console.log("Detected salt: " + salt);
  process.exit(1);
}

// write salt to config file
if (isUsingconfigFile && config.salt !== salt) {
  config.salt = salt;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// parse input
const input = namedArgs._[0].toString(),
  passphrase = namedArgs._[1].toString();

// get the file content
let contents;
try {
  contents = fs.readFileSync(input, "utf8");
} catch (e) {
  console.log("Failure: input file does not exist!");
  process.exit(1);
}

// encrypt input
const encryptedMessage = encode(contents, passphrase, salt);

// create crypto-js tag (embedded or not)
let cryptoTag = SCRIPT_TAG;
if (namedArgs.embed) {
  try {
    const embedContents = fs.readFileSync(
      path.join(__dirname, "crypto-js.min.js"),
      "utf8"
    );

    cryptoTag = "<script>" + embedContents + "</script>";
  } catch (e) {
    console.log("Failure: embed file does not exist!");
    process.exit(1);
  }
}

const data = {
  codec_iif: transcludeModule("../lib/codec"),
  crypto_tag: cryptoTag,
  decrypt_button: namedArgs.decryptButton,
  embed: namedArgs.embed,
  encrypted: encryptedMessage,
  impl_iif: transcludeModule("../lib/impl-cryptojs"),
  instructions: namedArgs.instructions,
  is_remember_enabled: namedArgs.noremember ? "false" : "true",
  output_file_path:
    namedArgs.output !== null
      ? namedArgs.output
      : input.replace(/\.html$/, "") + "_encrypted.html",
  passphrase_placeholder: namedArgs.passphrasePlaceholder,
  remember_duration_in_days: namedArgs.remember,
  remember_me: namedArgs.rememberLabel,
  salt: salt,
  title: namedArgs.title,
};

genFile(data);

/**
 * Fill the template with provided data and writes it to output file.
 *
 * @param data
 */
function genFile(data) {
  let templateContents;

  try {
    templateContents = fs.readFileSync(namedArgs.f, "utf8");
  } catch (e) {
    console.log("Failure: could not read template!");
    process.exit(1);
  }

  const renderedTemplate = codec.render(templateContents, data);

  try {
    fs.writeFileSync(data.output_file_path, renderedTemplate);
  } catch (e) {
    console.log("Failure: could not generate output file!");
    process.exit(1);
  }
}
