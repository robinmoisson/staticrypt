const { convertCommonJSToBrowserJS, genFile} = require("../lib/formater");

const data = {
    js_codec: convertCommonJSToBrowserJS("../lib/codec"),
    js_crypto_engine: convertCommonJSToBrowserJS("../lib/cryptoEngine/cryptojsEngine"),
    js_formater: convertCommonJSToBrowserJS("../lib/formater"),
};

genFile(data, "./index.html", "./scripts/index_template.html");
