const { Client, Intents, MessageEmbed } = require("discord.js");
const { config } = require("./core/config");

const { get_command, handle_event } = require("./module_handler");
const db = require("./db");

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
const { Context } = require("./context");
const { shorten, inline_code } = require("./utils");
require("./server");

process.on("uncaughtException", (error) => {
    console.error(error);
});

const client = new Client({ intents: new Intents(32767) });

client.on("ready", async () => {
    await db.client.connect();
    console.log("SHENHE CORE is ready.");
    handle_event("ready", client);
});

for (var key of ["interactionCreate"]) {
    client.on(
        key,
        (
            (k) =>
            async (...event) => {
                handle_event(k, ...event);
            }
        )(key)
    );
}

client.on("messageCreate", async (message) => {
    if (
        message.guild !== undefined &&
        message.author != client.user &&
        message.content.startsWith(config.prefix)
    ) {
        const args = message.content
            .substring(config.prefix.length)
            .trim()
            .split(/ +/);
        const command = args.shift().toLowerCase();
        const fn = get_command(command);
        var ctx, color, title, description, status, reaction;
        try {
            if (fn !== undefined) {
                ctx = new Context(client, message);
                await ctx.init();
                const response = await fn(ctx, args);
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
                    reaction = "❌";
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
                });
                try {
                    await message.react("❕");
                } catch {
                    //user probably blocked me
                }
            }
        }
        if (ctx !== undefined) {
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

client.login(config.discord_token);
