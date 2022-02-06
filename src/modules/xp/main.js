const { config } = require("../../core/config");
const { increase_xp, xp_rank_for, leaderboard } = require("../../db");
const { Info, ArgumentError } = require("../../errors");

exports.commands = {
    top: top,
};

exports.listeners = {
    messageCreate: [text_activity],
    voiceStateUpdate: [voice_activity],
};

async function top_fields(type, user_id, limit, offset) {
    const data = (await leaderboard(type, limit, offset)).map(
        (x, i) => ((x.rank = i), x)
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
        if (type != "text" && type != "voice") {
            throw new ArgumentError(
                "Expected `text` or `voice` as the leaderboard type."
            );
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
    last_active.set(message.author.id, now);
}

async function voice_activity(client, before, after) {
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
