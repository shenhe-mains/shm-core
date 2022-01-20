const { DiscordAPIError } = require("discord.js");
const { schedule_undo } = require("../../core/moderation");
const { parse_duration } = require("../../core/parsing");
const { has_permission } = require("../../core/privileges");
const { client } = require("../../db");
const {
    PartialSuccess,
    Success,
    PermissionError,
    Info,
    ArgumentError,
    CommandSyntaxError,
} = require("../../errors");
const { pagify } = require("../../pages");
const {
    checkCount,
    for_duration,
    english_list,
    pluralize,
    inline_code,
} = require("../../utils");

exports.commands = {
    slowmode: slowmode,
    warn: moderate("warn", true),
    mute: moderate("mute", true),
    kick: moderate("kick", true),
    ban: moderate("ban", true),
    unmute: unmoderate("mute", true),
    unban: unmoderate("ban", false),
    "warn-silent": moderate("warn", false),
    "mute-silent": moderate("mute", false),
    "kick-silent": moderate("kick", false),
    "ban-silent": moderate("ban", false),
    "unmute-silent": unmoderate("mute", false),
    massban: massban,
    remove: remove,
    "clear-history": clear_history,
    history: history,
};

async function slowmode(ctx, args) {
    if (!has_permission(ctx.author, "slowmode")) {
        throw new PermissionError(
            "You do not have permission to slowmode channels."
        );
    }
    checkCount(args, 1, Infinity);
    var channel = ctx.channel;
    if (args.length >= 2) {
        try {
            channel = await ctx.parse_channel(args[0]);
            args.shift();
        } catch (error) {
            throw error;
        }
    }
    const duration = parse_duration(args, true);
    const reason = args.join(" ");
    await channel.setRateLimitPerUser(duration, reason);
}

function moderate(t, d) {
    return ((type, dm) =>
        async function (ctx, args) {
            if (!has_permission(ctx.author, type)) {
                throw new PermissionError(
                    `You do not have permission to ${type} users.`
                );
            }
            checkCount(args, type == "warn" ? 2 : 1, Infinity);
            const member = await (type == "ban"
                ? ctx.parse_user
                : ctx.parse_member
            ).bind(ctx)(args.shift());
            const user = type == "ban" ? member : member.user;
            var duration;
            if (type == "mute" || type == "ban") {
                duration = parse_duration(args);
            }
            const reason = args.join(" ");
            await (
                await ctx.confirmOrCancel({
                    title: `Confirm ${type}`,
                    description: `This operation will ${type} ${member}${
                        duration === undefined ? "" : for_duration(duration)
                    } with ${
                        reason ? "reason " + inline_code(reason) : "no reason"
                    }`,
                    color: {
                        warn: "YELLOW",
                        mute: "ORANGE",
                        kick: "AQUA",
                        ban: "PURPLE",
                    }[type],
                })
            ).message.delete();
            var fail = false;
            try {
                await (type == "warn"
                    ? ctx.warn
                    : type == "mute"
                    ? ctx.mute
                    : type == "kick"
                    ? ctx.kick
                    : ctx.ban
                ).bind(ctx)(
                    ...(type == "mute" || type == "ban"
                        ? [member, duration, reason, !dm]
                        : [member, reason, !dm])
                );
            } catch (error) {
                if (error instanceof DiscordAPIError) {
                    fail = true;
                } else {
                    throw error;
                }
            }
            if ((type == "mute" || type == "ban") && duration != 0) {
                await schedule_undo(type, ctx.guild, member.id);
            }
            throw new (fail ? PartialSuccess : Success)(
                `${user.username}#${user.discriminator} has been ${
                    type == "mute"
                        ? "muted"
                        : type == "ban"
                        ? "banned"
                        : type + "ed"
                }${duration === undefined ? "" : for_duration(duration)}${
                    fail ? " (DM failed)" : ""
                }`,
                reason
            );
        })(t, d);
}

function unmoderate(t, d) {
    return ((type, dm) =>
        async function (ctx, args) {
            if (!has_permission(ctx.author, type)) {
                throw new PermissionError(
                    `You do not have permission to un${type} users.`
                );
            }
            checkCount(args, 1, Infinity);
            const data = await (type == "mute"
                ? ctx.parse_member
                : ctx.parse_user
            ).bind(ctx)(args.shift());
            const user = await (type == "mute" ? data.user : data);
            const reason = args.join(" ");
            var fail = false;
            try {
                await (type == "mute" ? ctx.unmute : ctx.unban).bind(ctx)(
                    data,
                    reason,
                    !dm
                );
            } catch (error) {
                if (error instanceof DiscordAPIError) {
                    fail = true;
                } else {
                    throw error;
                }
            }
            throw new (fail ? PartialSuccess : Success)(
                `${user.username}#${user.discriminator} has been ${
                    type == "mute" ? "unmuted" : "unbanned"
                }`,
                reason
            );
        })(t, d);
}

async function massban(ctx, args) {
    const user_ids = [];
    while (args.length > 0) {
        try {
            user_ids.push(ctx.parse_user_id(args[0]));
            args.shift();
        } catch {
            break;
        }
    }
    const reason = args.join(" ");
    await _massban(ctx, user_ids, reason);
}

async function _massban(ctx, user_ids, reason) {
    const interaction = await ctx.confirmOrCancel({
        title: "Confirm Massbanning Users",
        description: `This operation will ban ${
            user_ids.length
        } user${pluralize(user_ids.length)}.`,
        fields: reason
            ? [
                  {
                      name: "Reason",
                      value: inline_code(reason),
                  },
              ]
            : [],
        color: "DARK_AQUA",
    });
    const size = Math.min(50, Math.floor(user_ids.length / 4));
    const embed = {
        title: `Massbanning ${user_ids.length} user${pluralize(
            user_ids.length
        )}`,
        description: `Progress: 0 / ${user_ids.length} (0%)`,
        color: "DARK_AQUA",
    };
    await ctx.massban(user_ids, 0, reason, 0, async (i) => {
        if (i % size == 0 || i == user_ids.length) {
            embed.description = `Progress: ${i} / ${user_ids.length} (${(
                (i / user_ids.length) *
                100
            ).toFixed(2)}%)`;
            await interaction.message.edit({
                embeds: [embed],
            });
        }
    });
    await interaction.message.edit({
        embeds: [
            {
                title: `Massbanned ${user_ids.length} user${pluralize(
                    user_ids.length
                )}`,
                color: "GREEN",
            },
        ],
    });
}

const categories = ["warns", "mutes", "kicks", "bans"];
const category_names = {
    warns: "Warn",
    mutes: "Mute",
    kicks: "Kick",
    bans: "Ban",
};
const action_names = {
    warns: "Warned",
    mutes: "Muted",
    kicks: "Kicked",
    bans: "Banned",
};

async function history(ctx, args) {
    checkCount(args, 1, Infinity);
    if (!has_permission(ctx.author, "history")) {
        throw new PermissionError(
            "You do not have permission to view users' histories."
        );
    }
    const user_id = await ctx.parse_user_id(args.shift());
    var user;
    try {
        user = await ctx.client.users.fetch(user_id);
    } catch {}
    var entries = [];

    if (args.length == 0) {
        args = categories;
    }

    for (var category of args) {
        if (categories.indexOf(category) == -1) {
            throw new ArgumentError(`\`${category}\` is not a valid category.`);
        }

        (
            await client.query(`SELECT * FROM ${category} WHERE user_id = $1`, [
                user_id,
            ])
        ).rows.forEach((entry) =>
            entries.push({ type: category, value: entry })
        );
    }

    entries.sort(({ value: a }, { value: b }) => b.time - a.time);

    entries = entries.map(({ type: type, value: entry }) => ({
        name: `${category_names[type]} #${entry.id}`,
        value: `${action_names[type]} by <@${entry.mod_id}>${
            entry.duration === undefined ? "" : for_duration(entry.duration)
        } on <t:${Math.floor(+entry.time / 1000)}> [here](${entry.origin})\n${
            entry.reason || "_no reason given_"
        }`,
    }));

    const title =
        "History for " +
        (user === undefined
            ? user_id
            : `${user.username}#${user.discriminator}`);

    if (entries.length == 0) {
        throw new Info(
            title,
            `<@${user_id}> has no ${english_list(args, "or")}`
        );
    }

    await pagify(ctx, { title: title, color: "GREY" }, entries, 10);

    throw new Info();
}

async function remove(ctx, args) {
    checkCount(args, 2);
    if (!has_permission(ctx.author, "clear")) {
        throw new PermissionError(
            "You do not have permission to remove users' records."
        );
    }
    const type = args.shift() + "s";
    if (categories.indexOf(type) == -1) {
        throw new CommandSyntaxError(
            "Argument 1: expected one of `warn`, `mute`, `kick`, `ban`."
        );
    }
    await client.query(`DELETE FROM ${type} WHERE id = $1`, [
        parseInt(args[0]),
    ]);
}

async function clear_history(ctx, args) {
    checkCount(args, 1, 2);
    if (!has_permission(ctx.author, "clear")) {
        throw new PermissionError(
            "You do not have permission to remove users' records."
        );
    }
    const user_id = await ctx.parse_user_id(args.shift());
    if (args.length == 1 && categories.indexOf(args[0]) == -1) {
        throw new CommandSyntaxError(
            "Argument 2: expected one of `warns`, `mutes`, `kicks`, `bans`."
        );
    }
    for (var type of args.length > 0 ? args : categories) {
        await client.query(`DELETE FROM ${type} WHERE user_id = $1`, [user_id]);
    }
}
