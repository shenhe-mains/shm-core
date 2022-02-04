const {
    Info,
    PermissionError,
    UserError,
    ArgumentError,
} = require("../../errors");
const { checkCount, censor_attachments } = require("../../utils");
const { ranks, has_permission } = require("../../core/privileges");
const { reload, modify, config } = require("../../core/config");
const { pagify } = require("../../pages");

exports.commands = {
    ranks: _ranks,
    "reload-config": reload_config,
    clone: clone,
    webhook: webhook,
    point: point,
    find: find(),
    "find-user": find("user"),
    "find-role": find("role"),
    "find-channel": find("channel"),
    info: info,
};

exports.log_exclude = [
    "find",
    "find-user",
    "find-role",
    "find-channel",
    "info",
];

async function _ranks(ctx, args) {
    checkCount(args, 0, 1);
    var member;
    if (args.length == 0) {
        member = ctx.author;
    } else {
        member = await ctx.parse_member(args[0]);
    }

    throw new Info(
        `${member.user.username}#${member.user.discriminator}'s ranks:`,
        ranks(member).join(", ") || "(none)"
    );
}

async function reload_config(ctx, args) {
    checkCount(args, 0);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to edit or reload bot settings."
        );
    }
    reload();
}

async function clone(ctx, args) {
    checkCount(args, 2);
    if (!has_permission(ctx.author, "send")) {
        throw new PermissionError(
            "You do not have permission to command the bot to send messages."
        );
    }
    const channel = await ctx.parse_channel(args[0]);
    const message = await ctx.parse_message(args[1]);
    const response = {
        embeds: message.embeds,
        components: message.components,
        files: censor_attachments(message, true),
    };
    if (message.content) response.content = message.content;
    await channel.send(response);
}

async function webhook(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "webhook")) {
        throw new PermissionError(
            "You do not have permission to alter or get the webhook."
        );
    }
    modify({
        webhook: args[0],
    });
}

async function point(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "webhook")) {
        throw new PermissionError(
            "You do not have permission to alter or get the webhook."
        );
    }
    const channel = await ctx.parse_channel(args[0]);
    const webhooks = await ctx.guild.fetchWebhooks();
    const webhook = webhooks.get(config.webhook);
    if (webhook === undefined) {
        throw new UserError(
            `This server's webhook is not set or the configured webhook no longer exists. ` +
                `Please set it using \`${config.prefix}webhook <id>\` (note: copy the ID and not the URL, as exposing the URL is a security issue).`
        );
    }
    await webhook.edit({
        channel: channel,
    });
    try {
        await ctx.author.send(webhook.url);
    } catch {}
}

function find(type) {
    return async (ctx, args, body) => {
        body = body.toLowerCase();
        if (body.length < 3) {
            throw new ArgumentError(
                "Please enter a search query of at least 3 characters to find."
            );
        }
        const items = [];
        if (type === undefined || type == "user") {
            for (const member of ctx.guild.members.cache.values()) {
                if (
                    member.displayName.toLowerCase().match(body) ||
                    member.user.username.toLowerCase().match(body)
                ) {
                    items.push(
                        `\`user ${member.id}\`: ${member} (${inline_code(
                            `${member.user.username}#${member.user.discriminator}`
                        )})`
                    );
                }
            }
        }
        if (type === undefined || type == "role") {
            for (const role of ctx.guild.roles.cache.values()) {
                if (role.name.toLowerCase().match(body)) {
                    items.push(`\`role ${role.id}\`: ${role}`);
                }
            }
        }
        if (type === undefined || type == "channel") {
            for (const channel of ctx.guild.channels.cache.values()) {
                if (channel.name.toLowerCase().match(body)) {
                    items.push(`\`chnl ${channel.id}\`: ${channel}`);
                }
            }
        }
        if (items.length == 0) {
            throw new Info(
                "No matches found",
                "Nothing was found for that query."
            );
        }
        await pagify(
            ctx,
            {
                title: "Matches",
                color: "GREY",
            },
            items,
            10,
            true
        );
        throw new Info();
    };
}

async function info(ctx, args) {}
