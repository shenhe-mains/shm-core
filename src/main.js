const { config } = require("./core/config");
const db = require("./db");
const { get_command, handle_event } = require("./module_handler");
const {
    CommandSyntaxError,
    ArgumentError,
    Success,
    UserError,
    PermissionError,
    Info,
    PartialSuccess,
    Canceled,
} = require("./errors");
const { client } = require("./client");
const { Context } = require("./context");
const { shorten, inline_code } = require("./utils");

const data = require("../data.json");

process.on("uncaughtException", (error) => {
    console.error("UNEXPECTED UNCAUGHT EXCEPTION");
    console.error("=============================");
    console.error(error.stack);
});

client.on("ready", async () => {
    await db.client.connect();
    console.log("SHENHE CORE is ready.");
    handle_event("ready", client);
    await client.user.setPresence({
        activities: [
            {
                type: "LISTENING",
                name: "your DMs",
            },
        ],
    });
});

for (var key of [
    "channelDelete",
    "guildMemberAdd",
    "guildMemberRemove",
    "guildMemberUpdate",
    "interactionCreate",
    "messageDelete",
    "messageDeleteBulk",
    "messageReactionAdd",
    "messageReactionRemove",
    "messageReactionRemoveAll",
    "messageReactionRemoveEmoji",
    "messageUpdate",
    "roleDelete",
]) {
    client.on(
        key,
        (
            (k) =>
            async (...event) => {
                handle_event(k, client, ...event);
            }
        )(key)
    );
}

client.on("messageCreate", async (message) => {
    handle_event("messageCreate", client, message);
    if (
        message.guild !== undefined &&
        message.author != client.user &&
        message.webhookId === null &&
        message.content.startsWith(config.prefix)
    ) {
        const text = message.content.substring(config.prefix.length).trim();
        const [key] = text.split(/\s/, 1);
        const body = text.substring(key.length).trim();
        const args = body
            ? body.split(/\s+/).map((arg) => arg.replace("{NL}", "\n"))
            : [];
        const { execute, log } = get_command(key.toLowerCase());
        var ctx, color, title, description, status, reaction;
        try {
            if (execute !== undefined) {
                ctx = new Context(client, message);
                await ctx.init();
                const response = await execute(ctx, args, body, key);
                if (response === undefined) throw new Success();
                throw new Success(response.title, response.description);
            }
        } catch (error) {
            try {
                if (error instanceof CommandSyntaxError) {
                    color = "RED";
                    title = "Command Syntax Error";
                    description = error.message;
                    status = "syntax error";
                    reaction = "❌";
                } else if (error instanceof ArgumentError) {
                    color = "RED";
                    title = "Argument Error";
                    description = error.message;
                    status = "argument error";
                    reaction = "❌";
                } else if (error instanceof UserError) {
                    color = "RED";
                    title = "Error";
                    description = error.message;
                    status = "user error";
                    reaction = "❌";
                } else if (error instanceof PermissionError) {
                    color = "RED";
                    title = "Permission Error";
                    description = error.message;
                    status = "permission error";
                    reaction = "⛔";
                } else if (error instanceof Info) {
                    color = "GREY";
                    title = error.title;
                    description = error.message;
                    status = "information returned";
                    reaction = "ℹ️";
                } else if (error instanceof Canceled) {
                    color = "RED";
                    title = "Canceled";
                    description = error.message;
                    status = "canceled";
                    reaction = "🟥";
                } else if (error instanceof PartialSuccess) {
                    color = "GOLD";
                    title = error.title;
                    description = error.message;
                    status = "partial success";
                    reaction = "🟨";
                } else if (error instanceof Success) {
                    color = "GREEN";
                    title = error.title;
                    description = error.message;
                    status = "success";
                    reaction = "✅";
                } else {
                    throw error;
                }
                if (error.has_message) {
                    var embed = {
                        title: title,
                        description: description,
                        color: color,
                    };
                    if (error.modify !== undefined) {
                        embed = error.modify(embed) || embed;
                    }
                    await ctx.reply({
                        embeds: [embed],
                        allowedMentions: { repliedUser: false },
                    });
                }
                try {
                    await message.react(reaction);
                } catch {
                    // user probably blocked me
                }
            } catch (error) {
                color = "PURPLE";
                title = "Internal Error";
                description = error.stack
                    ? `An internal error has occurred. I'm not sure what it is, but hopefully this helps.
\`\`\`js
${error.stack.toString().substring(0, 4000)}
\`\`\``
                    : `An internal error has occurred. I'm not sure what it is; please check the logs.`;
                status = "internal error";
                reaction = "❕";
                console.error(error);
                await ctx.reply({
                    embeds: [
                        {
                            title: title,
                            description: description,
                            color: color,
                        },
                    ],
                    allowedMentions: { repliedUser: false },
                });
                try {
                    await message.react("❕");
                } catch {
                    // user probably blocked me
                }
            }
        }
        if (ctx !== undefined && log) {
            await ctx.log({
                embeds: [
                    {
                        title: "Command Executed",
                        fields: [
                            {
                                name: "Executor",
                                value: ctx.author.toString(),
                                inline: true,
                            },
                            {
                                name: "Channel",
                                value: ctx.channel.toString(),
                                inline: true,
                            },
                            { name: "Status", value: status, inline: true },
                            {
                                name: "Command",
                                value: inline_code(
                                    shorten(ctx.message.content, 256)
                                ),
                            },
                        ],
                        color: color,
                        url: ctx.url,
                    },
                ],
            });
        }
    }
});

client.login(data.discord_token);
