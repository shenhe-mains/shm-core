const { ButtonInteraction } = require("discord.js");
const { config } = require("../../core/config");
const { parse_int_or_fail, parse_bool_or_fail } = require("../../utils");

exports.commands = { "setup-react-roles": setup };

exports.listeners = { interactionCreate: [check_react_role] };

async function setup(ctx, args) {
    const bar = await ctx.parse_role(config.reactrole_block);
    const channel = await ctx.user_input({
        title: "Welcome to the reaction role builder",
        prompt: "Please enter the channel to post to (`here` for here). [60s limit]",
        parse: ctx.parse_channel.bind(ctx),
    });
    var title = await ctx.user_input({
        title: "Embed Title",
        prompt: "Please enter the title of the reaction role embed. [5m limit]",
        timelimit: 300000,
    });
    var message = await ctx.user_input({
        title: "Embed Message",
        prompt:
            "Please enter the message that will go in the embed (for example, explaining what the roles are for). " +
            "To avoid pings, you can surround your message with three backticks before and after " +
            "(``\u200b`\u200b`\u200b` message `\u200b`\u200b`\u200b``) and I will ignore them. [5m limit]",
        timelimit: 300000,
    });
    if (message.startsWith("```") && message.endsWith("```")) {
        message = message.substring(3, message.length - 3).trim();
    }
    const rows = [];
    for (var x = 1; x <= 5; ++x) {
        const count = await ctx.user_input({
            title: `Row ${x}`,
            prompt: `Working on button row ${x} / 5. Please enter how many buttons you want on this row (max. 5)${
                x == 1 ? "" : ", or `0` to stop"
            }. [60s limit]`,
            parse: (text) => parse_int_or_fail(text, x == 1 ? 1 : 0, 5),
        });
        if (count == 0) break;
        const row = [];
        for (var y = 1; y <= count; ++y) {
            const role = await ctx.user_input({
                title: `Row ${x} Column ${y} - Role`,
                prompt: `Working on row ${x} button ${y}. Please enter the role that you would like to be assigned when this button is pressed (must be strictly below ${bar}). [60s limit]`,
                parse: async (text) => {
                    const role = await ctx.parse_role(text);
                    if (role.comparePositionTo(bar) >= 0) throw 0;
                    return role;
                },
            });
            const label = await ctx.user_input({
                title: `Row ${x} Column ${y} - Label`,
                prompt: `Working on row ${x} button ${y}. Please enter the label to give the button. [60s limit]`,
            });
            row.push({
                role: role.id,
                label: label,
            });
        }
        rows.push(row);
    }
    const unique = await ctx.user_input({
        title: "Unique Roles",
        prompt: "Lastly, do you want these roles to be unique? That is, if a user assigns a role to themselves, all other roles available in the prompt will be removed. (yes/no) [60s limit]",
        parse: parse_bool_or_fail,
    });
    await channel.send({
        embeds: [
            {
                title: title,
                description: message,
                color: config.color,
            },
        ],
        components: rows.map((row) => ({
            type: "ACTION_ROW",
            components: row.map(({ role, label }) => ({
                type: "BUTTON",
                style: "PRIMARY",
                label: label,
                customId: `reactroles.${unique ? "unique" : "normal"}.${role}`,
            })),
        })),
    });
}

async function check_react_role(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (!interaction.customId.startsWith("reactroles.")) return;
    var [_, unique, role] = interaction.customId.split(".");
    unique = unique == "unique";
    role = await interaction.guild.roles.fetch(role);
    if (role === null) return;
    if (interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.remove(role, "reaction role");
        await interaction.reply({
            embeds: [
                {
                    title: "Reaction Role Removed",
                    description: `I have removed ${role} from you.`,
                    color: config.color,
                },
            ],
            ephemeral: true,
        });
    } else {
        if (unique) {
            await interaction.member.roles.remove(
                interaction.message.components.flatMap((row) =>
                    row.components.map(
                        (button) => button.customId.split(".")[2]
                    )
                ),
                "unique reaction role removes other roles"
            );
        }
        await interaction.member.roles.add(role, "reaction role");
        await interaction.reply({
            embeds: [
                {
                    title: "Reaction Role Added",
                    description: `I have given you ${role}`,
                    color: config.color,
                },
            ],
            ephemeral: true,
        });
    }
}
