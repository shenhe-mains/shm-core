delete require.cache[require.resolve("./utils")];

const { ArgumentError, Success } = require("../../errors");
const { assert_supporter, get_role, remove_role } = require("./utils");
const { inline_code } = require("../../utils");
const { config } = require("../../core/config");

exports.commands = {
    "role-claim": role_name,
    "role-rename": role_name,
    "role-color": role_color,
    "role-colour": role_color,
};

exports.listeners = { guildMemberUpdate: [check_supporters] };

async function role_name(ctx, args) {
    assert_supporter(ctx);
    if (args.length == 0) {
        throw new ArgumentError("Please specify a non-empty name.");
    }
    const role = await get_role(ctx);
    await role.edit({ name: args.join(" ") });
    throw new Success(
        "Role Name Set",
        `Your custom role, ${role}, is now named ${inline_code(role.name)}`
    );
}

async function role_color(ctx, args) {
    assert_supporter(ctx);
    const role = await get_role(ctx);
    const color = args.join(" ").toUpperCase();
    if (args.length == 0) {
        role.edit({ color: null });
        throw new Success(
            "Role Color Reset",
            `Your custom role, ${role}, is no longer colored.`
        );
    } else {
        try {
            role.edit({ color: color });
            await ctx.reply({
                embeds: [
                    {
                        title: "Role Color Set",
                        description: `Your custom role, ${role}, has been recolored.`,
                        color: color,
                    },
                ],
                allowedMentions: { repliedUser: false },
            });
        } catch {
            throw new ArgumentError(
                `Could not parse ${inline_code(color)} as a color.`
            );
        }
    }
}

async function check_supporters(client, before, after) {
    const member = after;
    const roles_before = new Set(before.roles.cache.map((role) => role.id));
    const roles_after = new Set(after.roles.cache.map((role) => role.id));
    var supporter_before = false;
    var supporter = false;
    for (var key in config.support_roles) {
        if (roles_before.has(key)) supporter_before = true;
        if (roles_after.has(key)) {
            supporter = true;
            if (!roles_before.has(key)) {
                const data = config.support_roles[key];
                const role = await member.guild.roles.fetch(key);
                const count = role.members.size;
                if (data.title !== undefined || data.body !== undefined) {
                    await (
                        await client.channels.fetch(config.channels.boosts)
                    ).send({
                        embeds: [
                            {
                                title: eval(data.title),
                                description: eval(data.body),
                                thumbnail: { url: before.avatarURL() },
                                color: config.color,
                            },
                        ],
                    });
                }
            }
        }
    }

    if (supporter_before && !supporter) {
        await remove_role(member);
        await (
            await client.channels.fetch(config.channels.logs)
        ).send({
            embeds: [
                {
                    title: "User is no longer a supporter",
                    description: member.toString(),
                    fields: [
                        {
                            name: "Roles before",
                            value: before.roles.cache
                                .map((role) => role.toString())
                                .join(" "),
                        },
                        {
                            name: "Roles after",
                            value: after.roles.cache
                                .map((role) => role.toString())
                                .join(" "),
                        },
                    ],
                    color: config.color,
                },
            ],
        });
    }
}
