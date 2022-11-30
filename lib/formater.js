/**
 * Replace the placeholder tags (between '{tag}') in the template string with provided data.
 *
 * @param {string} templateString
 * @param {Object} data
 *
 * @returns string
 */
function renderTemplate(templateString, data) {
    return templateString.replace(/{\s*(\w+)\s*}/g, function (_, key) {
        if (data && data[key] !== undefined) {
            return data[key];
        }

        return "";
    });
}
exports.renderTemplate = renderTemplate;

