const { DiscordAPIError } = require("discord.js");
const fetch = require("node-fetch");
const { config } = require("../../core/config");
const { schedule_undo } = require("../../core/moderation");
const { parse_duration } = require("../../core/parsing");
const { has_permission, assert_hierarchy } = require("../../core/privileges");
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
    verbal: moderate("verbal", true),
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
    "massban-from-url": massban_from_url,
    remove: remove,
    "clear-history": clear_history,
    history: history,
    nick: nick,
    purge: purge,
    role: role_add,
    "role-add": role_add,
    "role-remove": role_rm,
    "role-rm": role_rm,
    "set-role-name": role_rename,
    "set-role-color": role_recolor,
    "set-role-colour": role_recolor,
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
            const past_tense =
                type == "verbal"
                    ? "verbally warned"
                    : type == "mute"
                    ? "muted"
                    : type == "ban"
                    ? "banned"
                    : type + "ed";
            if (!has_permission(ctx.author, type.replace("verbal", "warn"))) {
                throw new PermissionError(
                    `You do not have permission to ${type.replace(
                        "verbal",
                        "verbally warn"
                    )} users.`
                );
            }
            checkCount(
                args,
                type == "warn" || type == "verbal" ? 2 : 1,
                Infinity
            );
            const member = await (type == "ban"
                ? ctx.parse_user
                : ctx.parse_member
            ).bind(ctx)(args.shift());
            if (type != "verbal") {
                var guild_member;
                if (type == "ban") {
                    try {
                        guild_member = await ctx.guild.members.fetch(member.id);
                    } catch {}
                } else {
                    guild_member = member;
                }
                if (guild_member !== undefined) {
                    await assert_hierarchy(ctx.author, guild_member);
                    if (has_permission(guild_member, "immunity")) {
                        throw new PermissionError(
                            `${guild_member} is not able to be ${past_tense}.`
                        );
                    }
                }
            }
            const user = type == "ban" ? member : member.user;
            var duration;
            if (type == "mute" || type == "ban") {
                duration = parse_duration(args);
            }
            const reason = args.join(" ");
            await (
                await ctx.confirmOrCancel({
                    title: `Confirm ${type}`,
                    description: `This operation will ${type.replace(
                        "verbal",
                        "verbally warn"
                    )} ${member}${
                        duration === undefined ? "" : for_duration(duration)
                    } with ${
                        reason ? "reason " + inline_code(reason) : "no reason"
                    }`,
                    thumbnail: {
                        url: user.avatarURL({ dynamic: true }),
                    },
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
                await (type == "verbal"
                    ? ctx.verbal
                    : type == "warn"
                    ? ctx.warn
                    : type == "mute"
                    ? ctx.mute
                    : type == "kick"
                    ? ctx.kick
                    : ctx.ban
                ).bind(ctx)(
                    ...(type == "mute" || type == "ban"
                        ? [
                              type == "ban" ? member.id : member,
                              duration,
                              reason,
                              !dm,
                          ]
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
                `${user.username}#${user.discriminator} has been ${past_tense}${
                    duration === undefined ? "" : for_duration(duration)
                }${fail ? " (DM failed)" : ""}`,
                reason
            );
        })(t, d);
}

function unmoderate(t, d) {
    return ((type, dm) =>
        async function (ctx, args, body) {
            if (!has_permission(ctx.author, type)) {
                throw new PermissionError(
                    `You do not have permission to un${type} users.`
                );
            }
            checkCount(args, 1, Infinity);
            var data;
            try {
                data = await (type == "mute"
                    ? ctx.parse_member
                    : ctx.parse_user
                ).bind(ctx)(args[0]);
            } catch (error) {
                if (type == "mute") {
                    const id = await ctx.parse_user_id(args[0]);
                    await client.query(
                        `DELETE FROM autoroles WHERE user_id = $1 AND role_id = $2`,
                        [id, config.mute]
                    );
                    return {
                        title: `User ${id} has been unmuted`,
                        description:
                            "I could not find that user in this server, but if they were previously muted, I have removed the mute role from their autoroles so they will not be re-muted when they rejoin the server.",
                    };
                } else {
                    throw error;
                }
            }
            const user = await (type == "mute" ? data.user : data);
            const reason = body.substring(args[0].length).trim();
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
    if (!has_permission(ctx.author, "massban")) {
        throw new PermissionError(
            "You do not have permission to massban users."
        );
    }
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

async function massban_from_url(ctx, args) {
    if (!has_permission(ctx.author, "massban")) {
        throw new PermissionError(
            "You do not have permission to massban users."
        );
    }
    checkCount(args, 1, Infinity);
    var url = args.shift();
    if (url.startsWith("<") && url.endsWith(">")) {
        url = url.substring(1, url.length - 1);
    }
    const reason = args.join(" ");
    var text;
    try {
        const response = await fetch(url);
        if (!response.ok) throw 0;
        text = await response.text();
    } catch {
        throw new ArgumentError(
            "Failed to fetch data from that URL; please make sure you have entered it correctly."
        );
    }
    await _massban(ctx, text.split(/\s+/).map(ctx.parse_user_id), reason);
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

async function nick(ctx, args, body) {
    if (args.length == 0) await ctx.author.setNickname(null);
    var member = ctx.author;
    try {
        member = await ctx.parse_member(args[0]);
        body = body.substring(args[0].length);
    } catch {}
    if (member.id != ctx.author.id) {
        if (member.id == ctx.client.user.id) {
            if (!has_permission(ctx.author, "settings")) {
                throw new PermissionError(
                    "You do not have permission to edit bot settings, including my nickname."
                );
            }
        } else {
            if (!has_permission(ctx.author, "nick")) {
                throw new PermissionError(
                    "You do not have permission to use this command on other users."
                );
            }
            await assert_hierarchy(ctx.author, member);
        }
    }
    const nick = body.trim();
    if (nick.length > 32) throw new ArgumentError("Maximum 32 characters.");
    await member.setNickname(nick || null);
}

async function purge(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "purge")) {
        throw new PermissionError(
            "You do not have permission to purge messages."
        );
    }
    const count = parseInt(args[0]);
    if (isNaN(count) || count <= 0 || count > 100) {
        throw new ArgumentError("Please enter a positive integer (max. 100).");
    }
    await (
        await ctx.confirmOrCancel({
            title: "Confirm Purge",
            description: `Purge the last ${count} message${pluralize(
                count
            )}? (Only works for messages younger than 2 weeks.)`,
        })
    ).message.delete();
    await ctx.message.delete();
    const messages = await ctx.channel.bulkDelete(count);
    const reply = await ctx.send({
        embeds: [
            {
                title: "Purged Messages",
                description: `${messages.size} message${pluralize(
                    messages.size
                )} ${pluralize(
                    messages.size,
                    "were",
                    "was"
                )} successfully purged.`,
            },
        ],
        color: "GREEN",
    });
    setTimeout(() => {
        reply.delete();
    }, 2500);
}

async function role_add(ctx, args) {
    checkCount(args, 2, Infinity);
    if (!has_permission(ctx.author, "role_grant")) {
        throw new PermissionError("You do not have permission to grant roles.");
    }
    const member = await ctx.parse_member(args.shift());
    assert_hierarchy(ctx.author, member);
    const roles = await Promise.all(args.map(ctx.parse_role.bind(ctx)));
    for (const role of roles) {
        if (role.comparePositionTo(ctx.author.roles.highest) >= 0) {
            throw new PermissionError(
                "You cannot grant roles that are not below your highest role."
            );
        }
    }
    await member.roles.add(roles, `added via command by ${ctx.author.id}`);
    return {
        title: "Roles Granted",
        description: `Gave ${roles
            .map((role) => role.toString())
            .join(", ")} to ${member}`,
    };
}

async function role_rm(ctx, args) {
    checkCount(args, 2, Infinity);
    if (!has_permission(ctx.author, "role_grant")) {
        throw new PermissionError(
            "You do not have permission to remove roles."
        );
    }
    const member = await ctx.parse_member(args.shift());
    assert_hierarchy(ctx.author, member);
    const roles = await Promise.all(args.map(ctx.parse_role.bind(ctx)));
    for (const role of roles) {
        if (role.comparePositionTo(ctx.author.roles.highest) >= 0) {
            throw new PermissionError(
                "You cannot remove roles that are not below your highest role."
            );
        }
    }
    await member.roles.remove(roles, `removed via command by ${ctx.author.id}`);
    return {
        title: "Roles Removed",
        description: `Took ${roles
            .map((role) => role.toString())
            .join(", ")} from ${member}`,
    };
}

async function role_rename(ctx, args) {
    checkCount(args, 2, Infinity);
    if (!has_permission(ctx.author, "role_modify")) {
        throw new PermissionError(
            "You do not have permission to modify roles."
        );
    }
    const role = await ctx.parse_role(args.shift());
    const old = role.name;
    const name = args.join(" ");
    await role.edit(
        {
            name: name,
        },
        `edited via command by ${ctx.author.id}`
    );
    return {
        title: "Role Renamed",
        description: `${role} was renamed from ${inline_code(
            old
        )} to ${inline_code(name)}`,
    };
}

async function role_recolor(ctx, args) {
    checkCount(args, 1, 2);
    if (!has_permission(ctx.author, "role_modify")) {
        throw new PermissionError(
            "You do not have permission to modify roles."
        );
    }
    const role = await ctx.parse_role(args[0]);
    const old = role.color;
    const color = args[1] || "0";
    await role.edit(
        {
            color: color.toUpperCase(),
        },
        `edited via command by ${ctx.author.id}`
    );
    return {
        title: "Role Recolored",
        description: `${role} was recolored from ${old} to ${color}`,
    };
}
