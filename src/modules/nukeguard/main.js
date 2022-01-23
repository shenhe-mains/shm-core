const { config } = require("../../core/config");
const { has_permission } = require("../../core/privileges");
const {
    is_protected,
    add_ban,
    remove_user_role,
    add_user_role,
    get_users_by_role,
} = require("../../db");
const { PermissionError, ArgumentError, Success } = require("../../errors");
const { checkCount, pluralize } = require("../../utils");

exports.commands = { "restore-role": restore_role };

exports.listeners = {
    channelDelete: [check_channel_nuke],
    guildMemberUpdate: [sync_user_roles],
    roleDelete: [check_role_nuke],
};

async function check_channel_nuke(client, channel) {
    if (await is_protected(channel.id)) {
        for (var [key, entry] of (
            await channel.guild.fetchAuditLogs({
                type: "CHANNEL_DELETE",
            })
        ).entries) {
            if (
                entry.targetType == "CHANNEL" &&
                entry.target.id == channel.id
            ) {
                const admin_alert = await (
                    await client.channels.fetch(config.channels.admin)
                ).send({
                    embeds: [
                        {
                            title: "NukeGuard Alert: Channel Deleted",
                            description: `${channel.name} (\`${channel.id}\`) was just deleted by ${entry.executor}, so I have banned them indefinitely for now. Please evaluate the situation.`,
                            color: "PURPLE",
                        },
                    ],
                });
                try {
                    await entry.executor.send(
                        `Your deletion of ${channel.name} (\`${channel.id}\`) has been logged for admin review. Don't worry if this was a legitimate action; you will be unbanned shortly if so.`
                    );
                } finally {
                    await add_ban(
                        client.user.id,
                        entry.executor.id,
                        0,
                        `[nukeguard] deleted channel ${channel.name} (\`${channel.id}\`)`,
                        admin_alert.url
                    );
                    await channel.guild.bans.create(entry.executor);
                }
                return;
            }
        }
    }
}

const locked = new Set();

async function sync_user_roles(client, before, after) {
    const roles_before = new Set(before.roles.cache.map((role) => role.id));
    const roles_after = new Set(after.roles.cache.map((role) => role.id));

    for (var id of roles_before) {
        setTimeout(
            ((id) => () => {
                if (locked.has(id)) return;
                if (!roles_after.has(id)) {
                    remove_user_role(before.id, id);
                }
            })(id),
            5000
        );
    }

    for (var id of roles_after) {
        if (!roles_before.has(id)) {
            await add_user_role(before.id, id);
        }
    }
}

async function check_role_nuke(client, role) {
    locked.add(role.id);
    const user_ids = await get_users_by_role(role.id);
    await (
        await client.channels.fetch(config.channels.admin)
    ).send({
        embeds: [
            {
                title: "NukeGuard Alert: Role Deleted",
                description: `${role.name} (\`${
                    role.id
                }\`) was just deleted, and I recorded ${
                    user_ids.length
                } member${pluralize(
                    user_ids.length
                )} as having that role before it was removed. You can run \`${
                    config.prefix
                }restore-role ${
                    role.id
                } <new role>\` to add a new role to all users who had the old role.`,
                color: "PURPLE",
            },
        ],
    });
}

async function restore_role(ctx, args) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to use that command."
        );
    }
    checkCount(args, 2);
    const id = args[0];
    const role = await ctx.parse_role(args[1]);

    const user_ids = await get_users_by_role(id);

    if (user_ids.length == 0) {
        throw new Success(
            "No members to modify",
            "I do not remember any members as having a role by that ID."
        );
    }

    const interaction = await ctx.confirmOrCancel({
        title: "Restoring role",
        description: `This operation will grant ${role} to ${
            user_ids.length
        } up to member${pluralize(user_ids.length)}`,
    });

    const size = Math.min(50, Math.floor(user_ids.length / 4));
    const embed = {
        title: `Restoring role for ${user_ids.length} member${pluralize(
            user_ids.length
        )}`,
        description: `Progress: 0 / ${user_ids.length} (0%)`,
        color: "DARK_AQUA",
    };
    await interaction.message.edit({ embeds: [embed], components: [] });

    var progress = 0;
    var success = 0;
    for (var user_id of user_ids) {
        try {
            var member = await ctx.guild.members.fetch(user_id);
            await member.roles.add(role);
            ++success;
        } catch {}
        ++progress;
        if (progress % size == 0) {
            embed.description = `Progress: ${progress} / ${user_ids.length} (${(
                (progress / user_ids.length) *
                100
            ).toFixed(2)}%)`;
            await interaction.message.edit({ embeds: [embed] });
        }
    }
    await interaction.message.edit({
        embeds: [
            {
                title: `Restored role for ${success} member${pluralize(
                    success
                )}`,
                description: `Successfully granted ${role} to ${success} member${pluralize(
                    success
                )}. (attempted ${user_ids.length})`,
                color: "GREEN",
            },
        ],
    });
}
