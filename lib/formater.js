const path = require("path");
const fs = require("fs");
const { exitEarly } = require("../cli/helpers");

/**
 * A dead-simple alternative to webpack or rollup for inlining simple
 * CommonJS modules in a browser <script>.
 * - Removes all lines containing require().
 * - Wraps the module in an immediately invoked function that returns `exports`.
 *
 * @param {string} modulePath
 */
function convertCommonJSToBrowserJS(modulePath) {
    const resolvedPath = path.join(__dirname, ...modulePath.split("/")) + ".js";
    const moduleText = fs
        .readFileSync(resolvedPath, "utf8")
        .replaceAll(/^.*\brequire\(.*$\n/gm, "");

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
 * Replace the placeholder tags (between '{tag}') in the template string with provided data.
 *
 * @param {string} templateString
 * @param {Object} data
 *
 * @returns string
 */
function renderTemplate(templateString, data) {
    return templateString.replace(/{(.*?)}/g, function (_, key) {
        if (data && data[key] !== undefined) {
            return data[key];
        }

        return "";
    });
}
exports.renderTemplate = renderTemplate;

/**
 * Fill the template with provided data and writes it to output file.
 *
 * @param {Object} data
 * @param {string} outputFilePath
 * @param {string} inputFilePath
 */
function genFile(data, outputFilePath, inputFilePath) {
    let templateContents;

    try {
        templateContents = fs.readFileSync(inputFilePath, "utf8");
    } catch (e) {
        exitEarly("Failure: could not read template!");
    }

    const renderedTemplate = renderTemplate(templateContents, data);

    try {
        fs.writeFileSync(outputFilePath, renderedTemplate);
    } catch (e) {
        exitEarly("Failure: could not generate output file!");
    }
}
exports.genFile = genFile;
