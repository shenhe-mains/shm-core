const { MessageEmbed } = require("discord.js");
const { config } = require("../../core/config");
const { get_webhook } = require("../../core/webhooks");
const { shorten, censor_attachments } = require("../../utils");

exports.listeners = {
    messageUpdate: [log_update],
    messageDelete: [log_delete],
    messageDeleteBulk: [log_delete_bulk],
    voiceStateUpdate: [log_voice_change],
};

function is_loggable(message) {
    if (message.content === null) return false;
    if (message.guild != config.guild) return false;
    if (message.webhookId !== null) return false;
    if (message.author.bot) return false;
    if (
        config.log_ignore.indexOf(message.channel.id) != -1 ||
        (message.channel.parentId &&
            config.log_ignore.indexOf(message.channel.parentId) != -1)
    )
        return false;
    return true;
}

async function get_log_webhook(client) {
    const channel = await client.channels.fetch(config.channels.message_logs);
    return await get_webhook(
        client,
        channel,
        "message_logs",
        "Shenhe Message Logs"
    );
}

function timestamp(item) {
    return `<t:${Math.floor(item.createdTimestamp / 1000)}>`;
}

async function log_update(client, before, after) {
    if (!is_loggable(before)) return;
    const hook = await get_log_webhook(client);
    if (before.content == after.content) return;
    await hook.send({
        embeds: [
            new MessageEmbed({
                title: "Message Edited",
                description: `Sent by ${before.author} in ${
                    before.channel
                } on ${timestamp(before)}`,
                url: before.url,
                fields: [
                    {
                        name: "Before",
                        value: shorten(before.content, 1024),
                    },
                    {
                        name: "After",
                        value: shorten(after.content, 1024),
                    },
                ],
                color: "YELLOW",
            }),
        ],
    });
}

async function log_delete(client, message) {
    if (!is_loggable(message)) return;
    await (
        await get_log_webhook(client)
    ).send({
        embeds: [
            {
                title: "Message Deleted",
                description: `Sent by ${message.author} in ${
                    message.channel
                } on ${timestamp(message)}\n\n${message.content}`,
                url: message.url,
                fields: message.reference
                    ? [
                          {
                              name: "Reference",
                              value: `https://discord.com/channels/${message.reference.guildId}/${message.reference.channelId}/${message.reference.messageId}`,
                          },
                      ]
                    : [],
                color: "RED",
            },
        ],
        files: censor_attachments(message),
    });
}

async function log_delete_bulk(client, message_list) {
    const rows = [];
    const messages = [];
    for (const message of message_list.values()) {
        if (!is_loggable(message)) continue;
        messages.push(message);
    }
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const message of messages) {
        rows.push(
            ...`${message.author}: ${message.content}`.split("\n"),
            ...message.attachments.toJSON().map((attachment) => attachment.url)
        );
    }
    if (rows.length == 0) return;
    const hook = await get_log_webhook(client);
    const url = messages[0].url;
    const header = `${messages[0].channel} ${timestamp(
        messages[0]
    )} - ${timestamp(messages[messages.length - 1])}\n`;
    while (rows.length > 0) {
        var message = header;
        var added = false;
        while (rows.length > 0) {
            if (message.length + 1 + rows[0].length <= 4096) {
                message += "\n" + rows.shift();
                added = true;
            } else {
                break;
            }
        }
        if (!added) {
            const length = 4096 - 1 - message.length;
            message = rows[0].substring(0, length);
            rows[0] = rows[0].substring(length);
        }
        await hook.send({
            embeds: [
                {
                    title: "Messages Purged",
                    description: message,
                    url: url,
                    color: "RED",
                },
            ],
        });
    }
}

async function log_voice_change(client, before, after) {
    if (after.guild != config.guild) return;
    const user = after.member.user;
    if (user.bot) return;
    const c1 = before.channel;
    const c2 = after.channel;
    if ((c1 && c1.id) == (c2 && c2.id)) return;
    const logs = await client.channels.fetch(config.channels.message_logs);
    if (!c1) {
        await logs.send({
            embeds: [
                {
                    title: "User joined voice channel",
                    description: `${user} (${user.tag}) joined ${c2}`,
                    color: "GREEN",
                },
            ],
        });
    } else if (!c2) {
        await logs.send({
            embeds: [
                {
                    title: "User left voice channel",
                    description: `${user} (${user.tag}) left ${c1}`,
                    color: "RED",
                },
            ],
        });
    } else {
        await logs.send({
            embeds: [
                {
                    title: "User switched voice channels",
                    description: `${user} (${user.tag}) moved from ${c1} to ${c2}`,
                    color: "GOLD",
                },
            ],
        });
    }
}
