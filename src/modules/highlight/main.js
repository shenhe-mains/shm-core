const natural = require("natural");
const { config } = require("../../core/config");
const { has_permission } = require("../../core/privileges");
const {
    highlights_for,
    highlighting,
    add_highlight,
    rm_highlight,
    clear_highlights,
    highlighting_users,
} = require("../../db");
const { Info, PermissionError, ArgumentError } = require("../../errors");
const { pagify } = require("../../pages");
const { checkCount, inline_code } = require("../../utils");

exports.commands = { highlight: highlight, hl: highlight };

exports.listeners = { messageCreate: [check_highlights] };

exports.log_exclude = ["highlight", "hl"];

const last_ping = {};
const threshold = 300000;

const tokenizer = new natural.WordTokenizer();

function can_ping(channel, user) {
    if (!last_ping.hasOwnProperty(channel.id)) return true;
    if (!last_ping[channel.id].hasOwnProperty(user.id)) return true;
    return new Date() - last_ping[channel.id][user.id] >= threshold;
}

function apply_ping(channel, user) {
    last_ping[channel.id] ||= {};
    last_ping[channel.id][user.id] = new Date();
}

async function highlight(ctx, args) {
    checkCount(args, 1, Infinity);
    if (!has_permission(ctx.author, "highlight")) {
        throw new PermissionError(
            "You do not have permission to use highlights."
        );
    }
    const terms = args
        .slice(1)
        .map((term) => tokenizer.tokenize(term)[0])
        .map((word) => natural.PorterStemmer.stem(word));
    switch (args[0]) {
        case "list":
            const matches = await highlights_for(ctx.author.id);
            if (matches.length == 0) {
                throw new Info(
                    "Your Highlights",
                    `You have nothing highlighted. Use \`${config.prefix}highlight add <term>\` to highlight a term.`
                );
            } else {
                await pagify(
                    ctx,
                    {
                        title: "Your Highlights",
                        color: "GREY",
                    },
                    matches.map((x) => inline_code(x)),
                    10,
                    true
                );
                throw new Info();
            }
        case "add":
            const highlighted = [];
            for (const term of terms) {
                if (
                    term.length >= 3 &&
                    term.length <= 100 &&
                    !(await highlighting(ctx.author.id, term))
                ) {
                    highlighted.push(term);
                    await add_highlight(ctx.author.id, term);
                }
            }
            return {
                title: "Highlight(s) Added",
                description:
                    highlighted.map((term) => `\`${term}\``).join(", ") +
                    "\n\nDon't worry if these terms don't look right. It should still work properly.",
            };
        case "rm":
        case "remove":
            const removed = [];
            for (const term of terms) {
                if (await highlighting(ctx.author.id, term)) {
                    removed.push(term);
                    await rm_highlight(ctx.author.id, term);
                }
            }
            return {
                title: "Highlight(s) Removed",
                description:
                    removed.map((term) => `\`${term}\``).join(", ") +
                    "\n\nDon't worry if these terms don't look right. It should still work properly.",
            };
        case "clear":
            const count = (await highlights_for(ctx.author.id)).length;
            await (
                await ctx.confirmOrCancel({
                    title: "Clear all highlights?",
                    description: `This will clear ${count} highlight${pluralize(
                        count
                    )}.`,
                    color: "AQUA",
                })
            ).message.delete();
            await clear_highlights(ctx.author.id);
            return {
                title: "Highlights Cleared",
                description: "You no longer have any highlights active.",
            };
        default:
            throw new ArgumentError(
                "That is not a valid subcommand (expecting `add`, `remove` / `rm`, `list`, `clear`)."
            );
    }
}

async function check_highlights(client, message) {
    if (!message.guild) return;
    if (!message.channel) return;
    if (!message.channel.members) return;
    apply_ping(message.channel, message.author);
    const members = [];
    const words = new Set(
        tokenizer
            .tokenize(message.content)
            .map((word) => natural.PorterStemmer.stem(word))
    );
    for (const user_id of await highlighting_users()) {
        if (message.author.id == user_id) continue;
        if (!can_ping(message.channel, { id: user_id })) continue;
        var member;
        try {
            member = await message.guild.members.fetch(user_id);
        } catch {
            continue;
        }
        if (!message.channel.permissionsFor(member).has("VIEW_CHANNEL")) {
            continue;
        }
        for (const match of await highlights_for(user_id)) {
            if (words.has(match)) {
                members.push(member);
                break;
            }
        }
    }
    if (members.length > 0) {
        const cache = message.channel.messages.cache;
        const messages = [];
        for (var x = -5; x <= -1; ++x) {
            const m = cache.at(x);
            if (m) {
                messages.push(
                    `[<t:${Math.floor(m.createdTimestamp / 1000)}>] ${
                        m.author
                    }: ${m.content}`
                );
            }
        }
        const context = messages.join("\n");
        for (const member of members) {
            try {
                await member.send({
                    embeds: [
                        {
                            title: "Highlighted Term",
                            description: `One of your highlights triggered in ${message.channel}:`,
                            fields: [
                                {
                                    name: "Context",
                                    value: context,
                                },
                                {
                                    name: "Source",
                                    value: `[Jump!](${message.url})`,
                                },
                            ],
                            color: config.color,
                        },
                    ],
                });
            } catch {}
            apply_ping(message.channel, member);
        }
    }
}
