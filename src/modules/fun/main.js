const { ArgumentError } = require("../../errors");

exports.commands = { choose: choose };

exports.log_exclude = ["choose"];

async function choose(ctx, args, body) {
    var options;
    if (body.match(",")) {
        options = body.split(",").map((s) => s.trim());
    } else {
        options = args;
    }
    if (options.length == 0) {
        throw new ArgumentError("Please provide at least one choice.");
    }
    return {
        title: "Choice",
        description: options[Math.floor(Math.random() * options.length)],
    };
}
