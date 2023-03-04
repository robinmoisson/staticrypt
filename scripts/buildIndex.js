const { convertCommonJSToBrowserJS, genFile } = require("../cli/helpers.js");

const data = {
    js_codec: convertCommonJSToBrowserJS("lib/codec"),
    js_crypto_engine: convertCommonJSToBrowserJS("lib/cryptoEngine/webcryptoEngine"),
    js_formater: convertCommonJSToBrowserJS("lib/formater"),
};

genFile(data, "./index.html", "./scripts/index_template.html");
