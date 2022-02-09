#!/usr/bin/env node

'use strict';

var CryptoJS = require("crypto-js");
var FileSystem = require("fs");
const path = require("path");
const Yargs = require('yargs');

const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js';
const SCRIPT_TAG = '<script src="' + SCRIPT_URL + '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

const namedArgs = Yargs
    .usage('Usage: staticrypt <filename> <passphrase> [options]')
    .demandCommand(2)
    .option('e', {
        alias: 'embed',
        type: 'boolean',
        describe: 'Whether or not to embed crypto-js in the page (or use an external CDN).',
        default: true
    })
    .option('o', {
        alias: 'output',
        type: 'string',
        describe: 'File name / path for generated encrypted file.',
        default: null
    })
    .option('t', {
        alias: 'title',
        type: 'string',
        describe: "Title for output HTML page.",
        default: 'Protected Page'
    })
    .option('i', {
        alias: 'instructions',
        type: 'string',
        describe: 'Special instructions to display to the user.',
        default: ''
    })
    .option('f', {
        alias: 'file-template',
        type: 'string',
        describe: 'Path to custom HTML template with password prompt.',
        default: path.join(__dirname, 'password_template.html')
    })
    // do not give a default option to this 'remember' parameter - we want to see when the flag is included with no
    // value and when it's not included at all
    .option('r', {
        alias: 'remember',
        type: 'number',
        describe: 'Show a "Remember me" checkbox that will save the password in clear text in localStorage when entered by the user.\nYou can set the expiration in days as value (no value means "0", no expiration).',
    })
    .option('remember-label', {
        type: 'string',
        describe: 'Label to use for the "Remember me" checkbox. Default: "Remember me".',
        default: 'Remember me'
    })
    .option('passphrase-placeholder', {
        type: 'string',
        describe: 'Placeholder to use for the passphrase input. Default: "Passphrase".',
        default: 'Passphrase'
    })
    .option('decrypt-button', {
        type: 'string',
        describe: 'Label to use for the decrypt button. Default: "DECRYPT".',
        default: 'DECRYPT'
    })
    .argv;

if (namedArgs._.length !== 2) {
    Yargs.showHelp();
    process.exit(1);
}

const input = namedArgs._[0].toString();
const password = namedArgs._[1].toString();

try {
    var contents = FileSystem.readFileSync(input, 'utf8');
} catch (e) {
    console.log("Failure: input file does not exist!");
    process.exit(1);
}

/**
 * Salt and encrypt a msg with a password.
 * Inspired by https://github.com/adonespitogo
 */
var keySize = 256;
var iterations = 1000;

function encrypt(msg, password) {
    var salt = CryptoJS.lib.WordArray.random(128 / 8);

    var key = CryptoJS.PBKDF2(password, salt, {
        keySize: keySize / 32,
        iterations: iterations
    });

    var iv = CryptoJS.lib.WordArray.random(128 / 8);

    var encrypted = CryptoJS.AES.encrypt(msg, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
    });

    // salt, iv will be hex 32 in length
    // append them to the ciphertext for use  in decryption
    return salt.toString() + iv.toString() + encrypted.toString();
}

// encrypt input
var encrypted = encrypt(contents, password);
var hmac = CryptoJS.HmacSHA256(encrypted, CryptoJS.SHA256(password).toString()).toString();
var encryptedMessage = hmac + encrypted;

// create crypto-js tag (embedded or not)
var cryptoTag = SCRIPT_TAG;
if (namedArgs.embed) {
    try {
        var embedContents = FileSystem.readFileSync(path.join(__dirname, 'crypto-js.min.js'), 'utf8');
    } catch (e) {
        console.log("Failure: embed file does not exist!");
        process.exit(1);
    }
    cryptoTag = '<script>' + embedContents + '</script>';
}

console.log(JSON.stringify(namedArgs, null, 2))

// The "--remember" flag has a specific behavior: if the flag is included without value (like '-r'), the key is set with
// the value 'undefined'. If it is included with a value, ('-r 100'), the key is set with that value. Both means
// remember is enabled. If the flag is omitted by the user the key isn't set, meaning remember is disabled.
const isRememberEnabled = 'remember' in namedArgs;
// give a default value here instead of in the yargs config, so we can distinguish when the flag is included with no
// value from when the flag isn't included
const rememberDurationInDays = namedArgs.remember || 0;

var data = {
    crypto_tag: cryptoTag,
    embed: namedArgs.embed,
    encrypted: encryptedMessage,
    instructions: namedArgs.instructions,
    is_remember_enabled: isRememberEnabled,
    output_file_path: namedArgs.output !== null ? namedArgs.output : input.replace(/\.html$/, '') + "_encrypted.html",
    passphrase_placeholder: namedArgs["passphrase-placeholder"],
    remember_duration_in_days: rememberDurationInDays,
    remember_me: namedArgs["remember-label"],
    title: namedArgs.title,
};

genFile(data);


/**
 * Fill the template with provided data and writes it to output file.
 *
 * @param data
 */
function genFile(data) {
    try {
        var templateContents = FileSystem.readFileSync(namedArgs.f, 'utf8');
    } catch (e) {
        console.log("Failure: could not read template!");
        process.exit(1);
    }

    var renderedTemplate = render(templateContents, data);

    try {
        FileSystem.writeFileSync(data.output_file_path, renderedTemplate);
    } catch (e) {
        console.log("Failure: could not generate output file!");
        process.exit(1);
    }
}

/**
 * Replace the placeholder tags (between '{tag}') in 'tpl' string with provided data.
 *
 * @param tpl
 * @param data
 * @returns string
 */
function render(tpl, data) {
    return tpl.replace(/{(.*?)}/g, function (_, key) {
        return data && data[key] || '';
    });
}
