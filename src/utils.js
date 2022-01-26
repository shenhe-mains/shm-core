const { MessageEmbed } = require("discord.js");
const { config } = require("./core/config");
const { CommandSyntaxError } = require("./errors");

exports.pluralize = pluralize = function (x, a, b) {
    return x == 1 ? b || "" : a || "s";
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
