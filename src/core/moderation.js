const {
    add_warn,
    add_mute,
    add_kick,
    add_ban,
    remove_mute,
    remove_ban,
    client,
} = require("../db");
const { PermissionError, ArgumentError } = require("../errors");
const { for_duration, dm } = require("../utils");
const { config } = require("./config");
const { assert_hierarchy, has_permission } = require("./privileges");

exports.verbal = async function (ctx, member, reason) {
    if (!has_permission(ctx.author, "warn")) {
        throw new PermissionError("You do not have permission to warn users.");
    }
    await dm(
        member,
        `Verbal warning from ${ctx.guild.name}`,
        `Hello, ${member}! You were given a verbal warning by a moderator in ${ctx.guild.name}. This does not go on your record.\n\n` +
            reason
    );
};

exports.warn = async function (ctx, member, reason, no_dm) {
    if (!has_permission(ctx.author, "warn")) {
        throw new PermissionError("You do not have permission to warn users.");
    }
    await assert_hierarchy(ctx.author, member);
    if (has_permission(member, "immunity")) {
        throw new PermissionError(`${member} is not able to be warned.`);
    }
    await add_warn(ctx.author.id, member.id, reason, ctx.url);
    if (!no_dm) {
        await dm(member, `You were warned in ${ctx.guild.name}`, reason);
    }
};

exports.mute = async function (ctx, member, duration, reason, no_dm) {
    if (!has_permission(ctx.author, "mute")) {
        throw new PermissionError("You do not have permission to mute users.");
    }
    await assert_hierarchy(ctx.author, member);
    if (has_permission(member, "immunity")) {
        throw new PermissionError(`${member} is not able to be muted.`);
    }
    await add_mute(ctx.author.id, member.id, duration, reason, ctx.url);
    await member.roles.add(await ctx.guild.roles.fetch(config.mute));
    if (!no_dm) {
        await dm(
            member,
            `You were muted in ${ctx.guild.name}${for_duration(duration)}`,
            reason
        );
    }
};

exports.kick = async function (ctx, member, reason, no_dm) {
    if (!has_permission(ctx.author, "kick")) {
        throw new PermissionError("You do not have permission to kick users.");
    }
    await assert_hierarchy(ctx.author, member);
    if (has_permission(member, "immunity")) {
        throw new PermissionError(`${member} is not able to be kicked.`);
    }
    if (!member.kickable) {
        throw new PermissionError(
            `I do not have permission to kick ${member}.`
        );
    }
    await add_kick(ctx.author.id, member.id, reason, ctx.url);
    try {
        if (!no_dm) {
            await dm(member, `You were kicked from ${ctx.guild.name}`, reason);
        }
    } finally {
        await member.kick(reason);
    }
};

exports.ban = async function (ctx, user_id, duration, reason, no_dm, days) {
    if (!has_permission(ctx.author, "ban")) {
        throw new PermissionError("You do not have permission to ban users.");
    }
    var member;
    try {
        member = await ctx.guild.members.fetch(user_id);
    } catch {}
    await assert_hierarchy(ctx.author, { id: user_id });
    if (member !== undefined && has_permission(member, "immunity")) {
        throw new PermissionError(`${member} is not able to be banned.`);
    }
    if (member !== undefined && !member.bannable) {
        throw new PermissionError(
            `I do not have permission to ban <@${user_id}>.`
        );
    }
    await add_ban(ctx.author.id, user_id, duration, reason, ctx.url);
    try {
        if (member !== undefined && !no_dm) {
            await dm(
                member,
                `You were banned from ${ctx.guild.name}${for_duration(
                    duration
                )}`,
                reason
            );
        }
    } finally {
        await ctx.guild.bans.create(user_id, {
            reason: reason,
            days: days || 0,
        });
    }
};

exports.massban = async function (
    ctx,
    user_ids,
    duration,
    reason,
    days,
    callback
) {
    reason || "[massban]";
    if (!has_permission(ctx.author, "massban")) {
        throw new PermissionError(
            "You do not have permission to massban users."
        );
    }
    for (var i in user_ids) {
        await callback(i);
        const user_id = user_ids[i];
        var member;
        try {
            member = await ctx.guild.members.fetch(user_id);
        } catch {}
        try {
            if (member !== undefined) {
                await assert_hierarchy(ctx.author, member);
                if (has_permission(member, "immunity")) throw 0;
            }
            if (member === undefined || member.bannable) {
                await add_ban(
                    ctx.author.id,
                    user_id,
                    duration,
                    reason,
                    ctx.url
                );
                await ctx.guild.bans.create(user_id, {
                    reason: reason,
                    days: days || 0,
                });
            }
        } catch {}
    }
};

exports.unmute = async function (ctx, member, reason, no_dm) {
    if (!has_permission(ctx.author, "mute")) {
        throw new PermissionError(
            "You do not have permission to unmute users."
        );
    }
    await remove_mute(member.id);
    await member.roles.remove(config.mute);
    if (!no_dm) {
        await dm(member, `You were unmuted in ${ctx.guild.name}`, reason);
    }
};

exports.unban = async function (ctx, user) {
    if (!has_permission(ctx.author, "ban")) {
        throw new PermissionError("You do not have permission to unban users.");
    }
    await remove_ban(user.id);
    try {
        await ctx.guild.bans.remove(user.id);
    } catch {
        throw new ArgumentError(
            `I could not unban ${user}; they are probably not banned.`
        );
    }
};

exports.schedule_undo = schedule_undo = async function (type, guild, user_id) {
    const entry = (
        await client.query(`SELECT * FROM un${type}s WHERE user_id = $1`, [
            user_id,
        ])
    ).rows[0];
    if (entry !== undefined) {
        setTimeout(() => {
            client
                .query(`SELECT * FROM un${type}s WHERE user_id = $1`, [user_id])
                .then((q) => {
                    const e = q.rows[0];
                    if (e !== undefined && e.time - +new Date() < 5) {
                        client.query(
                            `DELETE FROM un${type}s WHERE user_id = $1`,
                            [user_id]
                        );
                        if (type == "mute") {
                            client.query(
                                `DELETE FROM autoroles WHERE user_id = $1 AND role_id = $2`,
                                [user_id, config.mute]
                            );
                            guild.members
                                .fetch(user_id)
                                .then((member) =>
                                    member.roles.remove(config.mute)
                                );
                        } else {
                            guild.bans.remove(user_id);
                        }
                        guild.channels
                            .fetch(config.channels.logs)
                            .then((channel) =>
                                channel.send({
                                    embeds: [
                                        {
                                            title: `Scheduled Un${type}`,
                                            description: `<@${user_id}>'s ${type} expired and they were ${
                                                type == "mute"
                                                    ? "unmuted"
                                                    : "unbanned"
                                            }.`,
                                            color: config.color,
                                        },
                                    ],
                                })
                            );
                    }
                });
        }, Math.max(0, entry.time - +new Date()));
    }
};

exports.create_tasks = async function (discord_client) {
    const guild = await discord_client.guilds.fetch(config.guild);
    for (var type of ["mute", "ban"]) {
        (await client.query(`SELECT user_id FROM un${type}s`)).rows.forEach(
            (entry) => schedule_undo(type, guild, entry.user_id)
        );
    }
};
