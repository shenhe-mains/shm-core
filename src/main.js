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
    if (process.argv.indexOf("bootup") != -1) {
        const guild = await client.guilds.fetch("805458032908959804");
        const channel = await guild.channels.fetch("958383282259644417");
        await channel.send({
            content: null,
            tts: false,
            embeds: [
                {
                    title: "**`❅ Shenhe Mains Rules`**",
                    color: 14281209,
                    author: {},
                    image: {
                        url: "https://media.discordapp.net/attachments/840864247373103114/912408260433301564/SHENHE_BANNER.png",
                    },
                    thumbnail: {},
                    footer: {},
                    fields: [],
                },
                {
                    title: "**`❅ Rules :`**",
                    color: 14281209,
                    description:
                        "In addition to the existing rules in <#805458033252892789> (except rule 9), the following rules apply:\n\n1. **__Content Rules__**\n\nNo content or discussions sexualizing minors, extreme fetishes (gore, vore, scat, etc.), or non-consensual content (including suggested non-consent) are permitted at all. NSFW content should still exist within a safe environment and we will not allow content that promotes unethical and illegal actions to exist.\n\nAny content of children or that depicts characters in a child-like manner will be deleted and punished at the discretion of moderators.\n\n2. **__Terms of Service__**\n\nContent must abide by Discord's Terms of Service as well and this will be strictly enforced.\n\n3. **__Age Restrictions__**\n\nYou may only access these channels if you are at least 18 years old. If you are discovered to be under 18 and accessing NSFW channels you may be permanently banned from the server.",
                    author: {},
                    image: {},
                    thumbnail: {},
                    footer: {},
                    fields: [],
                },
                {
                    title: "**`❅ Directory :`**",
                    color: 14281209,
                    description:
                        "#✧・nsfw-shenhe\nFor NSFW art focused on or containing Shenhe herself.\n\n#✧・nsfw-genshin\nFor NSFW art relating to Genshin Impact characters only; no discussions or conversations.\n\n#✧・nsfw-other\nFor all NSFW art not related to Shenhe or Genshin Impact.\n\n#✧・nsfw-general\nGeneral discussions (art permitted) for NSFW content.",
                    timestamp: "",
                    author: {},
                    image: {},
                    thumbnail: {},
                    footer: {},
                    fields: [],
                },
                {
                    title: "**`❅ Access :`**",
                    color: 14281209,
                    description:
                        "Once you have read the rules, click below to agree to abide by the rules and gain access to the NSFW section.",
                    timestamp: "",
                    author: {},
                    image: {},
                    thumbnail: {},
                    footer: {},
                    fields: [],
                },
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5,
                            label: "Accept the rules",
                            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        },
                    ],
                },
            ],
        });
        process.exit(0);
    }
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
    "voiceStateUpdate",
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
        const text = message.content
            .substring(config.prefix.length)
            .replaceAll("\u200b", "")
            .trim();
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
