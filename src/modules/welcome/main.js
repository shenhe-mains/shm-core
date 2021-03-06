const { config } = require("../../core/config");

exports.listeners = { guildMemberAdd: [welcome] };

async function welcome(client, member) {
    if (member.guild.id != config.guild) return;
    const channel = await client.channels.fetch(config.channels.welcome);
    await channel.send({
        content: `**Welcome to Shenhe Mains, ${member}!**`,
        embeds: [
            {
                title: `✧・ **__Welcome to Shenhe Mains!__** ・✧`,
                description: `Hi, ${member}! We hope you enjoy your stay! To get started, make sure to read <#805458033252892789> and follow the instructions there.\n\nDon't forget to pick up your roles in <#901510802727636992> as well!`,
                thumbnail: { url: member.user.avatarURL({ dynamic: true }) },
                image: {
                    url: "https://shenhemains.com/static/images/animated-banner.gif",
                },
                footer: {
                    iconURL: "https://shenhemains.com/static/images/cryo.png",
                    text: `✧ We now have ${member.guild.memberCount} members!`,
                },
                color: config.color,
            },
        ],
    });
}
