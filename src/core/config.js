var config_path;

if (process.argv.indexOf("test-config") == -1) {
    config_path = "../../config.json";
} else {
    config_path = "../../test-config.json";
}

const config = require(config_path);
const fs = require("fs");
const path = require("path");

exports.config = require(config_path);

exports.reload = function () {
    delete require.cache[require.resolve(config_path)];
    const new_config = require(config_path);
    for (var key in config) {
        delete config[key];
    }
    for (var key in new_config) {
        config[key] = new_config[key];
    }
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
        path.join(__dirname, config_path),
        JSON.stringify(config, null, 4),
        (err) => {
            if (err) {
                console.error(err);
            }
        }
    );
};
