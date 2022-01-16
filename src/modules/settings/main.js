const { set_prefix } = require("../../db");
const { ArgumentError } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = {
    prefix: prefix,
    test: test,
};

async function prefix(ctx, args) {
    checkCount(args, 1);
    var [new_prefix] = args;

    if (new_prefix.length == 0) {
        throw new ArgumentError("The prefix cannot be empty.");
    }

    if (new_prefix.charAt(new_prefix.length - 1).match(/\w/)) {
        if (new_prefix.length > 15) {
            throw new ArgumentError(
                "Word prefixes can have a maximum length of 15 characters."
            );
        }
        new_prefix += " ";
    }

    if (new_prefix.length > 16) {
        throw new ArgumentError(
            "Prefixes can have a maximum length of 16 characters."
        );
    }

    await set_prefix(new_prefix);

    return {
        title: "Prefix Updated",
        description: `My prefix is now \`${new_prefix}\`.`,
    };
}

async function test(ctx, args) {
    await ctx.reply("Hello!");
}
