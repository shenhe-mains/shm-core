const { MessageEmbed } = require("discord.js");
const { config } = require("../../core/config");
const { get_webhook } = require("../../core/webhooks");
const { shorten } = require("../../utils");

exports.listeners = {
    messageUpdate: [log_update],
    messageDelete: [log_delete],
};

function is_loggable(message) {
    if (message.guild === undefined) return false;
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
                } on <t:${Math.floor(before.createdTimestamp / 1000)}>`,
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
    const hook = await get_log_webhook(client);
    await hook.send({
        embeds: [
            {
                title: "Message Deleted",
                description: `Sent by ${message.author} in ${
                    message.channel
                } on <t:${Math.floor(message.createdTimestamp / 1000)}>\n\n${
                    message.content
                }`,
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
        files: message.attachments.toJSON().map((attachment) => ({
            attachment: attachment.url,
            name: "SPOILER_" + attachment.name,
        })),
    });
}
