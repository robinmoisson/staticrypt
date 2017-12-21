#!/usr/bin/env node

'use strict';

var CryptoJS = require("crypto-js");
var FileSystem = require("fs");

const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js';
const SCRIPT_TAG = '<script src="' + SCRIPT_URL + '" integrity="sha384-lp4k1VRKPU9eBnPePjnJ9M2RF3i7PC30gXs70+elCVfgwLwx1tv5+ctxdtwxqZa7" crossorigin="anonymous"></script>';

const namedArgs = parseArgs(process.argv, process.argv.length);

try{
    var contents = FileSystem.readFileSync(namedArgs.input, 'utf8');
}catch(e){
    console.log("Failure: input file does not exist!");
    process.exit(1);
}

var encrypted = CryptoJS.AES.encrypt(contents, namedArgs.password);
var hmac = CryptoJS.HmacSHA256(encrypted.toString(), CryptoJS.SHA256(namedArgs.password).toString()).toString();
var encryptedMessage = hmac + encrypted;

var data = {
    title: namedArgs.title != null ? namedArgs.title : "Protected Page",
    instructions: namedArgs.instructions != null ? namedArgs.instructions : "",
    encrypted: encryptedMessage,
    crypto_tag: SCRIPT_TAG,
    embed: namedArgs.embed != null ? namedArgs.embed : false,
    outputFilePath: namedArgs.output != null ? namedArgs.output : namedArgs.input.replace(/\.html$/, '') + "_encrypted.html"
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

function parseArgs(argv, argc){
    var argList = {
        required: {
            "input": false,
            "password": false
        },
        optional: {
            "output": false,
            "title": false,
            "instructions" : false,
            "embed": false
        }
    };

    var namedArgs = {};

    // parse through args
    for(var i = 2; i < argc; ++i){
        var pieces = argv[i].split('=');
        if(pieces.length != 2){
            console.log("Failure: invalid argument '" + argv[i] + "'");
            usage();
            process.exit(1);
        }else{
            const name = pieces[0];

            if(argList.required[name] == true){
                // duplicate
                console.log("Failure: duplicate argument '" + name + "'");
                process.exit(1);
            }else if(argList.required[name] == false){
                // valid
                namedArgs[name] = pieces[1];
                argList.required[name] = true;
            }else if(argList.optional[name] == true){
                // duplicate
                console.log("Failure: duplicate argument '" + name + "'");
                process.exit(1);
            }else if(argList.optional[name] == false){
                // valid
                namedArgs[name] = pieces[1];
                argList.optional[name] = true;
            }else{
                // unknown argument
                console.log("Failure: unknown argument '" + name + "'");
                usage();
                process.exit(1);
            }
        }
    }

    // make sure all required args are present
    for(var argName in argList.required){
        if(argList.required[argName] == false){
            console.log("Failure: missing required argument '" + argName + "'");
            usage();
            process.exit(1);
        }
    }

    // validate password length
    if(namedArgs.password.length < 5){
        console.log("Failure: password length less than 5");
        process.exit(1);
    }

    return namedArgs;
}

function usage(){
    console.log("Staticrypt arguments:");
    console.log("  Required:");
    console.log("    input: Path to input HTML file.");
    console.log("    password: Password with which to encrypt the file");
    console.log("  Optional:");
    // output, title, instructions, embed
    console.log("    output: File name / path for generated encrypted file.  Default is <input file name>.encrypted.");
    console.log("    title: Title for output HTML page.  Default is 'Protected Page'.");
    console.log("    instructions: Special instructions to display to ther user.  Default is none.");
    console.log("    embed: Whether or not to embed crypto-js in the page or use an external CDN.  Default is false.");
}
