const { convertCommonJSToBrowserJS, genFile, buildStaticryptJS } = require("../cli/helpers.js");

const data = {
    js_codec: convertCommonJSToBrowserJS("lib/codec"),
    js_crypto_engine: convertCommonJSToBrowserJS("lib/cryptoEngine"),
    js_formater: convertCommonJSToBrowserJS("lib/formater"),
    js_staticrypt: buildStaticryptJS(),
};

genFile(data, "./index.html", "./scripts/index_template.html");
