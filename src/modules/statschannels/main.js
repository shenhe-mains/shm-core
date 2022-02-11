const { config } = require("../../core/config");

exports.listeners = {
    guildMemberUpdate: [check_boosters],
    guildMemberAdd: [check_member_count],
    guildMemberRemove: [check_member_count],
};

async function check_boosters(client, before, after) {
    setTimeout(() => {
        if (before.guild.id != config.guild) return;
        await client.channels
            .fetch(config.channels.boost_count)
            .then((channel) =>
                channel.edit({
                    name: `✧・ Boosts: ${before.guild.premiumSubscriptionCount}`,
                })
            );
    }, 10000);
}

async function check_member_count(client, member) {
    if (member.guild.id != config.guild) return;
    const channel = await client.channels.fetch(config.channels.member_count);
    await channel.edit({
        name: `✦・ Disciples: ${member.guild.memberCount}`,
    });
}
