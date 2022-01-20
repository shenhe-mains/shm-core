const { ArgumentError, CommandSyntaxError } = require("../errors");
const { inline_code } = require("../utils");

exports.parse_user_id = parse_user_id = function (ctx, string) {
    if (string == "myself") {
        return ctx.author.id;
    } else if (string.match(/^(<@!?\d+>|\d+)$/)) {
        return /\d+/.exec(string)[0];
    } else {
        throw new ArgumentError(
            `${inline_code(
                string
            )} is not a valid representation of a user (you can use their ID or mention them directly, or \`myself\` to refer to yourself).`
        );
    }
};

exports.parse_member = async function (ctx, string) {
    const id = parse_user_id(ctx, string);
    try {
        return await ctx.guild.members.fetch(id);
    } catch {
        throw new ArgumentError(
            "Error fetching member; I could not find them in this server."
        );
    }
};

exports.parse_user = async function (ctx, string) {
    const id = parse_user_id(ctx, string);
    try {
        return await ctx.client.users.fetch(id);
    } catch {
        throw new ArgumentError(
            "Error fetching user; I don't think they exist."
        );
    }
};

exports.parse_channel_id = parse_channel_id = function (ctx, string) {
    if (string == "here") {
        return ctx.channel.id;
    } else if (string.match(/^(<#\d+>|\d+)$/)) {
        return /\d+/.exec(string)[0];
    } else {
        throw new ArgumentError(
            `${inline_code(
                string
            )} is not a valid representation of a channel (you can use its ID or mention it directly, or \`here\` to refer to the current channel).`
        );
    }
};

exports.parse_channel = async function (ctx, string) {
    const id = parse_channel_id(ctx, string);
    try {
        return await ctx.guild.channels.fetch(id);
    } catch {
        throw new ArgumentError(
            "Error fetching channel; I could not find it in this server."
        );
    }
};

exports.parse_duration = function (args, error_on_fail) {
    if (args.length == 0) {
        return 0;
    }

    if (args[0] == "forever" || args[0] == "0") {
        args.shift();
        return 0;
    }

    if (args[0].match(/^\d+$/)) {
        throw new CommandSyntaxError(
            `${args[0]} of what unit? Please specify a time unit if you meant to provide a duration, or \`forever\`.`
        );
    }

    if (args[0].match(/^(\d+[smhdw])+$/i)) {
        var re = /(\d+)(.)/g;
        var s = args.shift();
        var duration = 0;
        var m;
        do {
            m = re.exec(s);
            if (m) {
                var scalar;
                switch (m[2].toLowerCase()) {
                    case "s":
                        scalar = 1;
                        break;
                    case "m":
                        scalar = 60;
                        break;
                    case "h":
                        scalar = 3600;
                        break;
                    case "d":
                        scalar = 86400;
                        break;
                    case "w":
                        scalar = 604800;
                        break;
                    default:
                        throw `Unrecognized time unit \`${m[2]}\`. This is not supposed to happen.`;
                }
                duration += parseInt(m[1]) * scalar;
            }
        } while (m);

        return duration;
    }

    if (error_on_fail) {
        throw new CommandSyntaxError(
            `I did not understand ${inline_code(args[0])} as a duration.`
        );
    }

    return 0;
};
