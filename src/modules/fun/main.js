const { ButtonInteraction } = require("discord.js");
const { ArgumentError, Success } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = { choose: choose };

exports.listeners = { interactionCreate: [checkFun] };

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
    throw new Success(
        "Choice",
        options[Math.floor(Math.random() * options.length)]
    );
}

async function checkFun(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
}
