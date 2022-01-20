const config = require("../../config.json");
const fs = require("fs");
const path = require("path");

exports.config = config;

exports.reload = function () {
    replace(require("../../config.json"), config);
};

exports.modify = function (edits) {
    for (var key in edits) {
        if (edits[key] === undefined) {
            delete config[key];
        } else {
            config[key] = edits[key];
        }
    }
    fs.writeFile(
        path.join(__dirname, "..", "..", "config.json"),
        JSON.stringify(config, null, 4),
        (err) => {
            if (err) {
                console.error(err);
            }
        }
    );
};
