const { ButtonInteraction } = require("discord.js");
const { has_permission } = require("../../core/privileges");
const { PermissionError } = require("../../errors");
const { checkCount } = require("../../utils");
const { config } = require("../../core/config");
const { link_user, rmap } = require("../../core/verification");

exports.commands = { "post-verify": post_verify };

exports.listeners = { interactionCreate: [check_verify] };

async function post_verify(ctx, args) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to update bot settings such as via verification."
        );
    }
    checkCount(args, 1);

    const channel = await ctx.parse_channel(args[0]);
    await channel.send({
        embeds: [
            {
                title: "**__※ Verification__**",
                description:
                    "After you've read the rules, please press the button below to verify yourself.",
            },
        ],
        components: [
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "BUTTON",
                        style: "PRIMARY",
                        customId: "verification.verify",
                        label: "I have read the rules and agree to abide by them",
                    },
                ],
            },
        ],
    });
}

async function check_verify(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (interaction.customId != "verification.verify") return;
    if (interaction.member.roles.cache.has(config.verify)) {
        await interaction.reply({
            content: "You are already verified!",
            ephemeral: true,
        });
        return;
    }
    var key;
    if (rmap.hasOwnProperty(interaction.user.id)) {
        key = rmap[interaction.user.id];
    } else {
        var key = "";
        for (var x = 0; x < 32; x++) {
            key +=
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(
                    Math.floor(Math.random() * 62)
                );
        }
        link_user(key, interaction.member);
    }
    await interaction.reply({
        embeds: [
            {
                title: "Verification",
                description: `Please complete the captcha challenge here: https://shenhemains.com/captcha/${key}`,
                color: config.color,
            },
        ],
        ephemeral: true,
    });
}
