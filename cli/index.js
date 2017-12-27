#!/usr/bin/env node

'use strict';

var CryptoJS = require("crypto-js");
var FileSystem = require("fs");
const Yargs = require('yargs');

const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js';
const SCRIPT_TAG = '<script src="' + SCRIPT_URL + '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

const namedArgs = Yargs
      .usage('staticrypt <input> <password> options')
      .demandCommand(2)
      .default({'output': null, 'title': null, 'instructions': null, 'embed': null})
      .alias('o', 'output')
      .alias('t', 'title')
      .alias('i', 'instructions')
      .alias('e', 'embed')
      .argv;

if(namedArgs._.length != 2){
    Yargs.showHelp();
    process.exit(1);
}

const input = namedArgs._[0];
const password = namedArgs._[1];

try{
    var contents = FileSystem.readFileSync(input, 'utf8');
}catch(e){
    console.log("Failure: input file does not exist!");
    process.exit(1);
}

var encrypted = CryptoJS.AES.encrypt(contents, password);
var hmac = CryptoJS.HmacSHA256(encrypted.toString(), CryptoJS.SHA256(password).toString()).toString();
var encryptedMessage = hmac + encrypted;

var data = {
    title: namedArgs.title != null ? namedArgs.title : "Protected Page",
    instructions: namedArgs.instructions != null ? namedArgs.instructions : "",
    encrypted: encryptedMessage,
    crypto_tag: SCRIPT_TAG,
    embed: namedArgs.embed != null ? namedArgs.embed : false,
    outputFilePath: namedArgs.output != null ? namedArgs.output : input.replace(/\.html$/, '') + "_encrypted.html"
};

if(data.embed){
    try{
        var embedContents = FileSystem.readFileSync('crypto-js.min.js', 'utf8');
        data["crypto_tag"] = '<script>' + embedContents + '</script>';
        genFile(data);
    }catch(e){
        console.log("Failure: embed file does not exist!");
        process.exit(1);
    }
}else{
    genFile(data);
}

function genFile(data){
    try{
        var templateContents = FileSystem.readFileSync(__dirname + '/password_template.html', 'utf8');
    }catch(e){
        console.log("Failure: could not read template!");
        process.exit(1);
    }

    var renderedTemplate = render(templateContents, data);

    try{
        FileSystem.writeFileSync(data.outputFilePath, renderedTemplate);
    }catch(e){
        console.log("Failure: could not generate output file!");
        process.exit(1);
    }
}

function render(tpl, data){
    return tpl.replace(/{(.*?)}/g, function (_, key) {
        return data && data[key] || '';
    });
}
