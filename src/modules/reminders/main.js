const { has_permission } = require("../../core/privileges");
const {
    PermissionError,
    ArgumentError,
    Info,
    UserError,
} = require("../../errors");
const { parse_duration } = require("../../core/parsing");
const { checkCount, parse_int_or_fail } = require("../../utils");
const {
    add_reminder,
    reminder_exists,
    rm_reminder,
    get_reminders,
    reminder_owner,
    all_reminders,
} = require("../../db");
const { config } = require("../../core/config");
const { pagify } = require("../../pages");
const { client } = require("../../client");

exports.commands = {
    remind: remind,
    reminders: reminders,
    "rm-remind": remove_remind,
};

exports.log_exclude = ["remind", "reminders", "rm-remind"];

exports.shutdown = async function () {
    for (const id in timeouts) clearTimeout(timeouts[id]);
};

all_reminders().then((entries) => entries.forEach(set_reminder));

const timeouts = {};

function set_reminder(reminder) {
    timeouts[reminder.id] = setTimeout(() => {
        reminder_exists(reminder.id).then((x) => {
            if (x) {
                rm_reminder(reminder.id);
                client.users.fetch(reminder.user_id).then((user) =>
                    user.send({
                        embeds: [
                            {
                                title: `Reminder #${reminder.id}`,
                                description: `You asked me [here](${
                                    reminder.origin
                                }) to remind you${
                                    reminder.content
                                        ? ` about:\n\n${reminder.content}`
                                        : ""
                                }`,
                                color: config.color,
                            },
                        ],
                    })
                );
            }
        });
    }, reminder.time - new Date());
}

async function remind(ctx, args) {
    checkCount(args, 1, Infinity);
    const duration = parse_duration(args);
    if (duration == 0) {
        throw new ArgumentError(
            "Please enter a finite interval for the reminder."
        );
    }
    const now = new Date();
    now.setSeconds(now.getSeconds() + duration);
    const body = args.join(" ");
    const reminder = await add_reminder(
        ctx.message.id,
        ctx.author.id,
        now,
        body,
        ctx.message.url
    );
    set_reminder(reminder);
    return {
        title: `Reminder Set (#${reminder.id})`,
        description: `I will DM you <t:${Math.floor(now.getTime() / 1000)}:R>${
            body ? `about ${inline_code(body)}` : ""
        }.`,
    };
}

async function reminders(ctx, args) {
    checkCount(args, 0);
    const reminders = await get_reminders(ctx.author.id);
    if (reminders.length == 0) {
        throw new Info("Reminders", "You have no reminders set.");
    }
    await pagify(
        ctx,
        {
            title: "Reminders",
            color: "GREY",
        },
        reminders.map((reminder) => ({
            title: `Reminder #${reminder.id}`,
            description: `${reminder.time}: ${inline_code(reminder.content)}`,
        })),
        5
    );
    throw new Info();
}

async function remove_remind(ctx, args) {
    checkCount(args, 1);
    const id = parse_int_or_fail(args[0], 1, Infinity);
    if (!(await reminder_exists(id))) {
        throw new ArgumentError("That reminder does not exist.");
    }
    if ((await reminder_owner(id)) != ctx.author.id) {
        throw new PermissionError("That is not your reminder.");
    }
    await rm_reminder(id);
    delete timeouts[id];
}
