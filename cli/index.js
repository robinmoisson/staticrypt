#!/usr/bin/env node

'use strict';

const { subtle, getRandomValues } = require('crypto').webcrypto;
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const { usage, showHelp } = require('yargs');

const namedArgs = usage('Usage: staticrypt <filename> <passphrase> [options]')
      .demandCommand(2)
      .option('o', {
          alias: 'output',
          type: 'string',
          describe: 'File name / path for generated encrypted file',
          default: null
      })
      .option('t', {
          alias: 'title',
          type: 'string',
          describe: "Title for output HTML page",
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
          default: join(__dirname, 'password_template.html')
      })
      .argv;

if(namedArgs._.length !== 2){
    showHelp();
    process.exit(1);
}

const input = namedArgs._[0].toString();
const password = namedArgs._[1].toString();

try{
    var contents = readFileSync(input, 'utf8');
}catch(e){
    console.log("Failure: input file does not exist!");
    process.exit(1);
}

function encrypt (msg, password) {
    var iv = getRandomValues(new Uint8Array(16));
    var ivHex = bytesToHexString(iv);
    var pwUtf8 = stringToUint8Array(password);

    subtle.digest('SHA-256', pwUtf8)
    .then(function(hash) {
        return bytesToHexString(hash);
    })
    .then(function(pwHex) {
    return hexStringToUint8Array(pwHex);
    })
    .then(function(keyData) {
    return subtle.importKey("raw", keyData, "AES-GCM", false, ["encrypt"]);
    })
    .then(function(key) {
        return subtle.encrypt({
            name: "AES-GCM",
            iv: iv
        }, key, stringToUint8Array(msg));
    })
    .then(function(cipherText) {
        return ivHex + bytesToHexString(cipherText);
    })
    .then(function(encrypted) {
        return {
            title: namedArgs.title,
            instructions: namedArgs.instructions,
            encrypted: encrypted,
            outputFilePath: namedArgs.output !== null ? namedArgs.output : input.replace(/\.html$/, '') + "_encrypted.html"
        };
    })
    .then(function(data) {
        genFile(data);
    })
    .catch(console.log);
}

encrypt(contents, password)

/**
 * Fill the template with provided data and writes it to output file.
 *
 * @param data
 */
function genFile(data){
    try{
        var templateContents = readFileSync(namedArgs.f, 'utf8');
    }catch(e){
        console.log("Failure: could not read template!");
        process.exit(1);
    }

    var renderedTemplate = render(templateContents, data);

    try{
        writeFileSync(data.outputFilePath, renderedTemplate);
    }catch(e){
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
function render(tpl, data){
    return tpl.replace(/{(.*?)}/g, function (_, key) {
        return data && data[key] || '';
    });
}

/*
* encode/decode funtions
*/

function hexStringToUint8Array(hexString) {
    if (hexString.length % 2 != 0)
        throw "Invalid hexString";
    var arrayBuffer = new Uint8Array(hexString.length / 2);

    for (var i = 0; i < hexString.length; i += 2) {
        var byteValue = parseInt(hexString.substr(i, 2), 16);
        if (byteValue == NaN)
            throw "Invalid hexString";
        arrayBuffer[i / 2] = byteValue;
    }

    return arrayBuffer;
}

function bytesToHexString(bytes) {
    if (!bytes)
        return null;

    bytes = new Uint8Array(bytes);
    var hexBytes = [];

    for (var i = 0; i < bytes.length; ++i) {
        var byteString = bytes[i].toString(16);
        if (byteString.length < 2)
            byteString = "0" + byteString;
        hexBytes.push(byteString);
    }
    return hexBytes.join("");
}

function stringToUint8Array(str) {
    var encoder = new TextEncoder('utf-8');
    return encoder.encode(str);
}