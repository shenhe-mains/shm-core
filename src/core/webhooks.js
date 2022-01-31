const { config, modify } = require("./config");

exports.get_webhook = async function (client, channel, id, name, avatar) {
    name ||= "Shenhe";
    avatar ||= client.user.avatarURL({ dynamic: true });
    var hook;
    if (config.webhooks[id]) {
        hook = (await channel.fetchWebhooks()).get(config.webhooks[id]);
        if (hook !== undefined) return hook;
    }
    hook = await channel.createWebhook(name, {
        avatar: avatar,
        reason: `Persistent webhook "${id}"`,
    });
    config.webhooks[id] = hook.id;
    modify({ webhooks: config.webhooks });
    return hook;
};
