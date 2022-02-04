const { Info, PermissionError, UserError } = require("../../errors");
const { checkCount, censor_attachments } = require("../../utils");
const { ranks, has_permission } = require("../../core/privileges");
const { reload, modify, config } = require("../../core/config");

exports.commands = {
    ranks: _ranks,
    "reload-config": reload_config,
    clone: clone,
    webhook: webhook,
    point: point,
};

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
