delete require.cache[require.resolve("./utils")];

const { DMChannel, ButtonInteraction } = require("discord.js");
const { config } = require("../../core/config");
const { has_permission } = require("../../core/privileges");
const { is_modmail_channel, get_modmail_for_channel } = require("../../db");
const { PermissionError, Success, Info, UserError } = require("../../errors");
const { checkCount } = require("../../utils");
const {
    get_modmail_channel,
    has_modmail_channel,
    relay_incoming,
    relay_outgoing,
    close_modmail_channel,
} = require("./utils");

exports.commands = {
    modmail: modmail,
    reply: reply(true),
    anonreply: reply(false),
    close: close(true),
    silentclose: close(false),
    delete: delete_channel,
};

exports.listeners = {
    channelDelete: [check_modmail_deleted],
    interactionCreate: [check_modmail_confirm],
    messageCreate: [check_modmail],
};

const opening_content = {};

async function modmail(ctx, args) {
    if (!has_permission(ctx.author, "modmail")) {
        throw new PermissionError(
            "You do not have permission to use modmail from the staff side."
        );
    }
    checkCount(args, 1);
    const member = await ctx.parse_member(args[0]);
    const exists = await has_modmail_channel(ctx.client, member.user);

    throw new (exists ? Info : Success)(
        exists ? "Modmail Channel Exists" : "Modmail Channel Created",
        (
            await get_modmail_channel(
                ctx.client,
                ctx.author.user,
                ctx.guild,
                member.user
            )
        ).toString()
    );
}

async function assert_modmail(ctx) {
    if (!(await is_modmail_channel(ctx.channel.id))) {
        throw new UserError(
            "This command can only be used in modmail channels."
        );
    }
}

function reply(show_identity) {
    return async (ctx, args, body) => {
        await assert_modmail(ctx);
        await relay_outgoing(
            ctx.client,
            ctx.guild,
            ctx.channel,
            ctx.author,
            ctx.message,
            body,
            show_identity
        );
    };
}

function close(announce) {
    return async (ctx, args) => {
        await assert_modmail(ctx);
        checkCount(args, 0);
        await close_modmail_channel(
            ctx.client,
            ctx.author.user,
            announce,
            await get_modmail_for_channel(ctx.channel.id)
        );
    };
}

async function delete_channel(ctx, args) {
    await assert_modmail(ctx);
    checkCount(args, 0);
    await ctx.channel.delete(`modmail thread closed by ${ctx.author.id}`);
}

async function check_modmail_confirm(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (interaction.customId == "modmail.create") {
        if (!opening_content.hasOwnProperty(interaction.message.id)) {
            await interaction.reply(
                "Sorry, I can no longer find that message in my cache. It may have been too long; please send your message again."
            );
            await interaction.message.edit({ components: [] });
            return;
        }
        const message = opening_content[interaction.message.id];
        await relay_incoming(
            client,
            await client.guilds.fetch(config.guild),
            message
        );
        try {
            await message.react("✅");
        } catch {}
        await interaction.update({
            embeds: [
                {
                    title: "Modmail Sent!",
                    description:
                        "Your message has been forwarded to the staff and will be looked at as soon as we can. Thanks!",
                    color: "GREEN",
                },
            ],
            components: [],
        });
    } else if (interaction.customId == "modmail.cancel") {
        await interaction.update({
            embeds: [
                {
                    title: "Your message has been received!",
                    color: "GREEN",
                },
            ],
            components: [],
        });
    }
}

async function check_modmail(client, message) {
    if (message.author.id == client.user.id) return;
    if (message.channel instanceof DMChannel) {
        try {
            var guild, member;
            try {
                guild = await client.guilds.fetch(config.guild);
                member = await guild.members.fetch(message.author.id);
            } catch {
                await message.reply({
                    embeds: [
                        {
                            title: "Error fetching member data",
                            description:
                                "Sorry, I wasn't able to fetch your member information. If you are in the SHM server, please let a developer know about this issue.",
                            color: "RED",
                        },
                    ],
                });
                return;
            }
            if (!member.roles.cache.has(config.verify)) {
                await message.reply({
                    embeds: [
                        {
                            title: "Please verify yourself",
                            description:
                                "Hello! If you would like to use the modmail feature, please go to <#930568867602894878> and verify yourself first.",
                            color: config.color,
                        },
                    ],
                });
                return;
            }
            if (await has_modmail_channel(client, message.author)) {
                await relay_incoming(client, guild, message);
                try {
                    await message.react("✅");
                } catch {}
            } else {
                const confirmation = await message.reply({
                    embeds: [
                        {
                            title: "Send modmail?",
                            description:
                                "Hello! I have received your message. Would you like to send this message as modmail to the server's staff team? If you just meant to send me a personal message, I'm glad to have received it! <:ShenheHeart:854344834244542484>",
                            color: config.color,
                        },
                    ],
                    components: [
                        {
                            type: "ACTION_ROW",
                            components: [
                                {
                                    type: "BUTTON",
                                    style: "SUCCESS",
                                    customId: "modmail.create",
                                    label: "Send Modmail",
                                },
                                {
                                    type: "BUTTON",
                                    style: "SECONDARY",
                                    customId: "modmail.cancel",
                                    label: "Just a message for Shenhe",
                                },
                            ],
                        },
                    ],
                });
                opening_content[confirmation.id] = message;
                setTimeout(() => {
                    delete opening_content[confirmation.id];
                }, 3600000);
            }
        } catch {
            console.error(error);
            await message.reply(
                "Sorry, an unexpected error occurred. Please let a developer know if this persists."
            );
        }
    }
}

async function check_modmail_deleted(client, channel) {
    if (!(await is_modmail_channel(channel.id))) return;
    for (var [key, entry] of (
        await channel.guild.fetchAuditLogs({ type: "CHANNEL_DELETE" })
    ).entries) {
        if (entry.targetType == "CHANNEL" && entry.target.id == channel.id) {
            await close_modmail_channel(
                client,
                entry.executor,
                await get_modmail_for_channel(channel.id)
            );
            return;
        }
    }
}
