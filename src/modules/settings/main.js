delete require.cache[require.resolve("./utils")];
const { modify, config } = require("../.././core/config");
const { has_permission } = require("../../core/privileges");
const { add_protect, remove_protect } = require("../../db");
const {
    PermissionError,
    Success,
    ArgumentError,
    UserError,
} = require("../../errors");
const { checkCount, inline_code } = require("../../utils");
const { shell } = require("./utils");

exports.commands = {
    pull: pull,
    push: push,
    prefix: prefix,
    "log-ignore": log_ignore,
    "log-unignore": log_unignore,
    protect: protect,
    unprotect: unprotect,
    "close-team": team_status(false),
    "open-team": team_status(true),
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
    try {
        await shell("git", ["pull"]);
    } catch {
        throw new UserError(
            "Could not pull, possibly due to a merge conflict."
        );
    }
}

async function push(ctx, args, body) {
    assert_perms(ctx);
    if (!body) {
        throw new ArgumentError("Please provide a commit reason.");
    }
    const embed = {
        title: "Pushing...",
        description: "Adding files.",
        color: config.color,
    };
    const message = await ctx.replyEmbed(embed);
    try {
        await shell("git", ["add", "--all"]);
    } catch {
        embed.description = "Failed to add files.";
        embed.color = "RED";
        await message.edit({ embeds: [embed] });
    }
    embed.description = "Committing.";
    await message.edit({ embeds: [embed] });
    try {
        await shell("git", ["commit", "-m", body]);
    } catch {
        embed.description = "Failed to commit.";
        embed.color = "RED";
        await message.edit({ embeds: [embed] });
    }
    embed.description = "Pushing.";
    await message.edit({ embeds: [embed] });
    try {
        await shell("git", ["push"]);
    } catch {
        embed.description = "Failed to push.";
        embed.color = "RED";
        await message.edit({ embeds: [embed] });
    }
    await message.delete();
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

function team_status(open) {
    return async (ctx, args) => {
        checkCount(args, 1, Infinity);
        assert_perms(ctx);
        for (const arg of args) {
            if (!config.staff_teams.hasOwnProperty(arg)) {
                throw new ArgumentError(
                    `${inline_code(arg)} is not a valid team ID.`
                );
            }
        }
        for (const arg of args) {
            config.staff_teams[arg].open = open;
        }
        modify({
            staff_teams: config.staff_teams,
        });
    };
}
