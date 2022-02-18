const { config } = require("../../core/config");
const { mute, kick, ban } = require("../../core/moderation");
const { has_permission } = require("../../core/privileges");
const {
    add_warn,
    has_automod_term,
    add_automod_term,
    remove_automod_term,
    get_automod_terms,
    add_automod_report,
} = require("../../db");
const { PermissionError, ArgumentError, Info } = require("../../errors");
const { pagify } = require("../../pages");
const { inline_code, checkCount } = require("../../utils");

const DEFER = 0;
const DELETE = 1;
const VERBAL = 2;
const WARN = 3;
const MUTE = 4;
const KICK = 5;
const BAN = 6;

const severities = ["defer", "delete", "verbal", "warn", "mute", "kick", "ban"];
const term_types = ["substring", "word", "regex"];
const term_match = [
    (match, content) => (content.toLowerCase().match(match) ? match : false),
    (match, content) =>
        ((m) => m && m[0])(
            new RegExp(
                `(^|\\b|(?<=[^A-Za-z]))${match}(?=\\b|[^A-Za-z]|$)`,
                "i"
            ).exec(content)
        ),
    (match, content) =>
        ((m) => m && m[0])(new RegExp(match, "i").exec(content)),
];

const user_messages = [
    "",
    "",
    "This is just a verbal warning regarding a message you sent. This does not go on your record, but please keep it in mind in the future.",
    "This is a warning regarding a message you sent.",
    "You have been muted for a message you sent, and a moderator will evaluate the situation shortly.",
    "You have been kicked for a message you sent. You may rejoin whenever you want, but please think over your actions and words more carefully.",
    "You have been banned for a message you sent, and a moderator will evaluate the situation shortly.",
];

exports.commands = {
    "automod-add": automod_add,
    "automod-rm": automod_rm,
    "automod-scan": bisect,
    "automod-list": automod_list,
};

exports.listeners = {
    messageCreate: [automod_scan],
    messageUpdate: [
        async (client, before, after) => await automod_scan(client, after),
    ],
};

async function automod_add(ctx, args, body) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings such as automod terms."
        );
    }
    checkCount(args, 3, Infinity);
    const type = term_types.indexOf(args[0]);
    if (type == -1) {
        throw new ArgumentError(
            "Expected one of `substring`, `word`, `regex` in argument 1."
        );
    }
    const severity = severities.indexOf(args[1]);
    if (severity == -1) {
        throw new ArgumentError(
            "Expected one of `defer`, `delete`, `verbal`, `warn`, `mute`, `kick`, `ban` in argument 2."
        );
    }
    const match = body.substring(args[0].length + args[1].length + 2);
    if (await has_automod_term(match)) {
        throw new ArgumentError("That string is already being matched.");
    }
    await add_automod_term(match, type, severity);
}

async function automod_rm(ctx, args, body) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings such as automod terms."
        );
    }
    checkCount(args, 1, Infinity);
    if (!(await has_automod_term(body))) {
        throw new ArgumentError("That string is not being matched.");
    }
    await remove_automod_term(body);
}

async function bisect(ctx, args, body) {
    const { result } = await scan(body, true);
    throw new Info(
        "Automod Scan Result",
        result == -1
            ? "No match."
            : `Matched with action \`${severities[result]}\``
    );
}

async function automod_list(ctx, args) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to view this setting. Normally, read-only actions are open to everyone, but this command posts offensive terms."
        );
    }
    checkCount(args, 0);
    const entries = [];
    for (const entry of await get_automod_terms()) {
        entries.push({
            name: "Automod Term",
            value: `${inline_code(entry.match)}\nScan type: \`${
                term_types[entry.type]
            }\`\nAction: \`${severities[entry.severity]}\``,
            inline: true,
        });
    }
    await pagify(
        ctx,
        { title: "Automod - Banned Terms", color: "GREY" },
        entries,
        12
    );
}

async function scan(content, fake) {
    var result = -1;
    var matches = [];

    for (const entry of await get_automod_terms()) {
        const match = term_match[entry.type](entry.match, content);
        if (!match) continue;
        result = Math.max(result, entry.severity);
        matches.push(match);
        if (!fake) await add_automod_report(entry.match);
    }

    return {
        result: result,
        matches: matches,
    };
}

async function automod_scan(client, message) {
    if (!message.guild || message.guild.id != config.guild) return;
    if (message.author.id == client.user.id) return;
    if (
        config.automod_ignore.indexOf(message.channel.id) != -1 ||
        (message.channel.parentId &&
            config.automod_ignore.indexOf(message.channel.parentId) != -1)
    )
        return;
    var author;
    if (message.webhookId === null) {
        try {
            author = await message.guild.members.fetch(message.author.id);
        } catch {
            return;
        }
    }
    if (author !== undefined && has_permission(author, "automod_immunity")) {
        return;
    }

    const { result, matches } = await scan(message.content);

    if (result == -1) return;

    if (author === undefined) {
        if (result != DEFER) {
            await message.delete();
        }
        return;
    }

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
