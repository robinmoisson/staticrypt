#!/usr/bin/env node

'use strict';

var CryptoJS = require("crypto-js");
var FileSystem = require("fs");
const path = require("path");
const Yargs = require('yargs');

const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js';
const SCRIPT_TAG = '<script src="' + SCRIPT_URL + '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

/**
 * Salt and encrypt a msg with a password.
 * Inspired by https://github.com/adonespitogo
 */
function encrypt(msg, hashedPassphrase) {
    var iv = CryptoJS.lib.WordArray.random(128 / 8);

    var encrypted = CryptoJS.AES.encrypt(msg, hashedPassphrase, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
    });

    // iv will be hex 16 in length (32 characters)
    // we prepend it to the ciphertext for use in decryption
    return iv.toString() + encrypted.toString();
}

/**
 * Salt and hash the passphrase so it can be stored in localStorage without opening a password reuse vulnerability.
 *
 * @param {string} passphrase
 * @returns {{salt: string, hashedPassphrase: string}}
 */
function hashPassphrase(passphrase, salt) {
    var hashedPassphrase = CryptoJS.PBKDF2(passphrase, salt, {
        keySize: 256 / 32,
        iterations: 1000
    });

    return {
        salt: salt,
        hashedPassphrase: hashedPassphrase.toString(),
    };
}

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
        describe: 'Path to custom HTML template with passphrase prompt.',
        default: path.join(__dirname, 'password_template.html')
    })
    .option('r', {
        alias: 'remember',
        type: 'number',
        describe: 'Show a "Remember me" checkbox that will save the (salted + hashed) passphrase in localStorage when entered by the user.\nYou can set the expiration in days as value (no value means "0", no expiration).',
        default: 0,
    })
    .option('noremember', {
        type: 'boolean',
        describe: 'Set this flag to remove the "Remember me" checkbox.',
        default: false,
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
    .option('salt', {
        type: 'string',
        describe: 'Set the salt manually, should be set if you want use "Remeber me" through multiple pages.',
        default: null
    })
    .option('decrypt-button', {
        type: 'string',
        describe: 'Label to use for the decrypt button. Default: "DECRYPT".',
        default: 'DECRYPT'
    }).argv;

if (namedArgs._.length !== 2) {
    Yargs.showHelp();
    process.exit(1);
}

// parse input
const input = namedArgs._[0].toString(),
    passphrase = namedArgs._[1].toString();

// get the file content
let contents;
try {
    contents = FileSystem.readFileSync(input, 'utf8');
} catch (e) {
    console.log("Failure: input file does not exist!");
    process.exit(1);
}

const salt = namedArgs.salt !== null? namedArgs.salt : CryptoJS.lib.WordArray.random(128 / 8).toString();

// encrypt input
const hashed = hashPassphrase(passphrase, salt);
const hashedPassphrase = hashed.hashedPassphrase;
const encrypted = encrypt(contents, hashedPassphrase);
// we use the hashed passphrase in the HMAC because this is effectively what will be used a passphrase (so we can store
// it in localStorage safely, we don't use the clear text passphrase)
const hmac = CryptoJS.HmacSHA256(encrypted, CryptoJS.SHA256(hashedPassphrase).toString()).toString();
const encryptedMessage = hmac + encrypted;

// create crypto-js tag (embedded or not)
let cryptoTag = SCRIPT_TAG;
if (namedArgs.embed) {
    try {
        const embedContents = FileSystem.readFileSync(path.join(__dirname, 'crypto-js.min.js'), 'utf8');

        cryptoTag = '<script>' + embedContents + '</script>';
    } catch (e) {
        console.log("Failure: embed file does not exist!");
        process.exit(1);
    }
}

const data = {
    crypto_tag: cryptoTag,
    decrypt_button: namedArgs.decryptButton,
    embed: namedArgs.embed,
    encrypted: encryptedMessage,
    instructions: namedArgs.instructions,
    is_remember_enabled: namedArgs.noremember ? 'false' : 'true',
    output_file_path: namedArgs.output !== null ? namedArgs.output : input.replace(/\.html$/, '') + "_encrypted.html",
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
        templateContents = FileSystem.readFileSync(namedArgs.f, 'utf8');
    } catch (e) {
        console.log("Failure: could not read template!");
        process.exit(1);
    }

    const renderedTemplate = render(templateContents, data);

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
        if (data && data[key] !== undefined) {
            return data[key];
        }

        return '';
    });
}
