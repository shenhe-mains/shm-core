const { Client, Intents } = require("discord.js");

exports.client = new Client({
    intents: new Intents(32767),
    partials: ["CHANNEL", "MESSAGE", "REACTION"],
});
