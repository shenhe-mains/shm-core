const { Context } = require("../../context");
const { config } = require("../../core/config");
const {
    get_modmail_channel,
    set_modmail_channel,
    create_modmail_message,
    get_modmail_for_channel,
    close_modmail_channel,
} = require("../../db");
const { UserError } = require("../../errors");
const { censor_attachments } = require("../../utils");
const { commands } = require("../moderation/main");

exports.log = log = async function (client, ...args) {
    await (
        await client.channels.fetch(config.channels.modmail_logs)
    ).send(...args);
};

exports.has_modmail_channel = _has_modmail_channel = async function (
    client,
    user
) {
    try {
        await client.channels.fetch(await get_modmail_channel(user.id));
        return true;
    } catch {
        return false;
    }
};

exports.get_modmail_channel = _get_modmail_channel = async function (
    client,
    opener,
    guild,
    user
) {
    try {
        return await client.channels.fetch(await get_modmail_channel(user.id));
    } catch {
        var channel, success;
        const name = `${user.username}-${user.discriminator}`;
        const topic = `Modmail with ${user}`;
        try {
            channel = await (
                await client.channels.fetch(config.channels.modmail_category)
            ).createChannel(name, { topic: topic });
            success = true;
        } catch {
            channel = await guild.channels.create(name, { topic: topic });
            success = false;
        }
        try {
            await log(client, {
                embeds: [
                    {
                        title: "Modmail Channel Created",
                        description: `A modmail channel was just opened with ${user} by ${opener}: ${channel}.${
                            success
                                ? ""
                                : " I was not able to put it in the modmail category."
                        }`,
                        color: "GREEN",
                    },
                ],
            });
        } finally {
            try {
                const message = await channel.send({
                    embeds: [
                        {
                            title: "New Modmail Channel",
                            description: `This is a modmail channel for ${user}. Use \`${config.prefix}reply <message>\` or \`${config.prefix}anonreply <message>\`, and once you're done, \`${config.prefix}close\` to close the thread (this will alert the user that the thread has been closed; use \`${config.prefix}silentclose\` if you wish to avoid that). Call \`${config.prefix}delete\` to delete the channel once it's closed.`,
                            author: {
                                name: user.tag,
                                iconURL: user.avatarURL({ dynamic: true }),
                            },
                            color: "GREEN",
                        },
                    ],
                });
                const ctx = new Context(client, message);
                await ctx.init();
                await commands.history(ctx, [user.id]);
            } finally {
                await set_modmail_channel(user.id, channel.id);
                await create_modmail_message(user.id, opener, 3);
                return channel;
            }
        }
    }
};

exports.close_modmail_channel = async function (
    client,
    closer,
    announce,
    user_id,
    channel_id
) {
    if (announce) {
        try {
            await (
                await client.users.fetch(user_id)
            ).send({
                embeds: [
                    {
                        title: "Modmail Thread Closed",
                        description:
                            "Your modmail channel with the Shenhe Mains staff has been closed. We hope we were able to help you. If you would like to open another modmail thread, you can simply send me another message at any time. Thanks!",
                        color: config.color,
                    },
                ],
            });
        } catch {}
    }
    await create_modmail_message(user_id, closer, 4);
    await close_modmail_channel(user_id, channel_id);
    const url = `https://shenhemains.com/dashboard/modmail/${user_id}`;
    await log(client, {
        embeds: [
            {
                title: "Modmail Channel Closed",
                description: `The modmail thread with <@${user_id}> was just closed by ${closer}. You can view it [here](${url}).`,
                url: url,
                color: "RED",
            },
        ],
    });
};

function translate_content(message, content) {
    const files = message.attachments.toJSON();
    if (files.length > 0) {
        content += "\n\nAttachments:";
        for (const file of files) {
            content += `\n<a href="${file.url}" target="_blank">${file.url}</a>`;
        }
    }
    return content;
}

exports.relay_incoming = async function (client, guild, message) {
    const channel = await _get_modmail_channel(
        client,
        message.author,
        guild,
        message.author
    );
    await channel.send({
        embeds: [
            {
                title: "Incoming Message",
                description: message.content,
                author: {
                    name: message.author.tag,
                    iconURL: message.author.avatarURL({ dynamic: true }),
                },
                color: "AQUA",
            },
        ],
        files: censor_attachments(message),
    });
    await create_modmail_message(
        message.author.id,
        message.author,
        0,
        translate_content(message, message.content)
    );
};

exports.relay_outgoing = async function (
    client,
    guild,
    channel,
    sender,
    message,
    content,
    show_identity
) {
    var member;
    try {
        member = await guild.members.fetch(
            await get_modmail_for_channel(channel.id)
        );
    } catch {
        throw new UserError(
            "I could not get the user connected to this channel. They might not be in the server anymore."
        );
    }
    const embed = {
        title: "Incoming Message from Staff",
        description: content,
        color: config.color,
        author: show_identity
            ? {
                  name: sender.user.tag,
                  iconURL: sender.user.avatarURL({ dynamic: true }),
              }
            : null,
        footer: {
            text: show_identity
                ? sender.roles.highest.name
                : "Anonymous Message",
        },
    };
    try {
        await member.user.send({
            embeds: [embed],
            files: censor_attachments(message, true),
        });
    } catch {
        throw new UserError(
            "I was not able to forward this message. They might not have DMs open."
        );
    }
    try {
        embed.title = "Outgoing Message";
        await channel.send({
            embeds: [embed],
            files: censor_attachments(message, true),
        });
    } finally {
        await create_modmail_message(
            member.id,
            sender.user,
            show_identity ? 1 : 2,
            translate_content(message, content)
        );
    }
};
