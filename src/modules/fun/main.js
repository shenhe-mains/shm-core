const { ButtonInteraction } = require("discord.js");
const { ArgumentError, Success } = require("../../errors");
const { checkCount } = require("../../utils");

exports.commands = { choose: choose, fight: fight };

exports.listeners = { interactionCreate: [checkFun] };

async function choose(ctx, args, body) {
    var options;
    if (body.match(",")) {
        options = body.split(",").map((s) => s.trim());
    } else {
        options = args;
    }
    if (options.length == 0) {
        throw new ArgumentError("Please provide at least one choice.");
    }
    return {
        title: "Choice",
        description: options[Math.floor(Math.random() * options.length)],
    };
}

const fight_actions = [
    ["{1} stabbed {2}!", 30, 40],
    ["{1} shot {2}!", 60, 80],
    ["{1} punched {2}!", 10, 20],
    ["{1} threw a leaf at {2}!", 0, 0],
    ["{1} ran over {2}!", 50, 100],
];

async function fight(ctx, args) {
    checkCount(args, 2, Infinity);
    const users = [];
    for (var arg of args) {
        users.push([await ctx.parse_member(arg), 100]);
    }
    const rows = [];
    while (users.length > 1) {
        const [action, min, max] =
            fight_actions[Math.floor(Math.random() * fight_actions.length)];
        const target = Math.floor(Math.random() * (users.length - 1)) + 1;
        rows.append(
            action
                .replaceAll("{1}", users[0][0].toString())
                .replaceAll("{2}", users[target][0].toString()) +
                ` ${users[target][0]} now has ${users[target][1]} HP.`
        );
        users[target][1] -= Math.floor(Math.random() * (max - min)) + min;
        if (users[target][1] < 0) {
            rows.append(`${users[target]} is out of the fight!`);
            users.splice(target, 1);
        }
        users.push(users.shift());
    }
    rows.append(`${users[0]} is victorious!`);
    return {
        title: "Fight Result",
        description: rows.join("\n"),
    };
}

async function checkFun(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
}
