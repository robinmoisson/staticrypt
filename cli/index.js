var CryptoJS = require("crypto-js");
var FileSystem = require("fs");

const argv = process.argv;
const argc = process.argv.length;

if(argc != 4){
    console.log("Failure: invalid argument length!");
    process.exit(1);
}

const htmlFilepath = argv[2];
const password = argv[3];

try{
    var contents = FileSystem.readFileSync(htmlFilepath, 'utf8');
}catch(e){
    console.log("Failure: file does not exist!");
    process.exit(1);
}
console.log(contents);
