const { has_permission } = require("../../core/privileges");
const {
    has_trigger,
    create_trigger,
    remove_trigger,
    client,
    set_trigger_allow,
    get_trigger_allow,
    get_trigger,
} = require("../../db");
const {
    PermissionError,
    ArgumentError,
    UserError,
    Info,
} = require("../../errors");
const { pagify } = require("../../pages");
const { checkCount, inline_code, english_list } = require("../../utils");

exports.commands = {
    "add-trigger": add_trigger,
    "rm-trigger": rm_trigger,
    "wildcard-trigger": trigger_setting("wildcard", true),
    "exact-trigger": trigger_setting("wildcard", false),
    "public-trigger": trigger_setting("public", true),
    "private-trigger": trigger_setting("public", false),
    "no-reply-trigger": trigger_setting("reply", 0),
    "reply-trigger": trigger_setting("reply", 1),
    "ping-reply-trigger": trigger_setting("reply", 2),
    "allow-trigger": trigger_override(true),
    "disallow-trigger": trigger_override(false),
    "list-triggers": trigger_list,
    "trigger-info": trigger_info,
};

exports.listeners = {
    messageCreate: [check_triggers],
};

function check_perms(ctx) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings including triggers."
        );
    }
}

async function get_match(body) {
    const match = body.trim().toLowerCase();
    if (!(await has_trigger(match))) {
        throw new UserError("That string is not being matched.");
    }
    return match;
}

async function add_trigger(ctx, args, body) {
    check_perms(ctx);
    var match, response;
    if (body.indexOf(";;") == -1) {
        match = args.shift();
        response = args.join(" ");
    } else {
        [match, response] = body.split(";;", 2).map((s) => s.trim());
    }
    match = match.toLowerCase();
    if (!match) {
        throw new ArgumentError("Please provide a non-empty trigger.");
    }
    if (!response) {
        throw new ArgumentError("Please provide a non-empty response.");
    }
    if (await has_trigger(match)) {
        throw new UserError("That string is already being matched.");
    }
    await create_trigger(match, false, true, 0, response);
}

async function rm_trigger(ctx, args, body) {
    check_perms(ctx);
    await remove_trigger(await get_match(body));
}

function trigger_setting(key, value) {
    return async (ctx, args, body) => {
        check_perms(ctx);
        await client.query(`UPDATE triggers SET ${key} = $1 WHERE match = $2`, [
            value,
            await get_match(body),
        ]);
    };
}

function trigger_override(allow) {
    return ((allow) => async (ctx, args, body) => {
        check_perms(ctx);
        checkCount(args, 1, Infinity);
        const channel = await ctx.parse_channel(args[0]);
        const key = args[0];
        body = body.substring(key.length).trim();
        await set_trigger_allow(await get_match(body), channel.id, allow);
    })(allow);
}

async function info(entry) {
    const opposite = (
        await client.query(
            `SELECT channel_id FROM trigger_allow WHERE match = $1 AND allow = $2`,
            [entry.match, !entry.public]
        )
    ).rows;
    return `Matches: ${inline_code(entry.match)}\nResponds: ${inline_code(
        entry.response
    )}\n${
        entry.wildcard
            ? "This is a wildcard match (matches any message that contains this string)"
            : "This only matches messages exactly equal to this string"
    }\nThis is ${entry.public ? "allowed" : "disallowed"} in all channels${
        opposite.length > 0 ? " except " : ""
    }${english_list(opposite.map((entry) => `<#${entry.channel_id}>`))}.`;
}

async function trigger_list(ctx, args) {
    checkCount(args, 0);
    const fields = [];
    for (var entry of (await client.query(`SELECT * FROM triggers`)).rows) {
        fields.push({
            name: "Trigger",
            value: await info(entry),
        });
    }
    if (fields.length == 0) {
        throw new Info(
            "Autoresponder Triggers",
            "There are no triggers set up right now."
        );
    }
    await pagify(
        ctx,
        { title: "Autoresponder Triggers", color: "GREY" },
        fields,
        5
    );
}

async function trigger_info(ctx, args, body) {
    const match = await get_match(body);
    throw new Info(
        "Autoresponder Trigger Info",
        await info(await get_trigger(match))
    );
}

async function check_triggers(discord_client, message) {
    if (message.guild === undefined) return;
    if (message.webhookId !== null) return;
    if (message.author.bot) return;
    const content = message.content.toLowerCase();
    for (var entry of (await client.query(`SELECT * FROM triggers`)).rows) {
        if (
            entry.wildcard ? content.match(entry.match) : content == entry.match
        ) {
            if (await get_trigger_allow(entry.match, message.channel.id)) {
                if (entry.reply == 0) {
                    await message.channel.send(entry.response);
                } else if (entry.reply == 1) {
                    await message.reply({
                        content: entry.response,
                        allowedMentions: { repliedUser: false },
                    });
                } else if (entry.reply == 2) {
                    await message.reply({ content: entry.response });
                }
            }
        }
    }
}
