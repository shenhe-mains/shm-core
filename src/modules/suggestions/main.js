const { ButtonInteraction } = require("discord.js");
const { config } = require("../../core/config");
const {
    create_suggestion,
    set_suggestion,
    get_vote,
    set_vote,
    get_scores,
    get_suggestion,
} = require("../../db");
const { ArgumentError, PermissionError } = require("../../errors");
const { checkCount } = require("../../utils");
const { has_permission } = require("../../core/privileges");

exports.commands = {
    suggest: suggest,
    approve: mark_suggestion("Approved", "GREEN", true),
    consider: mark_suggestion("Considered", "YELLOW", true),
    deny: mark_suggestion("Denied", "RED", true),
    implement: mark_suggestion("Implemented", "BLUE", true),
    "approve-silent": mark_suggestion("Approved", "GREEN", false),
    "consider-silent": mark_suggestion("Considered", "YELLOW", false),
    "deny-silent": mark_suggestion("Denied", "RED", false),
    "implement-silent": mark_suggestion("Implemented", "BLUE", false),
};

exports.listeners = { interactionCreate: [check_suggestion_vote] };

async function suggest(ctx, args, body) {
    if (!body) {
        throw new ArgumentError("Please enter something to suggest.");
    }
    const suggestion_id = await create_suggestion(
        ctx.message.id,
        ctx.author.id
    );
    const message = await (
        await ctx.client.channels.fetch(config.channels.suggestions)
    ).send({
        embeds: [
            {
                title: `Suggestion #${suggestion_id}`,
                description: body,
                color: config.color,
                author: {
                    name: ctx.author.user.tag,
                    iconURL: ctx.author.user.avatarURL({ dynamic: true }),
                },
                footer: {
                    text: "Use #suggest <your suggestion> in bot-spam to suggest your ideas!",
                },
            },
        ],
        components: [
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "BUTTON",
                        style: "SUCCESS",
                        emoji: "⬆️",
                        customId: `suggestions.upvote.${suggestion_id}`,
                    },
                    {
                        type: "BUTTON",
                        style: "DANGER",
                        emoji: "⬇️",
                        customId: `suggestions.downvote.${suggestion_id}`,
                    },
                ],
            },
        ],
    });
    await set_suggestion(suggestion_id, message.id);
}

function mark_suggestion(status, color, dm) {
    return async (ctx, args, body) => {
        checkCount(args, 1, Infinity);
        if (!has_permission(ctx.author, "suggestions")) {
            throw new PermissionError(
                "You do not have permission to update suggestions' statuses."
            );
        }
        const id = parseInt(args[0]);
        if (isNaN(id) || id <= 0) {
            throw new ArgumentError(
                "Expected a positive integer for the suggestion ID."
            );
        }
        const reason = body.substring(args[0].length).trim();
        var message_id, user_id;
        try {
            var { message_id, user_id } = await get_suggestion(id);
        } catch {
            throw new ArgumentError("There is no suggestion with that ID.");
        }
        try {
            const message = await (
                await ctx.guild.channels.fetch(config.channels.suggestions)
            ).messages.fetch(message_id);
            const embed = message.embeds[0];
            embed.fields = [
                {
                    name: `${status} by ${ctx.author.user.tag}`,
                    value: reason || "_ _",
                },
            ];
            await message.edit({ embeds: [embed] });
            if (dm) {
                try {
                    await (
                        await ctx.client.users.fetch(user_id)
                    ).send({
                        embeds: [
                            {
                                title: `Suggestion ${status}`,
                                description: `[Your suggestion](${
                                    message.url
                                }) in ${
                                    ctx.guild.name
                                }, suggestion #${id}, was ${status.toLowerCase()}. Thanks for the feedback!`,
                                fields: reason
                                    ? [
                                          {
                                              name: "Details",
                                              value: reason,
                                          },
                                      ]
                                    : [],
                                color: color,
                            },
                        ],
                    });
                } catch (error) {
                    console.error(error);
                }
            }
        } catch {
            throw new ArgumentError("I cannot find that suggestion anymore.");
        }
    };
}

async function check_suggestion_vote(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (!interaction.customId.startsWith("suggestions.")) return;
    const [_, type, raw_id] = interaction.customId.split(".");
    const id = parseInt(raw_id);
    const old = await get_vote(id, interaction.user.id);
    const vote = type == "upvote" ? (old == 1 ? 0 : 1) : old == -1 ? 0 : -1;
    await set_vote(id, interaction.user.id, vote);
    const [up, down] = await get_scores(id);
    await interaction.update({
        components: [
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "BUTTON",
                        style: "SUCCESS",
                        emoji: "⬆️",
                        customId: `suggestions.upvote.${id}`,
                        label: up.toString(),
                    },
                    {
                        type: "BUTTON",
                        style: "DANGER",
                        emoji: "⬇️",
                        customId: `suggestions.downvote.${id}`,
                        label: down.toString(),
                    },
                ],
            },
        ],
    });
}
