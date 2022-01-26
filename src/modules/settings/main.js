const { exec } = require("child_process");
const { modify, config } = require("../.././core/config");
const { has_permission } = require("../../core/privileges");
const { add_protect, remove_protect } = require("../../db");
const { PermissionError, Success } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = {
    pull: pull,
    prefix: prefix,
    "log-ignore": log_ignore,
    "log-unignore": log_unignore,
    protect: protect,
    unprotect: unprotect,
};

function assert_perms(ctx) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings."
        );
    }
}

function parse_channel_ids(ctx, args) {
    return args.map(ctx.parse_channel_id.bind(ctx));
}

async function pull(ctx, args) {
    assert_perms(ctx);
    checkCount(args, 0);
    exec("git pull", (error, stdout, stderr) => {
        if (error) {
            await ctx.reply("Pulling failed.");
        } else {
            await ctx.reply("Pulling succeeded.");
        }
    });
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
    for (var id of parse_channel_ids(ctx, args)) {
        if (ignoring.indexOf(id) == -1) ignoring.push(id);
    }
    modify({ log_ignore: ignoring });
}

async function log_unignore(ctx, args) {
    assert_perms(ctx);

    const ids = parse_channel_ids(ctx, args);
    modify({
        log_ignore: config.log_ignore.filter((x) => ids.indexOf(x) == -1),
    });
}

async function protect(ctx, args) {
    assert_perms(ctx);

    for (var id of parse_channel_ids(ctx, args)) {
        await add_protect(id);
    }
}

async function unprotect(ctx, args) {
    assert_perms(ctx);

    for (var id of parse_channel_ids(ctx, args)) {
        await remove_protect(id);
    }
}
