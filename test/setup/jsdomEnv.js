const { JSDOM } = require("jsdom");
const { webcrypto } = require("node:crypto");

/**
 * Build a jsdom window with WebCrypto wired up the way browsers expose it.
 * The staticrypt browser runtime references `crypto.getRandomValues` and
 * `crypto.subtle` as globals — jsdom does not provide them by default.
 *
 * @param {string} html - initial body HTML
 * @param {string} url - location URL (controls window.location.search/hash)
 * @returns {object} the jsdom Window
 */
function buildWindow(html = "<!DOCTYPE html><html><body></body></html>", url = "https://example.com/") {
    const dom = new JSDOM(html, { url });
    Object.defineProperty(dom.window, "crypto", { value: webcrypto, configurable: true });
    return dom.window;
}

module.exports = { buildWindow };
