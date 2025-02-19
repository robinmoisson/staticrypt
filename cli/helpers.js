const pathModule = require("path");
const fs = require("fs");
const readline = require("readline");

const { generateRandomSalt, generateRandomString } = require("../lib/cryptoEngine.js");
const { renderTemplate } = require("../lib/formater.js");
const Yargs = require("yargs");

const PASSWORD_TEMPLATE_DEFAULT_PATH = pathModule.join(__dirname, "..", "lib", "password_template.html");
const OUTPUT_DIRECTORY_DEFAULT_PATH = "encrypted";
exports.OUTPUT_DIRECTORY_DEFAULT_PATH = OUTPUT_DIRECTORY_DEFAULT_PATH;

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

        if (searchForOption(`-${alias}`) || searchForOption(`--${alias}`)) {
            return true;
        }
    }

    return false;
}
exports.isOptionSetByUser = isOptionSetByUser;

/**
 * Prompts the user for input on the CLI.
 *
 * @param {string} question
 * @returns {Promise<string>}
 */
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        return rl.question(question, (answer) => {
            rl.close();
            return resolve(answer);
        });
    });
}

/**
 * @param {string} password
 * @param {boolean} isShortAllowed
 * @returns {Promise<void>}
 */
async function validatePassword(password, isShortAllowed) {
    if (password.length < 14 && !isShortAllowed) {
        const shouldUseShort = await prompt(
            `WARNING: Your password is less than 14 characters (length: ${password.length})` +
                " and it's easy to try brute-forcing on public files, so we recommend using a longer one. Here's a generated one: " +
                generateRandomString(21) +
                "\nYou can hide this warning by increasing your password length or adding the '--short' flag." +
                "\nDo you want to still want to use the shorter password? [y/N] "
        );

        if (!shouldUseShort.match(/^\s*(y|yes)\s*$/i)) {
            console.log("Aborting.");
            process.exit(0);
        }
    }
}
exports.validatePassword = validatePassword;

/**
 * Get the config from the config file.
 *
 * @param {string|null} configPath
 * @returns {{}|object}
 */
function getConfig(configPath) {
    if (configPath && fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    return {};
}
exports.getConfig = getConfig;

function writeConfig(configPath, config) {
    if (configPath) {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    }
}
exports.writeConfig = writeConfig;

/**
 * Get the password from the command arguments or environment variables.
 *
 * @param {string} passwordArgument - password from the command line
 * @returns {Promise<string>}
 */
async function getPassword(passwordArgument) {
    // try to get the password from the environment variable
    const envPassword = process.env.STATICRYPT_PASSWORD;
    const hasEnvPassword = envPassword !== undefined && envPassword !== "";
    if (hasEnvPassword) {
        return envPassword;
    }

    // try to get the password from the command line arguments
    if (passwordArgument !== null) {
        return passwordArgument;
    }

    // prompt the user for their password
    return prompt("Enter your long, unusual password: ");
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
        exitWithError(`input file '${filepath}' does not exist!`);
    }
}
exports.getFileContent = getFileContent;

/**
 * @param {object} namedArgs
 * @param {object} config
 * @returns {string}
 */
function getValidatedSalt(namedArgs, config) {
    const salt = getSalt(namedArgs, config);

    // validate the salt
    if (salt.length !== 32 || /[^a-f0-9]/.test(salt)) {
        exitWithError(
            "the salt should be a 32 character long hexadecimal string (only [0-9a-f] characters allowed)" +
                "\nDetected salt: " +
                salt
        );
    }

    return salt;
}
exports.getValidatedSalt = getValidatedSalt;

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

/**
 * A dead-simple alternative to webpack or rollup for inlining simple
 * CommonJS modules in a browser <script>.
 * - Removes all lines containing require().
 * - Wraps the module in an immediately invoked function that returns `exports`.
 *
 * @param {string} modulePath - path from staticrypt root directory
 */
function convertCommonJSToBrowserJS(modulePath) {
    const rootDirectory = pathModule.join(__dirname, "..");
    const resolvedPath = pathModule.join(rootDirectory, ...modulePath.split("/")) + ".js";

    if (!fs.existsSync(resolvedPath)) {
        exitWithError(`could not find module to convert at path "${resolvedPath}"`);
    }

    const moduleText = fs.readFileSync(resolvedPath, "utf8").replace(/^.*\brequire\(.*$\n/gm, "");

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
 * Build the staticrypt script string to inject in our template.
 *
 * @returns {string}
 */
function buildStaticryptJS() {
    let staticryptJS = convertCommonJSToBrowserJS("lib/staticryptJs");

    const scriptsToInject = {
        js_codec: convertCommonJSToBrowserJS("lib/codec"),
        js_crypto_engine: convertCommonJSToBrowserJS("lib/cryptoEngine"),
    };

    return renderTemplate(staticryptJS, scriptsToInject);
}
exports.buildStaticryptJS = buildStaticryptJS;

/**
 * @param {string} filePath
 * @param {string} errorName
 * @returns {string}
 */
function readFile(filePath, errorName = "file") {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        console.error(e);
        exitWithError(`could not read ${errorName} at path "${filePath}"`);
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

    writeFile(outputFilePath, renderedTemplate);
}
exports.genFile = genFile;

/**
 * @param {string} path
 * @param {string} fullRootDirectory
 * @param {string} outputDirectory
 * @returns {string}
 */
function getFullOutputPath(path, fullRootDirectory, outputDirectory) {
    const relativePath = pathModule.relative(fullRootDirectory, path);
    return outputDirectory + "/" + relativePath;
}
exports.getFullOutputPath = getFullOutputPath;

/**
 * @param {string} inputFilePath
 * @param {string} outputFilePath
 */
function copyFile(inputFilePath, outputFilePath) {
    // create output directory if it does not exist
    createDirectoryStructureForFile(outputFilePath);

    try {
        fs.copyFileSync(inputFilePath, outputFilePath, fs.constants.COPYFILE_FICLONE);
    } catch (e) {
        console.error(e);
        exitWithError(`could not write file at path "${filePath}"`);
    }
}

/**
 * @param {string} filePath
 * @param {string} contents
 */
function writeFile(filePath, contents) {
    // create output directory if it does not exist
    createDirectoryStructureForFile(filePath);

    try {
        fs.writeFileSync(filePath, contents);
    } catch (e) {
        console.error(e);
        exitWithError(`could not write file at path "${filePath}"`);
    }
}
exports.writeFile = writeFile;

/**
 * @param {string} filePath
 */
function createDirectoryStructureForFile(filePath) {
    const dirname = pathModule.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
}

/**
 * @param {string} templatePathParameter
 * @returns {boolean}
 */
function isCustomPasswordTemplateDefault(templatePathParameter) {
    // if the user uses the default template, it's up to date
    return templatePathParameter === PASSWORD_TEMPLATE_DEFAULT_PATH;
}
exports.isCustomPasswordTemplateDefault = isCustomPasswordTemplateDefault;

/**
 * @param {string} path
 * @param {string} outputDirectory
 * @param {string} rootDirectory
 * @param {(fullPath: string, rootDirectoryFromArgument: string) => void} callback
 */
function recursivelyApplyCallbackToHtmlFiles(callback, path, outputDirectory, rootDirectory = "") {
    const fullPath = pathModule.resolve(path);
    const fullRootDirectory = rootDirectory || pathModule.dirname(fullPath);

    if (fs.statSync(fullPath).isDirectory()) {
        fs.readdirSync(fullPath).forEach((filePath) => {
            const fullFilePath = `${fullPath}/${filePath}`;

            recursivelyApplyCallbackToHtmlFiles(callback, fullFilePath, outputDirectory, fullRootDirectory);
        });
        return;
    }

    // apply the callback if it's an HTML file
    if (fullPath.endsWith(".html") || fullPath.endsWith(".htm")) {
        callback(fullPath, fullRootDirectory);
    }
    // else just copy the file as is
    else {
        const fullOutputPath = getFullOutputPath(fullPath, fullRootDirectory, outputDirectory);
        copyFile(fullPath, fullOutputPath);
    }
}
exports.recursivelyApplyCallbackToHtmlFiles = recursivelyApplyCallbackToHtmlFiles;

function parseCommandLineArguments() {
    return (
        Yargs.usage("Usage: staticrypt <filename> [<filename> ...] [options]")
            .option("c", {
                alias: "config",
                type: "string",
                describe: 'Path to the config file. Set to "false" to disable.',
                default: ".staticrypt.json",
            })
            .option("d", {
                alias: "directory",
                type: "string",
                describe:
                    "Name of the directory where the generated files will be saved. If the '--decrypt' flag is " +
                    "set, default will be 'decrypted'.",
                default: OUTPUT_DIRECTORY_DEFAULT_PATH,
            })
            .option("decrypt", {
                type: "boolean",
                describe: "Include this flag to decrypt files instead of encrypt.",
                default: false,
            })
            .option("p", {
                alias: "password",
                type: "string",
                describe:
                    "The password to encrypt your file with. Leave empty to be prompted for it. If STATICRYPT_PASSWORD" +
                    " is set in the env, we'll use that instead.",
                default: null,
            })
            .option("r", {
                alias: "recursive",
                type: "boolean",
                describe: "Whether to recursively encrypt the input directory.",
                default: false,
            })
            .option("remember", {
                describe:
                    'Integer: expiration in days of the "Remember me" checkbox that will save the (salted + hashed) password ' +
                    'in localStorage when entered by the user. Set to "false" to hide the box. Default: "0", no expiration.',
                default: 0,
            })
            // do not give a default option to this parameter - we want to see when the flag is included with no
            // value and when it's not included at all
            .option("s", {
                alias: "salt",
                describe:
                    "Generate a config file or set the salt manually. Pass a 32-character-long hexadecimal string " +
                    "to use as salt, or leave empty to generate, display and save to config a random salt. This won't" +
                    " overwrite an existing config file.",
                type: "string",
            })
            // do not give a default option to this parameter - we want to see when the flag is included with no
            // value and when it's not included at all
            .option("share", {
                describe:
                    "Get a link containing your hashed password that will auto-decrypt the page. Pass your URL as a value to append " +
                    '"#staticrypt_pwd=<hashed_pwd>", or leave empty to display the hash to append.',
                type: "string",
            })
            .option("share-remember", {
                type: "boolean",
                describe: "Whether the share link should auto-enable 'Remember-me'.",
                default: false,
            })
            .option("short", {
                describe: 'Hide the "short password" warning.',
                type: "boolean",
                default: false,
            })
            .option("t", {
                alias: "template",
                type: "string",
                describe: "Path to custom HTML template with password prompt.",
                default: PASSWORD_TEMPLATE_DEFAULT_PATH,
            })
            .option("template-button", {
                type: "string",
                describe: 'Label to use for the decrypt button. Default: "DECRYPT".',
                default: "DECRYPT",
            })
            .option("template-color-primary", {
                type: "string",
                describe: "Primary color (button...)",
                default: "#4CAF50",
            })
            .option("template-color-secondary", {
                type: "string",
                describe: "Secondary color (page background...)",
                default: "#76B852",
            })
            .option("template-instructions", {
                type: "string",
                describe: "Special instructions to display to the user.",
                default: "",
            })
            .option("template-error", {
                type: "string",
                describe: "Error message to display on entering wrong password.",
                default: "Bad password!",
            })
            .option("template-placeholder", {
                type: "string",
                describe: "Placeholder to use for the password input.",
                default: "Password",
            })
            .option("template-remember", {
                type: "string",
                describe: 'Label to use for the "Remember me" checkbox.',
                default: "Remember me",
            })
            .option("template-title", {
                type: "string",
                describe: "Title for the output HTML page.",
                default: "Protected Page",
            })
            .option("template-toggle-hide", {
                type: "string",
                describe: 'Alt text for toggling password visibility - "hide" action.',
                default: "Hide password",
            })
            .option("template-toggle-show", {
                type: "string",
                describe: 'Alt text for toggling password visibility - "show" action.',
                default: "Show password",
            })
    );
}
exports.parseCommandLineArguments = parseCommandLineArguments;
