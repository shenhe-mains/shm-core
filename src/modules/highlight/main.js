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
const {
    Info,
    PermissionError,
    ArgumentError,
    UserError,
} = require("../../errors");
const { pagify } = require("../../pages");
const { checkCount, inline_code } = require("../../utils");

exports.commands = { highlight: highlight, hl: highlight };

exports.listeners = { messageCreate: [check_highlights] };

exports.log_exclude = ["highlight", "hl"];

const last_ping = {};
const threshold = 300000;

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
    const term = args.slice(1).join(" ").toLowerCase();
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
            if (await highlighting(ctx.author.id, term)) {
                throw new UserError("You are already highlighting that term.");
            } else if (term.length == 0) {
                throw new ArgumentError("Please enter something to highlight.");
            } else if (term.length > 100) {
                throw new ArgumentError(
                    "You cannot watch terms longer than 100 characters."
                );
            } else {
                await add_highlight(ctx.author.id, term);
                return {
                    title: "Highlight Added",
                    description: `When I see ${inline_code(
                        term
                    )}, I will DM you (up to once every 5 minutes per channel).`,
                };
            }
        case "rm":
        case "remove":
            if (!(await highlighting(ctx.author.id, term))) {
                throw new UserError("You aren't highlighting that term yet.");
            } else {
                await rm_highlight(ctx.author.id, term);
                return {
                    title: "Highlight Removed",
                    description: "I will no longer DM you for that term.",
                };
            }
        case "clear":
            const count = (await highlights_for(ctx.author.id)).length;
            await ctx.confirmOrCancel({
                title: "Clear all highlights?",
                description: `This will clear ${count} highlight${pluralize(
                    count
                )}.`,
                color: "AQUA",
            });
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
    if (message.webhookId !== null) return;
    if (message.author.bot) return;
    const content = message.content.toLowerCase();
    const members = [];
    for (const user_id of await highlighting_users()) {
        if (message.author.id == user_id) continue;
        if (!can_ping(message.channel, { id: user_id })) continue;
        if (!message.channel.members.has(user_id)) continue;
        var member;
        try {
            member = await message.guild.members.fetch(user_id);
        } catch {
            continue;
        }
        for (const match of await highlights_for(user_id)) {
            if (content.startsWith(match)) {
                members.push(member);
                break;
            } else if (content.endsWith(match)) {
                members.push(member);
                break;
            } else {
                var index = 1;
                var done = false;
                while ((index = content.indexOf(match, index + 1)) != -1) {
                    if (
                        !content[index - 1].match(/[A-Za-z]/) ||
                        !content[index + match.length].match(/[A-Za-z]/)
                    ) {
                        members.push(member);
                        done = true;
                        break;
                    }
                }
            }
        }
    }
    if (members.length > 0) {
        const messages = message.channel.messages.cache.toJSON().slice(-5);
        const context = messages
            .map(
                (m) =>
                    `[<t:${Math.floor(m.createdTimestamp / 1000)}>] ${
                        m.author
                    }: ${m.content}`
            )
            .join("\n");
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
