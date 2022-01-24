const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const { config } = require("../../core/config");
const { Info, ArgumentError } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = { help: help };

// const helpdata = yaml.load(
//     fs.readFileSync(path.join(__dirname, "helptext.yml"))
// );

async function help(ctx, args) {
    const helpdata = yaml.load(
        fs.readFileSync(path.join(__dirname, "helptext.yml"))
    );
    checkCount(args, 0, 1);

    var data;

    if (args.length === 0) {
        data = helpdata.text.__all;
    } else {
        const key =
            helpdata.aliases[args[0].toLowerCase()] || args[0].toLowerCase();
        data = helpdata.text[key];
        if (data === undefined) {
            throw new ArgumentError("There is no help text for that key.");
        }
    }

    throw new Info(
        data.title.replaceAll("{prefix}", config.prefix),
        data.body.replaceAll("{prefix}", config.prefix)
    );
}
