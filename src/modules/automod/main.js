const { config } = require("../../core/config");
const { mute, kick, ban } = require("../../core/moderation");
const { has_permission } = require("../../core/privileges");
const { add_warn } = require("../../db");
const { Info } = require("../../errors");
const { inline_code, checkCount } = require("../../utils");

const DEFER = 0;
const DELETE = 1;
const VERBAL = 2;
const WARN = 3;
const MUTE = 4;
const KICK = 5;
const BAN = 6;

const CASE_SENSITIVE = 4;

const severities = ["defer", "delete", "verbal", "warn", "mute", "kick", "ban"];

const user_messages = [
    "",
    "",
    "This is just a verbal warning regarding a message you sent. This does not go on your record, but please keep it in mind in the future.",
    "This is a warning regarding a message you sent.",
    "You have been muted for a message you sent, and a moderator will evaluate the situation shortly.",
    "You have been kicked for a message you sent. You may rejoin whenever you want, but please think over your actions and words more carefully.",
    "You have been banned for a message you sent, and a moderator will evaluate the situation shortly.",
];

const terms = [
    ["amtestdefer", DEFER],
    ["amtestdelete", DELETE],
    ["amtestverbal", VERBAL],
    ["amtestwarn", WARN],
    ["amtestmute", MUTE],
    ["amtestkick", KICK],
    ["amtestban", BAN],
];

const info_header =
    "The automoderator will scan messages for potential bad words and take appropriate actions, such as warnings or muting if necessary.";
const banned_words = `
- hello
- world
`;

function word(term, case_sensitive) {
    return new RegExp(
        `(^|\b|(?<=[^A-Za-z]))${term}(?=\b|[^A-Za-z]|$)`,
        case_sensitive ? "" : "i"
    );
}

exports.commands = { "automod-info": automod_info };

exports.listeners = {
    messageCreate: [automod_scan],
    messageUpdate: [
        async (client, before, after) => await automod_scan(client, after),
    ],
};

async function automod_info(ctx, args) {
    checkCount(args, 0);
    throw new Info(
        "Automod Information",
        info_header,
        (embed) => (
            ((embed.fields = [{ name: "Banned Words", value: banned_words }]),
            (embed.footer = {
                text: "Feel free to suggest any changes to this.",
            })),
            embed
        )
    );
}

async function automod_scan(client, message) {
    if (!message.guild || message.guild.id != config.guild) return;
    if (message.author.id == client.user.id) return;
    var author;
    try {
        author = await message.guild.members.fetch(message.author.id);
    } catch {
        return;
    }
    if (has_permission(author, "automod_immunity")) return;

    var result = -1;
    var matches = [];
    var match;

    for (var [term, severity] of terms) {
        match = undefined;
        if (term instanceof RegExp) {
            match = term.exec(message.content);
            console.log(match);
            match &&= match[0];
        } else {
            if (message.content.match(term)) {
                match = term;
            }
        }
        if (match !== undefined && match !== null) {
            result = Math.max(result, severity);
            matches.push(match);
        }
    }

    if (result == -1) return;

    const fields = [
        {
            name: "Author",
            value: message.author.toString(),
            inline: true,
        },
        {
            name: "Channel",
            value: message.channel.toString(),
            inline: true,
        },
        {
            name: "Content",
            value: inline_code(message.content, 1024),
            inline: false,
        },
        {
            name: "Detected",
            value: matches
                .map((match, index) => `${index + 1}. ${inline_code(match)}`)
                .join("\n"),
            inline: false,
        },
    ];

    var embed = {
        title: "Automod Alert",
        description: `Bad phrase(s) detected with \`${severities[result]}\` severity.`,
        url: message.url,
        fields: fields,
        color: config.color,
    };

    const logs = await client.channels.fetch(config.channels.logs);
    const watchlist = await client.channels.fetch(config.channels.watchlist);
    const modchat = await client.channels.fetch(config.channels.mod);

    var channel;

    if (result == DEFER) {
        embed.description += " I am deferring this report to you.";
        channel = modchat;
    } else if (result == DELETE) {
        await message.delete();
        embed.description += " I silently deleted this message.";
        channel = watchlist;
    } else if (result == VERBAL) {
        embed.description += " I sent an unlogged warning to this user.";
        channel = watchlist;
    } else if (result == WARN) {
        embed.description += " I warned this user.";
        channel = watchlist;
    } else if (result == MUTE) {
        embed.description +=
            " I have muted this user indefinitely; please evaluate the situation.";
        channel = modchat;
    } else if (result == KICK) {
        embed.description += " I have kicked this user.";
        channel = watchlist;
    } else if (result == BAN) {
        embed.description +=
            " I have banned this user indefinitely; please evaluate the situation.";
        channel = modchat;
    }

    var log = await channel.send({ embeds: [embed] });
    await logs.send({
        embeds: [
            {
                title: "Automod Action",
                description: `Action Taken: ${severities[result]}`,
                url: log.url,
                fields: fields,
                color: config.color,
            },
        ],
    });

    if (result <= DELETE) return;

    await message.delete();

    embed = {
        title: "Automod Action",
        description: user_messages[result],
        fields: [fields[2], fields[3]],
        color: config.color,
        footer: { text: "You can respond here to open a modmail thread." },
    };

    try {
        await author.send({ embeds: [embed] });
    } finally {
        if (result == WARN) {
            await add_warn(
                client.user.id,
                author.id,
                "automod action",
                log.url
            );
        } else if (result == MUTE) {
            await mute(log, author, 0, "automod action", true);
        } else if (result == KICK) {
            await kick(log, author, "automod action", true);
        } else if (result == BAN) {
            await ban(log, author.id, 0, "automod action", true);
        }
    }
}
