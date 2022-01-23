const { modify, config } = require("../.././core/config");
const { has_permission } = require("../../core/privileges");
const { PermissionError, Success } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = {
    prefix: prefix,
    "log-ignore": log_ignore,
    "log-unignore": log_unignore,
};

function assert_perms(ctx) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings."
        );
    }
}

async function prefix(ctx, args) {
    assert_perms(ctx);
    checkCount(args, 1);
    const [prefix] = args;

    if (prefix.match(/.*\w/)) {
        prefix += " ";
    }

    modify({
        prefix: prefix,
    });

    throw new Success("Prefix Set", `My prefix is now \`${prefix}\``);
}

async function log_ignore(ctx, args) {
    assert_perms(ctx);

    const ignoring = config.log_ignore;
    for (var arg of args) {
        const id = ctx.parse_channel_id(arg);
        if (ignoring.indexOf(id) == -1) ignoring.push(id);
    }
    modify({ log_ignore: ignoring });
}

async function log_unignore(ctx, args) {
    assert_perms(ctx);

    const ids = args.map(ctx.parse_channel_id.bind(ctx));
    modify({
        log_ignore: config.log_ignore.filter((x) => ids.indexOf(x) == -1),
    });
}
