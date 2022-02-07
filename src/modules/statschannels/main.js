const { config } = require("../../core/config");

exports.listeners = {
    guildMemberUpdate: [check_boosters],
    guildMemberAdd: [check_member_count],
    guildMemberRemove: [check_member_count],
};

async function check_boosters(client, before, after) {
    const channel = await client.channels.fetch(config.channels.boost_count);
    await channel.edit({
        name: `✧・ Boosts: ${before.guild.premiumSubscriptionCount}`,
    });
}

async function check_member_count(client, member) {
    const channel = await client.channels.fetch(config.channels.member_count);
    await channel.edit({
        name: `✦・ Disciples: ${(await member.guild.members.fetch()).size}`,
    });
}
