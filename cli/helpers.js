const fs = require("fs");

const cryptoEngine = require("../lib/cryptoEngine/cryptojsEngine");
const { generateRandomSalt } = cryptoEngine;

/**
 * @param {string} message
 */
function exitEarly(message) {
    console.log(message);
    process.exit(1);
}
exports.exitEarly = exitEarly;

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
        exitEarly("Missing password: please provide an argument or set the STATICRYPT_PASSWORD environment variable in the environment or .env file");
    }

    return positionalArguments[1];
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
        exitEarly("Failure: input file does not exist!");
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
