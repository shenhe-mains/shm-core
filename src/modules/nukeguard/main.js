const { config } = require("../../core/config");
const { is_protected, add_ban } = require("../../db");

exports.commands = { "restore-role": restore_role };

exports.listeners = {
    channelDelete: [check_channel_nuke],
};

async function check_channel_nuke(client, channel) {
    if (await is_protected(channel.id)) {
        for (var [, entry] of (
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
