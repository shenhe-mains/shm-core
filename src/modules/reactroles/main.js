const { ButtonInteraction } = require("discord.js");
const { config } = require("../../core/config");
const { PermissionError } = require("../../errors");
const { parse_int_or_fail, parse_bool_or_fail } = require("../../utils");
const { has_permission } = require("../../core/privileges");

exports.commands = { "setup-react-roles": setup };

exports.listeners = { interactionCreate: [check_react_role] };

async function setup(ctx, args) {
    if (!has_permission(ctx.author, "reactroles")) {
        throw new PermissionError(
            "You do not have permission to set up reaction roles."
        );
    }
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
        prompt: "Do you want these roles to be unique? That is, if a user assigns a role to themselves, all other roles available in the prompt will be removed. (yes/no) [60s limit]",
        parse: parse_bool_or_fail,
    });
    const lock =
        unique &&
        (await ctx.user_input({
            title: "Lock Roles",
            prompt: "On top of making roles unique, do you want users to lock in their roles? That is, if a user has a role that is available in the prompt, they will not be allowed to use the prompt again. (yes/no) [60s limit]",
            parse: parse_bool_or_fail,
        }));
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
                customId: `reactroles.${
                    lock ? "lock" : unique ? "unique" : "normal"
                }.${role}`,
            })),
        })),
    });
}

async function check_react_role(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (!interaction.customId.startsWith("reactroles.")) return;
    var [_, unique, role] = interaction.customId.split(".");
    const lock = unique == "lock";
    unique = unique == "unique";
    role = await interaction.guild.roles.fetch(role);
    if (role === null) return;
    if (interaction.member.roles.cache.has(role.id)) {
        if (lock) {
            await interaction.reply({
                embeds: [
                    {
                        title: "Reaction Role Locked",
                        description:
                            "This role is locked and cannot be removed.",
                        color: "RED",
                    },
                ],
                ephemeral: true,
            });
            return;
        }
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
        const roles = [
            ...interaction.message.components.flatMap((row) =>
                row.components.map((button) => button.customId.split(".")[2])
            ),
        ];
        if (unique) {
            await interaction.member.roles.remove(
                roles,
                "unique reaction role removes other roles"
            );
        } else if (lock) {
            if (roles.any((role) => interaction.member.roles.has(role))) {
                await interaction.reply({
                    embeds: [
                        {
                            ttile: "Reaction Role Locked",
                            description:
                                "You already have another role. It cannot be changed because the role is locked.",
                            color: "RED",
                        },
                    ],
                });
                return;
            }
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
