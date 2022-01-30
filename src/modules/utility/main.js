const { Info, PermissionError } = require("../../errors");
const { checkCount } = require("../../utils");
const { ranks, has_permission } = require("../../core/privileges");
const { reload } = require("../../core/config");

exports.commands = {
    ranks: _ranks,
    "reload-config": reload_config,
    clone: clone,
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
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to command the bot like that."
        );
    }
    const channel = await ctx.parse_channel(args[0]);
    const message = await ctx.parse_message(args[1]);
    const response = {
        embeds: message.embeds,
        components: message.components,
    };
    if (message.content) response.content = message.content;
    await channel.send(response);
}
