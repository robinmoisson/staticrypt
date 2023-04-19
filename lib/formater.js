/**
 * Replace the variable in template tags, between '/*[|variable|]* /0' (without the space in '* /0', ommiting it would
 * break this comment), with the provided data.
 *
 * This weird format is so that we have something that doesn't break JS parser in the template files (it understands it
 * as '0'), so we can still use auto-formatting. The auto-formatter might add a space before the '0', we accept both.
 *
 * @param {string} templateString
 * @param {Object} data
 *
 * @returns string
 */
function renderTemplate(templateString, data) {
    return templateString.replace(/\/\*\[\|\s*(\w+)\s*\|]\*\/\s*0/g, function (_, key) {
        if (!data || data[key] === undefined) {
            return key;
        }

        if (typeof data[key] === "object") {
            return JSON.stringify(data[key]);
        }

        return data[key];
    });
}
exports.renderTemplate = renderTemplate;
