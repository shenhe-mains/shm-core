const { Message } = require("discord.js");
const { confirmationPrompt } = require("./confirmation");
const { config } = require("./core/config");
const {
    warn,
    mute,
    kick,
    ban,
    unmute,
    unban,
    massban,
    verbal,
} = require("./core/moderation");
const {
    parse_member,
    parse_user_id,
    parse_user,
    parse_channel,
    parse_channel_id,
    parse_role,
    parse_role_id,
    parse_message,
} = require("./core/parsing");
const { Canceled } = require("./errors");
const { user_input } = require("./utils");

exports.Context = class {
    constructor(client, message) {
        this.client = client;
        this.message = message;
    }

    async init() {
        const message = this.message;

        this.author = await message.guild.members.fetch(message.author.id);
        this.channel = message.channel;
        this.guild = message.guild;
        this.url = message.url;
    }

    async reply() {
        return await this.message.reply(...arguments);
    }

    async replyEmbed(embed, ping) {
        return await this.message.reply({
            embeds: [embed],
            allowedMentions: { repliedUser: ping || false },
        });
    }

    async send() {
        return await this.channel.send(...arguments);
    }

    async delete() {
        return await this.message.delete();
    }

    async edit() {
        return await this.message.edit(...arguments);
    }

    async verbal(member, reason) {
        return await verbal(this, member, reason);
    }

    async warn(member, reason, no_dm) {
        return await warn(this, member, reason, no_dm);
    }

    async mute(member, duration, reason, no_dm) {
        return await mute(this, member, duration, reason, no_dm);
    }

    async kick(member, reason, no_dm) {
        return await kick(this, member, reason, no_dm);
    }

    async ban(user_id, duration, reason, no_dm, days) {
        return await ban(this, user_id, duration, reason, no_dm, days);
    }

    async massban(user_ids, duration, reason, days, callback) {
        return await massban(this, user_ids, duration, reason, days, callback);
    }

    async unmute(member, reason, no_dm) {
        return await unmute(this, member, reason, no_dm);
    }

    async unban(user_id, reason) {
        return await unban(this, user_id, reason);
    }

    async parse_member(string) {
        return await parse_member(this, string);
    }

    async parse_user(string) {
        return await parse_user(this, string);
    }

    parse_user_id(string) {
        return parse_user_id(this, string);
    }

    async parse_role(string) {
        return await parse_role(this, string);
    }

    parse_role_id(string) {
        return parse_role_id(this, string);
    }

    async parse_channel(string) {
        return await parse_channel(this, string);
    }

    parse_channel_id(string) {
        return parse_channel_id(this, string);
    }

    async parse_message(string) {
        return await parse_message(this, string);
    }

    async confirm(embed, confirm_message, cancel_message) {
        return await confirmationPrompt(
            this,
            embed,
            confirm_message,
            cancel_message
        );
    }

    async confirmOrCancel(embed, confirm_message, cancel_message) {
        try {
            const interaction = await this.confirm(
                embed,
                confirm_message,
                cancel_message
            );
            await interaction.update({ components: [] });
            return interaction;
        } catch (interaction) {
            if (interaction instanceof Message) {
                await interaction.edit({
                    embeds: [
                        {
                            title: "Timed Out",
                            description: "Operation was not confirmed in time.",
                            color: "RED",
                        },
                    ],
                    components: [],
                });
            } else {
                await interaction.update({
                    embeds: [
                        {
                            title: "Canceled",
                            description: "Operation canceled by user",
                            color: "RED",
                        },
                    ],
                    components: [],
                });
            }
            throw new Canceled();
        }
    }

    async user_input(options) {
        return await user_input(this.channel, this.author, options);
    }

    async log() {
        await (
            await this.client.channels.fetch(config.channels.logs)
        ).send(...arguments);
    }
};
