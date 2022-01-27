const { config } = require("../../core/config");
const { has_permission } = require("../../core/privileges");
const {
    has_sticky,
    create_sticky,
    set_sticky,
    get_sticky,
    delete_sticky,
} = require("../../db");
const { PermissionError, UserError } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = {
    stick: stick,
    stickstop: stickstop,
};

exports.listeners = {
    messageCreate: [update_stick],
};

async function stick(ctx, args, body) {
    if (!has_permission(ctx.author, "sticky")) {
        throw new PermissionError(
            "You do not have permission to sticky messages."
        );
    }
    if (await has_sticky(ctx.channel.id)) {
        throw new UserError("This channel already has a sticky message.");
    }
    if (!body) {
        throw new UserError("Please enter a non-empty sticky message.");
    }
    await create_sticky(ctx.channel.id, body);
    const message = await ctx.channel.send({
        content: body,
        allowedMentions: { users: [], roles: [] },
    });
    await ctx.message.delete();
    await set_sticky(ctx.channel.id, message.id);
}

async function stickstop(ctx, args) {
    if (!has_permission(ctx.author, "sticky")) {
        throw new PermissionError(
            "You do not have permission to unsticky messages."
        );
    }
    if (!(await has_sticky(ctx.channel.id))) {
        throw new UserError("This channel does not have a sticky message.");
    }
    checkCount(args, 0);
    await remove_sticky_message(ctx.channel, await get_sticky(ctx.channel.id));
    await delete_sticky(ctx.channel.id);
}

async function update_stick(client, message) {
    if (message.guild === undefined) return;
    if (message.author.id == client.user.id) return;
    if (
        message.content.startsWith(config.prefix) &&
        message.content.substring(config.prefix.length).trim() == "stickstop"
    )
        return;
    const channel = message.channel;
    const sticky = await get_sticky(channel.id);
    if (sticky === undefined) return;
    await remove_sticky_message(channel, sticky);
    const new_msg = await channel.send({
        content: sticky.content,
        allowedMentions: { user: [], roles: [] },
    });
    await set_sticky(channel.id, new_msg.id);
}

async function remove_sticky_message(channel, entry) {
    try {
        await (await channel.messages.fetch(entry.message_id)).delete();
    } catch {}
}
