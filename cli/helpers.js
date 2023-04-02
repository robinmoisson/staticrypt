const fs = require("fs");

const { generateRandomSalt } = require("../lib/cryptoEngine/cryptojsEngine.js");
const path = require("path");
const {renderTemplate} = require("../lib/formater.js");
const Yargs = require("yargs");

const PASSWORD_TEMPLATE_DEFAULT_PATH = path.join(__dirname, "..", "lib", "password_template.html");


/**
 * @param {string} message
 */
function exitWithError(message) {
    console.log("ERROR: " + message);
    process.exit(1);
}
exports.exitWithError = exitWithError;

/**
 * Check if a particular option has been set by the user. Useful for distinguishing default value with flag without
 * parameter.
 *
 * Ex use case: '-s' means "give me a salt", '-s 1234' means "use 1234 as salt"
 *
 * From https://github.com/yargs/yargs/issues/513#issuecomment-221412008
 *
 * @param {string} option
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
exports.isOptionSetByUser = isOptionSetByUser;

/**
 * Get the password from the command arguments
 *
 * @param {string[]} positionalArguments
 * @returns {string}
 */
function getPassword(positionalArguments) {
    let password = process.env.STATICRYPT_PASSWORD;
    const hasEnvPassword = password !== undefined && password !== "";

    if (hasEnvPassword) {
        return password;
    }

    if (positionalArguments.length < 2) {
        exitWithError("missing password, please provide an argument or set the STATICRYPT_PASSWORD environment variable in the environment or .env file");
    }

    return positionalArguments[1].toString();
}
exports.getPassword = getPassword;

/**
 * @param {string} filepath
 * @returns {string}
 */
function getFileContent(filepath) {
    try {
        return fs.readFileSync(filepath, "utf8");
    } catch (e) {
        exitWithError("input file does not exist!");
    }
}
exports.getFileContent = getFileContent;

/**
 * @param {object} namedArgs
 * @param {object} config
 * @returns {string}
 */
function getSalt(namedArgs, config) {
    // either a salt was provided by the user through the flag --salt
    if (!!namedArgs.salt) {
        return String(namedArgs.salt).toLowerCase();
    }

    // or try to read the salt from config file
    if (config.salt) {
        return config.salt;
    }

    return generateRandomSalt();
}
exports.getSalt = getSalt;

/**
 * A dead-simple alternative to webpack or rollup for inlining simple
 * CommonJS modules in a browser <script>.
 * - Removes all lines containing require().
 * - Wraps the module in an immediately invoked function that returns `exports`.
 *
 * @param {string} modulePath - path from staticrypt root directory
 */
function convertCommonJSToBrowserJS(modulePath) {
    const rootDirectory = path.join(__dirname, '..');
    const resolvedPath = path.join(rootDirectory, ...modulePath.split("/")) + ".js";

    if (!fs.existsSync(resolvedPath)) {
        exitWithError(`could not find module to convert at path "${resolvedPath}"`);
    }

    const moduleText = fs
        .readFileSync(resolvedPath, "utf8")
        .replace(/^.*\brequire\(.*$\n/gm, "");

    return `
((function(){
  const exports = {};
  ${moduleText}
  return exports;
})())
  `.trim();
}
exports.convertCommonJSToBrowserJS = convertCommonJSToBrowserJS;

/**
 * @param {string} filePath
 * @param {string} errorName
 * @returns {string}
 */
function readFile(filePath, errorName = file) {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        exitWithError(`could not read ${errorName}!`);
    }
}

/**
 * Fill the template with provided data and writes it to output file.
 *
 * @param {Object} data
 * @param {string} outputFilePath
 * @param {string} templateFilePath
 */
function genFile(data, outputFilePath, templateFilePath) {
    const templateContents = readFile(templateFilePath, "template");

    const renderedTemplate = renderTemplate(templateContents, data);

    try {
        fs.writeFileSync(outputFilePath, renderedTemplate);
    } catch (e) {
        exitWithError("could not generate output file!");
    }
}
exports.genFile = genFile;

/**
 * TODO: remove in next major version
 *
 * This method checks whether the password template support the security fix increasing PBKDF2 iterations. Users using
 * an old custom password_template might have logic that doesn't benefit from the fix.
 *
 * @param {string} templatePathParameter
 * @returns {boolean}
 */
function isCustomPasswordTemplateLegacy(templatePathParameter) {
    const customTemplateContent = readFile(templatePathParameter, "template");

    // if the template injects the crypto engine, it's up to date
    return !customTemplateContent.includes("js_crypto_engine");
}
exports.isCustomPasswordTemplateLegacy = isCustomPasswordTemplateLegacy;

/**
 * TODO: remove in next major version
 *
 * This method checks whether the password template support the async logic.
 *
 * @param {string} templatePathParameter
 * @returns {boolean}
 */
function isPasswordTemplateUsingAsync(templatePathParameter) {
    const customTemplateContent = readFile(templatePathParameter, "template");

    // if the template includes this comment, it's up to date
    return customTemplateContent.includes("// STATICRYPT_VERSION: async");
}
exports.isPasswordTemplateUsingAsync = isPasswordTemplateUsingAsync;

/**
 * @param {string} templatePathParameter
 * @returns {boolean}
 */
function isCustomPasswordTemplateDefault(templatePathParameter) {
    // if the user uses the default template, it's up to date
    return templatePathParameter === PASSWORD_TEMPLATE_DEFAULT_PATH;
}
exports.isCustomPasswordTemplateDefault = isCustomPasswordTemplateDefault;

function parseCommandLineArguments() {
    return Yargs.usage("Usage: staticrypt <filename> [<password>] [options]")
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
            describe: "Whether or not to embed crypto-js in the page (or use an external CDN).",
            default: true,
        })
        .option("engine", {
            type: "string",
            describe: "The crypto engine to use. WebCrypto uses 600k iterations and is more secure, CryptoJS 15k.\n" +
                "Possible values: 'cryptojs', 'webcrypto'.",
            default: "cryptojs",
        })
        .option("f", {
            alias: "file-template",
            type: "string",
            describe: "Path to custom HTML template with password prompt.",
            default: PASSWORD_TEMPLATE_DEFAULT_PATH,
        })
        .option("i", {
            alias: "instructions",
            type: "string",
            describe: "Special instructions to display to the user.",
            default: "",
        })
        .option("label-error", {
            type: "string",
            describe: "Error message to display on entering wrong password.",
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
            describe: "Placeholder to use for the password input.",
            default: "Password",
        })
        .option("r", {
            alias: "remember",
            type: "number",
            describe:
                'Expiration in days of the "Remember me" checkbox that will save the (salted + hashed) password ' +
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
                + '"#staticrypt_pwd=<hashed_pwd>", or leave empty to display the hash to append.',
            type: "string",
        })
        .option("short", {
            describe: 'Hide the "short password" warning.',
            type: "boolean",
            default: false,
        })
        .option("t", {
            alias: "title",
            type: "string",
            describe: "Title for the output HTML page.",
            default: "Protected Page",
        });
}
exports.parseCommandLineArguments = parseCommandLineArguments;
