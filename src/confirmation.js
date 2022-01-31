const { ButtonInteraction } = require("discord.js");

const authors = {};
const resolves = {};
const rejects = {};

exports.confirmationPrompt = async function (
    ctx,
    embed,
    confirm_message,
    cancel_message
) {
    confirm_message ||= "Proceed";
    cancel_message ||= "Cancel";
    const message = await ctx.reply({
        embeds: [embed],
        components: [
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "BUTTON",
                        style: "SUCCESS",
                        customId: "confirm.confirm",
                        label: confirm_message,
                    },
                    {
                        type: "BUTTON",
                        style: "DANGER",
                        customId: "confirm.cancel",
                        label: cancel_message,
                    },
                ],
            },
        ],
        allowedMentions: { repliedUser: false },
    });
    authors[message.id] = ctx.author.id;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            delete authors[message.id];
            delete resolves[message.id];
            delete rejects[message.id];
            reject(message);
        }, 600000);
        resolves[message.id] = (interaction) => {
            try {
                clearTimeout(timeout);
            } finally {
                resolve(interaction);
            }
        };
        rejects[message.id] = (interaction) => {
            try {
                clearTimeout(timeout);
            } finally {
                reject(interaction);
            }
        };
    });
};

exports.confirmationInteraction = async function (client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (authors.hasOwnProperty(interaction.message.id)) {
        if (authors[interaction.message.id] != interaction.user.id) {
            await interaction.reply({
                content:
                    "You cannot interact with this prompt since you were not the author.",
                ephemeral: true,
            });
            return;
        }
        if (interaction.customId == "confirm.confirm") {
            resolves[interaction.message.id](interaction);
        } else {
            rejects[interaction.message.id](interaction);
        }
        delete authors[interaction.message.id];
        delete resolves[interaction.message.id];
        delete rejects[interaction.message.id];
    }
};
