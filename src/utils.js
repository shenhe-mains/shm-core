const { MessageEmbed } = require("discord.js");
const { config } = require("./core/config");
const { CommandSyntaxError, Canceled, ArgumentError } = require("./errors");

exports.pluralize = pluralize = function (x, a, b) {
    if (a === undefined) a = "s";
    if (b === undefined) b = "";
    return x == 1 ? b : a;
};

function substring_if(string, length) {
    if (length === undefined || isNaN(length)) return string;
    return string.substring(0, length);
}

exports.inline_code = inline_code = function (string, max_length) {
    return string.indexOf("\n") == -1 && string.indexOf("`") == -1
        ? `\`${substring_if(string, max_length - 2)}\``
        : `\`\`\`\n${substring_if(
              string.replaceAll("`", "\u200B`"),
              max_length - 8
          )}\n\`\`\``;
};

exports.for_duration = for_duration = function (duration) {
    if (duration <= 0) {
        return "";
    }
    var components = [];
    for (var [cap, name] of [
        [60, "second"],
        [60, "minute"],
        [24, "hour"],
    ]) {
        var amt = duration % cap;
        duration = Math.floor(duration / cap);
        if (amt > 0) {
            components.push(`${amt} ${name}${pluralize(amt)}`);
        }
    }
    if (duration > 0) {
        components.push(`${duration} day${pluralize(duration)}`);
    }
    return " for " + english_list(components);
};

exports.english_list = english_list = function (values, joiner) {
    joiner ||= "and";
    if (values.length == 0) {
        return "";
    } else if (values.length == 1) {
        return values[0];
    } else if (values.length == 2) {
        return values.join(` ${joiner} `);
    } else {
        return (
            values.slice(0, values.length - 1).join(", ") +
            `, ${joiner} ` +
            values[values.length - 1]
        );
    }
};

exports.shorten = function (string, length) {
    return string.length <= length
        ? string
        : string.substring(0, length - 3) + "...";
};

exports.checkCount = checkCount = function (args, min, max) {
    if (max === undefined) max = min;
    if (args.length != min && min == max) {
        throw new CommandSyntaxError(
            `Expected ${min} argument${pluralize(min)} but got ${args.length}.`
        );
    } else if (args.length < min) {
        throw new CommandSyntaxError(
            `Expected at least ${min} argument${pluralize(min)} but got ${
                args.length
            }.`
        );
    } else if (args.length > max) {
        throw new CommandSyntaxError(
            `Expected at most ${max} argument${pluralize(max)} but got ${
                args.length
            }.`
        );
    }
};

exports.dm = async function (member, title, description, footer) {
    if (footer === undefined) {
        footer = true;
    }
    return await member.send({
        embeds: [
            {
                color: config.color,
                title: title,
                description: description,
                footer: footer
                    ? {
                          text: "You can respond here to open a modmail thread.",
                      }
                    : null,
            },
        ],
    });
};

exports.censor_attachments = function (message, send_original) {
    return message.attachments.toJSON().map((attachment) => ({
        attachment: attachment.url,
        name: (send_original ? "" : "SPOILER_") + attachment.name,
    }));
};

exports.shuffle = function (array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

exports.user_input = async function (channel, user, options) {
    const title =
        options.title === undefined ? "Waiting for User Input" : options.title;
    const prompt = options.prompt || "";
    const filter = options.filter || ((x) => true);
    const parse = options.parse || (async (x) => x);
    const on_fail = options.on_fail;
    const timelimit = options.timelimit || 60000;
    await channel.send({
        embeds: [{ title: title, description: prompt, color: "ORANGE" }],
    });
    const _filter = (message) =>
        message.author.id == user.id && filter(message);
    while (true) {
        var message;
        try {
            message = (
                await channel.awaitMessages({
                    filter: _filter,
                    max: 1,
                    time: timelimit,
                    errors: ["time"],
                })
            ).first();
        } catch {
            await channel.send({
                embeds: [
                    {
                        title: "Timed Out",
                        description:
                            "This input prompt expired. Please restart the command if you would like to try again.",
                        color: "RED",
                    },
                ],
            });
            throw new Canceled();
        }
        try {
            return await parse(message.content);
        } catch {
            if (on_fail) {
                await channel.send({
                    embeds: [
                        {
                            title: "Invalid Input, please try again",
                            description: on_fail,
                            color: "ORANGE",
                        },
                    ],
                });
            }
        }
    }
};

exports.parse_int_or_fail = function (text, min, max) {
    const number = parseInt(text);
    if (isNaN(number)) {
        throw new ArgumentError("Expected an integer.");
    } else if (number < min) {
        throw new ArgumentError(`Expected at least ${min}.`);
    } else if (number > max) {
        throw new ArgumentError(`Expected at most ${max}.`);
    }
    return number;
};

const yes_responses = new Set(["true", "yes", "y"]);
const no_responses = new Set(["false", "no", "n"]);

exports.parse_bool_or_fail = function (text) {
    text = text.toLowerCase();
    if (yes_responses.has(text)) return true;
    if (no_responses.has(text)) return false;
    throw new ArgumentError("Expected a yes/no value.");
};
