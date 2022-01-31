const { Message, GuildMember, User } = require("discord.js");
const { get_starboard_message, set_starboard_message } = require("../../db");
const { client } = require("../../client");
const { config } = require("../../core/config");

exports.listeners = {
    messageDelete: [check_star_delete],
    messageDeleteBulk: [check_star_delete_bulk],
    messageReactionAdd: [check_stars],
    messageReactionRemove: [check_stars],
    messageReactionRemoveAll: [check_stars],
    messageReactionRemoveEmoji: [check_stars],
};

async function get_star_link(message_id) {
    const result = await get_starboard_message(message_id);
    if (result === undefined) return undefined;
    try {
        return await (
            await client.channels.fetch(result.channel_id)
        ).messages.fetch(result.relayed_id);
    } catch {
        return undefined;
    }
}

function normalize(user) {
    if (user instanceof User) return user;
    if (user instanceof GuildMember) return user.user;
    throw 0;
}

async function check_stars(client, item) {
    const message = item instanceof Message ? item : item.message;
    if (message.content == null) await message.fetch();
    const public =
        config.private_categories.indexOf(message.channel.parentId) == -1;
    const reactions = message.reactions.cache.get("⭐");
    const count = reactions ? reactions.count : 0;
    const msg = await get_star_link(message.id);
    if (
        count <
        (public ? config.public_star_threshold : config.private_star_threshold)
    ) {
        if (msg) {
            await msg.delete();
        }
    } else {
        const content = `🌟 **${count}**  ${message.channel}`;
        if (msg) {
            await msg.edit({ content: content });
        } else {
            const user = normalize(message.author);
            var image;
            const attachments = [];
            for (const attachment of message.attachments.values()) {
                if (
                    !image &&
                    attachment.contentType.match("image") &&
                    !attachment.name.startsWith("SPOILER_")
                ) {
                    image = attachment.url;
                } else {
                    attachments.push(attachment.url);
                }
            }
            const embed = {
                description: message.content,
                fields: [
                    {
                        name: "Source",
                        value: `[Jump!](${message.url})`,
                    },
                    attachments.length
                        ? {
                              name: "Attachments",
                              value: attachments.join("\n"),
                          }
                        : [],
                ].flat(),
                author: {
                    name: `${user.username}#${user.discriminator}`,
                    iconURL: user.avatarURL({ dynamic: true }),
                },
                footer: { text: message.id },
                image: image ? { url: image } : null,
                color: config.color,
            };
            const channel = await client.channels.fetch(
                public
                    ? config.channels.public_starboard
                    : config.channels.private_starboard
            );
            const link = await channel.send({
                content: content,
                embeds: [embed],
            });
            await set_starboard_message(message.id, channel.id, link.id);
        }
    }
}

async function check_star_delete(client, message) {
    const msg = await get_star_link(message.id);
    if (msg) {
        await msg.delete();
    }
}

async function check_star_delete_bulk(client, messages) {
    for (const message of messages.values()) {
        await check_star_delete(client, message);
    }
}
