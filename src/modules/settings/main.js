const { modify } = require("../.././core/config");
const { has_permission } = require("../../core/privileges");
const { PermissionError, Success } = require("../../errors");

exports.commands = {
    prefix: prefix,
};

async function prefix(ctx, [prefix]) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings."
        );
    }

    if (prefix.match(/.*\w/)) {
        prefix += " ";
    }

    modify({
        prefix: prefix,
    });

    throw new Success("Prefix Set", `My prefix is now \`${prefix}\``);
}
