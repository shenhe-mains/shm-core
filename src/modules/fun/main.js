const { ButtonInteraction } = require("discord.js");
const { checkCount } = require("../../utils");

exports.commands = {};

exports.listeners = { interactionCreate: [checkFun] };

async function checkFun(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
}
