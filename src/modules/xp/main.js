const { config } = require("../../core/config");
const { has_permission } = require("../../core/privileges");
const {
    increase_xp,
    xp_rank_for,
    leaderboard,
    client,
    list_xp_roles,
    add_role_xp,
    register_role,
    delist_role,
    drop_xp_roles,
} = require("../../db");
const { Info, ArgumentError, PermissionError } = require("../../errors");

exports.commands = {
    top: top,
    reset: reset,
    "add-xp-role": add_xp_role,
    "remove-xp-role": remove_xp_role,
    "rm-xp-role": remove_xp_role,
};

exports.listeners = {
    messageCreate: [text_activity],
    voiceStateUpdate: [voice_activity],
};

var roles = undefined;

async function get_roles() {
    if (roles !== undefined) return roles;
    return (roles = new Set(
        (await list_xp_roles()).map((entry) => entry.role_id)
    ));
}

async function top_fields(type, user_id, limit, offset) {
    const data = (await leaderboard(type, limit, offset)).map(
        (x, i) => ((x.rank = i + offset), x)
    );
    const user = await xp_rank_for(type, user_id);
    if (user.xp !== 0) {
        user.user_id = user_id;
        user.bold = true;
        if (user.rank < offset) {
            data.unshift(user);
        } else if (user.rank >= offset + limit) {
            data.push(user);
        } else {
            data[user.rank - offset].bold = true;
        }
    }
    return (
        data
            .map(
                ({ user_id, xp, rank, bold }) =>
                    `${bold ? "**" : ""}\`${
                        rank + 1
                    }.\` <@${user_id}>: ${Math.floor(xp)}${bold ? "**" : ""}`
            )
            .join("\n") || "Nobody is on this leaderboard yet."
    );
}

async function top(ctx, args) {
    checkCount(args, 0, 2);
    if (args.length == 0) {
        const [tx, vc] = await Promise.all(
            ["text", "voice"].map((type) =>
                top_fields(type, ctx.author.id, 5, 0)
            )
        );
        throw new Info(
            "Leaderboard",
            "",
            (embed) => (
                (embed.fields = [
                    {
                        name: "Text",
                        value: tx,
                        inline: true,
                    },
                    {
                        name: "Voice",
                        value: vc,
                        inline: true,
                    },
                ]),
                (embed.footer = {
                    text: `${config.prefix}top text / ${config.prefix}top voice to see more`,
                }),
                embed
            )
        );
    } else {
        const type = args[0];
        if (type != "text" && type != "voice" && type != "event") {
            throw new ArgumentError(
                "Expected `text`, `voice`, or `event` as the leaderboard type."
            );
        }
        if (type == "event") {
            const roles = await list_xp_roles();
            console.log(roles);
            throw new Info("Event Leaderboard", "TODO");
        }
        const page = args.length > 1 ? parseInt(args[1]) - 1 : 0;
        if (isNaN(page) || page < 0) {
            throw new ArgumentError("Page number must be a positive integer.");
        }
        throw new Info(
            `${type == "text" ? "Text" : "Voice"} Leaderboard`,
            await top_fields(type, ctx.author.id, 10, 10 * page)
        );
    }
}

async function reset(ctx, args) {
    checkCount(args, 0);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to reset the leaderboards."
        );
    }
    await ctx.confirmOrCancel(
        {
            title: "Reset XP?",
            description:
                "This will reset EVERYONE's activity experience for both text and voice.",
            color: "ff0088",
        },
        "RESET",
        "never mind"
    );
    await client.query("DELETE FROM xp");
}

async function add_xp_role(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to add roles to the event XP leaderboard role list."
        );
    }
    await register_role(ctx.parse_role_id(args[0]));
    await get_roles();
    roles.add(role_id);
}

async function remove_xp_role(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to drop roles from the event XP leaderboard role list."
        );
    }
    const role_id = ctx.parse_role_id(args[0]);
    await ctx.confirmOrCancel(
        {
            title: "Remove role XP?",
            description: `Dropping the role from the leaderboard will remove <@&${role_id}>'s XP from the event leaderboard.`,
            color: "ff0088",
        },
        "REMOVE",
        "never mind"
    );
    await delist_role(role_id);
    await get_roles();
    roles.delete(role_id);
}

async function reset_event_xp(ctx, args) {
    checkCount(args, 0);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to reset the event XP leaderboard."
        );
    }
    await ctx.confirmOrCancel(
        {
            title: "Reset event leaderboard?",
            description:
                "This will remove all roles from the event leaderboard, thus resetting it entirely.",
        },
        "RESET",
        "never mind"
    );
    await drop_xp_roles();
}

const last_active = new Map();
const last_voice_update = new Map();
const voice_states = new Map();

async function text_activity(client, message) {
    if (message.guild != config.guild) return;
    if (message.webhookId !== null) return;
    if (message.author.bot) return;

    const now = new Date();
    const known = last_active.has(message.author.id);
    const xp_gain =
        (known
            ? Math.min(60000, now - last_active.get(message.author.id))
            : 60000) / 1000;
    await increase_xp(message.author.id, xp_gain, 0, known);
    const roles = await get_roles();
    for (const role of message.member.roles.cache.keys()) {
        if (roles.has(role)) await add_role_xp(role, xp_gain);
    }
    last_active.set(message.author.id, now);
}

async function voice_activity(client, before, after) {
    if (after.guild != config.guild) return;
    if (after.member.user.bot) return;
    const id = after.member.id;
    if (after.channel) {
        if (voice_states.has(id)) return;
        last_voice_update.set(id, new Date());
        increase_xp(id, 0, 0, false);
        voice_states.set(
            id,
            setInterval(() => {
                last_voice_update.set(id, new Date());
                increase_xp(id, 0, 60, true);
            }, 60000)
        );
    } else {
        if (!voice_states.has(id)) return;
        clearInterval(voice_states.get(id));
        voice_states.delete(id);
        if (last_voice_update.has(id)) {
            increase_xp(id, 0, (new Date() - last_voice_update.get(id)) / 1000);
            last_voice_update.delete(id);
        }
    }
}
