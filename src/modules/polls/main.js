const { ButtonInteraction } = require("discord.js");
const { config } = require("../../core/config");
const { has_permission } = require("../../core/privileges");
const {
    create_poll,
    poll_type,
    has_vote,
    remove_vote,
    add_vote,
    poll_options,
    poll_votes,
    clear_votes,
    has_any_vote,
    fetch_poll,
} = require("../../db");
const {
    PermissionError,
    ArgumentError,
    UserError,
    Info,
} = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = {
    poll: setup_poll,
    "open-poll": open_poll,
    "close-poll": close_poll,
    "poll-results": show_results,
    disclose: disclose,
};

exports.listeners = { interactionCreate: [observe_vote] };

const poll_types = {
    normal: 0,
    unique: 1,
    commit: 2,
    hidden: 3,
    hidden_unique: 4,
    hidden_commit: 5,
    show_on_commit: 6,
};

const footers = [
    "",
    "You may only select one option.",
    "You may only select one option, and cannot change it later.",
    "Results will be hidden until the poll is closed.",
    "You may only select one option. Results will be hidden until the poll is closed.",
    "You may only select one option, and cannot change it later. Results will be hidden until the poll is closed.",
    "You may only select one option, and cannot change it later. Once you lock in your vote, you will be able to see the results.",
];

const grouping = [
    [],
    [1],
    [2],
    [3],
    [4],
    [5],
    [3, 3],
    [4, 3],
    [4, 4],
    [5, 4],
    [5, 5],
    [4, 4, 3],
    [4, 4, 4],
    [5, 5, 3],
    [5, 5, 4],
    [5, 5, 5],
    [4, 4, 4, 4],
    [5, 5, 5, 2],
    [5, 5, 5, 3],
    [5, 5, 5, 4],
    [5, 5, 5, 5],
    [5, 5, 5, 5, 1],
    [5, 5, 5, 5, 2],
    [5, 5, 5, 5, 3],
    [5, 5, 5, 5, 4],
    [5, 5, 5, 5, 5],
];

async function setup_poll(ctx, args, body) {
    if (!has_permission(ctx.author, "poll")) {
        throw new PermissionError(
            "You do not have permission to create polls."
        );
    }
    checkCount(args, 2, Infinity);
    const channel = await ctx.parse_channel(args[0]);
    const type = poll_types[args[1]];
    if (type === undefined) {
        throw new ArgumentError("Invalid poll type.");
    }
    const values = body
        .substring(args[0].length)
        .trim()
        .substring(args[1].length)
        .trim()
        .split(";;")
        .map((s) => s.trim());
    if (values.length < 2) {
        throw new ArgumentError(
            "You must provide the poll body and at least one option."
        );
    }
    if (values.some((s) => s.length == 0)) {
        throw new ArgumentError(
            "The poll body and poll options must be non-empty."
        );
    }
    const desc = values.shift();
    if (values.some((s) => s.length > 100)) {
        throw new ArgumentError(
            "Poll options must be at most 100 characters long."
        );
    }
    if (values.length > 25) {
        throw new ArgumentError("Polls can only contain at most 25 options.");
    }
    if (new Set(values).size != values.length) {
        throw new ArgumentError("Duplicate options are not allowed.");
    }
    const buttons = values.map((value) => ({
        type: "BUTTON",
        style: "PRIMARY",
        customId: value,
        label: value,
    }));
    const rows = [];
    for (const size of grouping[buttons.length]) {
        rows.push({
            type: "ACTION_ROW",
            components: buttons.splice(0, size),
        });
    }
    const message = await channel.send({
        embeds: [
            {
                title: "Poll",
                description: desc,
                color: config.color,
                footer: { text: footers[type] },
            },
        ],
        components: rows,
    });
    await create_poll(message.id, channel.id, type, values);
}

async function open_poll(ctx, args) {
    await set_poll_disabled(ctx, args, false);
}

async function close_poll(ctx, args) {
    await set_poll_disabled(ctx, args, true);
}

async function get_message(ctx, id) {
    poll = await fetch_poll(id);
    if (poll === undefined) {
        throw new ArgumentError(
            "I could not find a poll with that message ID."
        );
    }
    try {
        return await (
            await ctx.guild.channels.fetch(poll.channel_id)
        ).messages.fetch(id);
    } catch {
        throw new UserError(
            "I have a poll with that ID in my database but I could not fetch the message itself."
        );
    }
}

async function set_poll_disabled(ctx, args, disabled) {
    if (!has_permission(ctx.author, "poll")) {
        throw new PermissionError(
            "You do not have permission to modify polls."
        );
    }
    checkCount(args, 1);

    const message = await get_message(ctx, args[0]);
    await message.edit({
        components: message.components.map(
            (component) => (
                component.components.forEach(
                    (button) => (button.disabled = disabled)
                ),
                component
            )
        ),
    });
}

async function results(message) {
    const votes = {};
    var options = [];
    var total = 0;
    for (var option of (options = await poll_options(message.id))) {
        total += votes[option] = await poll_votes(message.id, option);
    }
    return options
        .map(
            (option) =>
                `${option} - ${votes[option]} / ${total} (${
                    total == 0 ? 0 : ((votes[option] / total) * 100).toFixed(2)
                }%)`
        )
        .join("\n");
}

async function show_results(ctx, args) {
    if (!has_permission(ctx.author, "poll")) {
        throw new PermissionError(
            "You do not have permission to view poll results."
        );
    }
    checkCount(args, 1);

    const message = await get_message(ctx, args[0]);
    throw new Info("Poll Results", await results(message));
}

async function disclose(ctx, args) {
    if (!has_permission(ctx.author, "poll")) {
        throw new PermissionError(
            "You do not have permission to show poll results"
        );
    }
    checkCount(args, 1);

    const message = await get_message(ctx, args[0]);
    const embed = message.embeds[0];
    embed.fields = [{ name: "Results", value: await results(message) }];
    await message.edit({ embeds: [embed] });
}

async function observe_vote(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    var type;
    try {
        type = await poll_type(interaction.message.id);
    } catch {
        return;
    }
    const id = interaction.customId;
    const args = [interaction.message.id, interaction.user.id, id];

    if (type == poll_types.normal || type == poll_types.hidden) {
        if (await has_vote(...args)) {
            await remove_vote(...args);
            await interaction.reply({
                content: `Your vote for "${id}" has been removed.`,
                ephemeral: true,
            });
        } else {
            await add_vote(...args);
            await interaction.reply({
                content: `Your vote for "${id}" has been added.`,
                ephemeral: true,
            });
        }
    } else if (type == poll_types.unique || type == poll_types.hidden_unique) {
        if (await has_vote(...args)) {
            await remove_vote(...args);
            await interaction.reply({
                content: `Your vote has been cleared.`,
                ephemeral: true,
            });
        } else {
            await clear_votes(...args);
            await add_vote(...args);
            await interaction.reply({
                content: `Your vote has been set to "${id}".`,
                ephemeral: true,
            });
        }
    } else if (
        type == poll_types.commit ||
        type == poll_types.hidden_commit ||
        type == poll_types.show_on_commit
    ) {
        if (await has_any_vote(...args)) {
            await interaction.reply({
                content: `Your vote is locked in and can no longer be changed.`,
                ephemeral: true,
            });
            return;
        } else {
            await add_vote(...args);
            await interaction.reply({
                content: `Your vote has been locked in as "${id}".`,
                embeds:
                    type == poll_types.show_on_commit
                        ? [
                              {
                                  title: "Results",
                                  description: await results(
                                      interaction.message
                                  ),
                                  color: config.color,
                              },
                          ]
                        : [],
                ephemeral: true,
            });
        }
    }
    if (
        type == poll_types.normal ||
        type == poll_types.unique ||
        type == poll_types.commit
    ) {
        const embed = interaction.message.embeds[0];
        embed.fields = [
            {
                name: "Results",
                value: await results(interaction.message),
            },
        ];
        await interaction.message.edit({ embeds: [embed] });
    }
}
