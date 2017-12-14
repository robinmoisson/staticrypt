'use strict';

var CryptoJS = require("crypto-js");
var FileSystem = require("fs");
var https = require("https");

const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js';
const SCRIPT_TAG = '<script src="' + SCRIPT_URL + '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

const argv = process.argv;
const argc = process.argv.length;

if(argc < 4 || argc > 7){
    console.log("Failure: invalid argument length!");
    process.exit(1);
}

const htmlFilepath = argv[2];
const outputFilePath = htmlFilepath + ".encrypted";

const password = argv[3];

var pageTitle = "Protected Page";
if(argc >= 5){
    pageTitle = argv[4];
}

var instructions = "";
if(argc >= 6){
    instructions = argv[5];
}

var embed = true;
if(argc >= 7){
    embed = (argv[6] == 'true');
}

try{
    var contents = FileSystem.readFileSync(htmlFilepath, 'utf8');
}catch(e){
    console.log("Failure: file does not exist!");
    process.exit(1);
}

var encrypted = CryptoJS.AES.encrypt(contents, password);
var hmac = CryptoJS.HmacSHA256(encrypted.toString(), CryptoJS.SHA256(password)).toString();
var encryptedMessage = hmac + encrypted;

var data = {
    title: pageTitle,
    instructions: instructions,
    encrypted: encryptedMessage,
    crypto_tag: SCRIPT_TAG,
    embed: embed,
    outputFilePath: outputFilePath
};

if(data.embed){
    https.get(SCRIPT_URL, (resp) => {
        let txt = '';

        resp.on('data', (chunk) => {
            txt += chunk;
        });

        resp.on('end', () => {
            data["crypto_tag"] = '<script>' + txt + '</script>';
            console.log(data);
            genFile(data);
        });

    }).on('error', (err) => {
        console.log("Failure: could not fetch embedded script");
        process.exit(1);
    });
}else{
    genFile(data);
}

function genFile(data){
    try{
        var templateContents = FileSystem.readFileSync('./password_template.html', 'utf8');
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
