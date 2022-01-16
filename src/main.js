const { Client, Intents, MessageEmbed } = require("discord.js");
const { split } = require("shlex");
const config = require("../config.json");

const { get_command } = require("./module_handler.js");
const db = require("./db.js");

const {
    CommandSyntaxError,
    ArgumentError,
    Success,
    UserError,
} = require("./errors.js");
const { Context } = require("./utils.js");
require("./server.js");

process.on("uncaughtException", (error) => {
    console.error(error);
});

const client = new Client({ intents: new Intents(32767) });

client.on("ready", async () => {
    await db.client.connect();
    console.log("SHENHE CORE is ready.");
});

client.on("messageCreate", async (message) => {
    const prefix = await db.get_prefix();
    if (message.content.startsWith(prefix)) {
        const command = message.content.substring(prefix.length).trim();
        if (command != "") {
            try {
                const key = command.split(/\s/, 1)[0];
                const fn = get_command(key);
                if (fn !== undefined) {
                    const args = command.substring(key.length + 1).trim();
                    var argument_list;
                    try {
                        argument_list = split(args);
                    } catch (error) {
                        throw new CommandSyntaxError(error.message);
                    }
                    if (argument_list !== undefined) {
                        const response = await fn(
                            new Context(message),
                            argument_list
                        );
                        if (response === undefined) throw new Success();
                        throw new Success(response.title, response.description);
                    }
                }
            } catch (error) {
                var color, title, description, reaction;
                if (error instanceof CommandSyntaxError) {
                    color = "RED";
                    title = "Command Syntax Error";
                    description = error.message;
                    reaction = "❌";
                } else if (error instanceof ArgumentError) {
                    color = "RED";
                    title = "Argument Error";
                    description = error.message;
                    reaction = "❌";
                } else if (error instanceof UserError) {
                    color = "RED";
                    title = "Error";
                    description = error.message;
                    reaction = "❌";
                } else if (error instanceof Success) {
                    color = "GREEN";
                    title = error.title;
                    description = error.message;
                    reaction = "✅";
                } else {
                    color = "PURPLE";
                    title = "InternalError";
                    description = `An internal error has occurred. I'm not sure what it is, but hopefully this helps.\n\`\`\`js\n${error.stack.substring(
                        0,
                        4000
                    )}\n\`\`\``;
                    console.error(error);
                    reaction = "❕";
                }
                if (title !== undefined && description !== undefined) {
                    await message.reply({
                        embeds: [
                            new MessageEmbed()
                                .setColor(color)
                                .setTitle(title)
                                .setDescription(description),
                        ],
                        allowedMentions: { repliedUser: false },
                    });
                }
                try {
                    await message.react(reaction);
                } catch {
                    // user probably blocked me
                }
            }
        }
    }
});

client.login(config.discord_token);
