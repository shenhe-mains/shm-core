const ytdl = require("ytdl-core");
const yts = require("yt-search");
const { Util, ButtonInteraction } = require("discord.js");
const {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    DiscordGatewayAdapterCreator,
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
    StreamType,
    VoiceConnection,
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus,
} = require("@discordjs/voice");
const { checkCount, pluralize } = require("../../utils");
const {
    ArgumentError,
    PermissionError,
    UserError,
    Success,
} = require("../../errors");
const { pagify } = require("../../pages");
const { config } = require("../../core/config");
const { client } = require("../../client");

exports.commands = {
    play: play,
    pause: pause,
    unpause: unpause,
    skip: skip(1, "skip", "Skipped the current song.", "Skipped"),
    backtrack: skip(
        -1,
        "backtrack",
        "Backtracked to the previous song",
        "Backtracked"
    ),
    "restart-player": restart_player,
    np: playing,
    nowplaying: playing,
    stop: stop,
    dc: disconnect,
    disconnect: disconnect,
    leave: disconnect,
    queue: queue,
    songhistory: history,
};

exports.listeners = {
    interactionCreate: [check_music_interactions],
};

const servers = {};
const search_results = {};

function stringify_duration(seconds) {
    var result = "";
    if (seconds > 3600) {
        result += Math.floor(seconds / 3600) + ":";
        seconds %= 3600;
    }
    result +=
        Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0") + ":";
    result += Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");
    return result;
}

function hyperlink(item) {
    return `[${Util.escapeMarkdown(item.title)}](${item.url})`;
}

function get_server(ctx) {
    const server = (servers[ctx.guild.id] ||= {});
    server.queue ||= [];
    if (server.index === undefined) server.index = 0;
    return server;
}

async function get_player(song) {
    const player = createAudioPlayer();
    const stream = ytdl(song.url, {
        filter: "audioonly",
        highWaterMark: 1 << 25,
    });
    const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
    });
    player.play(resource);
    return entersState(player, AudioPlayerStatus.Playing, 5000);
}

async function connect(ctx, no_create) {
    if (!ctx.author.voice.channel) {
        throw new PermissionError(
            "You must be in a voice channel to use that command."
        );
    }

    const server = get_server(ctx);

    if (server.connection) {
        if (client.user.voice.channel.id != ctx.author.voice.channel.id) {
            throw new PermissionError(
                "You must be in the same voice channel as me to use that command."
            );
        }
        return server.connection;
    }

    if (no_create) {
        throw new UserError(
            "I am not currently playing any music or in a voice call."
        );
    }

    try {
        server.channel = ctx.author.voice.channel;
        const connection = (server.connection = joinVoiceChannel({
            channelId: ctx.author.voice.channel.id,
            guildId: ctx.guild.id,
            adapterCreator: ctx.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
        }));
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
            connection.on("stateChange", async (_, new_state) => {
                if (new_state.status == VoiceConnectionStatus.Disconnected) {
                    if (
                        new_state.reason ==
                            VoiceConnectionDisconnectReason.WebSocketClose &&
                        new_state.closeCode == 4014
                    ) {
                        try {
                            await entersState(
                                connection,
                                VoiceConnectionStatus.Connecting,
                                5000
                            );
                        } catch {
                            connection.destroy();
                        }
                    }
                } else if (connection.rejoinAttempts < 5) {
                    setTimeout(
                        () => connection.rejoin(),
                        (connection.rejoinAttempts + 1) * 5000
                    );
                } else {
                    connection.destroy();
                }
            });
            return connection;
        } catch (error) {
            console.error(error);
            connection.destroy();
            throw new UserError(
                "Connection state was not ready within 30 seconds."
            );
        }
    } catch (error) {
        console.error(error);
        throw new UserError("I was unable to join your channel.");
    }
}

async function getSongs(query) {
    if (ytdl.validateURL(query)) {
        try {
            const result = (await ytdl.getInfo(query)).videoDetails;
            result.url = result.video_url;
            result.timestamp = stringify_duration(
                parseInt(result.lengthSeconds)
            );
            result.image = result.thumbnails[result.thumbnails.length - 1].url;
            result.author.url = result.author.channel_url;
            return [result];
        } catch {
            throw new ArgumentError("I could not get the video from that URL.");
        }
    } else {
        try {
            const results = (await yts.search(query)).videos;
            if (results.length == 0) throw 0;
            return results;
        } catch {
            throw new ArgumentError(
                "I could not find anything with that query."
            );
        }
    }
}

async function play(ctx, args, body) {
    checkCount(args, 1, Infinity);
    await connect(ctx);
    const results = await getSongs(body);
    if (results.length == 1) {
        await _queue(ctx, results[0]);
    } else {
        const message = await ctx.reply({
            embeds: [
                {
                    title: "Search Results",
                    description: results
                        .slice(0, 5)
                        .map((item, index) => `\`${index + 1}.\` ${item.title}`)
                        .join("\n"),
                },
            ],
            components: [
                {
                    type: "ACTION_ROW",
                    components: results.slice(0, 5).map((item, index) => ({
                        type: "BUTTON",
                        style: "PRIMARY",
                        customId: `music.select.${index}`,
                        emoji: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][index],
                    })),
                },
            ],
            allowedMentions: { repliedUser: false },
        });
        search_results[message.id] = {
            user_id: ctx.author.id,
            results: results.slice(0, 5),
            ctx: ctx,
        };
    }
}

async function pause(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    if (server.paused) {
        throw new UserError("I am already paused.");
    }
    server.paused = true;
    try {
        server.player.pause(true);
    } catch {}
}

async function unpause(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    if (!server.paused) {
        throw new UserError("I am not paused right now.");
    }
    server.paused = false;
    try {
        server.player.unpause();
    } catch {}
}

function skip(mult, verb, single, multi) {
    return async (ctx, args) => {
        checkCount(args, 0, 1);
        await connect(ctx, true);
        var count = args.length == 0 ? 1 : parseInt(args[0]);
        if (isNaN(count) || count <= 0) {
            throw new ArgumentError(
                `Please enter a positive (integer) number of songs to ${verb}.`
            );
        }
        const server = get_server(ctx);
        if (server.index < 0) {
            server.index = 0;
        }
        if (server.index > server.queue.length) {
            server.index = server.queue.length;
        }
        if (mult == -1) {
            if (server.index == 0) {
                throw new UserError("I am already at the start of the queue.");
            }
            count = Math.min(count, server.index);
        } else {
            if (server.index >= server.queue.length) {
                throw new UserError("I am already at the end of the queue.");
            }
            count = Math.min(count, server.queue.length - server.index);
        }
        server.index = Math.min(
            server.index + count * mult,
            server.queue.length
        );
        check_queue(ctx);
        return {
            title: `${multi}`,
            description: count == 1 ? single : `${multi} ${count} songs.`,
        };
    };
}

async function playing(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    if (server.queue.length == 0) {
        return {
            title: "Queue Empty",
            description: `The queue is currently empty. \`${config.prefix}play\` your favorite songs!`,
        };
    } else if (server.index > server.queue.length) {
        return {
            title: "End of queue",
            description: `I have reached the end of the queue. \`${config.prefix}restart-player\` to return to the start or \`${config.prefix}play\` a new song!`,
        };
    } else {
        const item = server.queue[server.index];
        const embed = embed_for(item);
        embed.title = server.paused ? "Paused" : "Now Playing";
        embed.description = hyperlink(item);
        await ctx.reply({
            embeds: [embed],
            allowedMentions: { repliedUser: false },
        });
    }
}

async function stop(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    server.index = server.queue.length;
    check_queue(ctx);
}

async function disconnect(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    try {
        server.connection.destroy();
    } finally {
        delete servers[ctx.guild.id];
    }
}

async function restart_player(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    server.index = 0;
    check_queue(ctx, true);
}

async function queue(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    if (server.index >= server.queue.length - 1) {
        return await ctx.replyEmbed({
            title: "Queue Empty",
            description: `The queue is empty. \`${config.prefix}play\` your favorite songs!`,
            color: config.color,
        });
    }
    await _show(ctx, "Queue", server.queue.slice(server.index + 1), 1);
}

async function history(ctx, args) {
    checkCount(args, 0);
    await connect(ctx);
    const server = get_server(ctx);
    if (server.index == 0) {
        return await ctx.replyEmbed({
            title: "History Empty",
            description: `This is the beginning of the queue.`,
            color: config.color,
        });
    }
    await _show(
        ctx,
        "History",
        server.queue.slice(0, server.index).reverse(),
        -1
    );
}

async function _show(ctx, title, items, mult) {
    await pagify(
        ctx,
        { title: title, color: config.color },
        items.map(
            (item, index) => `\`${(index + 1) * mult}.\` ${hyperlink(item)}`
        ),
        10,
        true
    );
}

function embed_for(item) {
    return {
        fields: [
            {
                name: "Creator",
                value: `[${Util.escapeMarkdown(item.author.name)}](${
                    item.author.url
                })`,
                inline: true,
            },
            {
                name: "Requested By",
                value: item.requester.toString(),
                inline: true,
            },
            {
                name: "Duration",
                value: item.timestamp,
                inline: true,
            },
        ],
        image: { url: item.image },
        color: "GREEN",
    };
}

async function _queue(ctx, item) {
    const server = get_server(ctx);
    item.requester = ctx.author;
    server.queue.push(item);

    const embed = embed_for(item);
    embed.title = "Song Queued";
    embed.description = `${hyperlink(item)} has been added to the queue!`;
    await ctx.reply({
        embeds: [embed],
        allowedMentions: { repliedUser: false },
    });

    check_queue(ctx);
}

async function check_queue(ctx, force) {
    const server = get_server(ctx);
    if (server.index >= server.queue.length) {
        if (server.channel.members.size == 0) {
            try {
                (await connect(ctx, true)).destroy();
            } catch {}
        } else {
            try {
                server.player.stop();
            } catch {}
        }
        return;
    }

    if (!force && server.playing == server.index) return;

    const song = server.queue[server.index];
    const connection = await connect(ctx);
    server.player = await get_player(song);
    connection.subscribe(server.player);
    server.playing = server.index;

    server.player.on(AudioPlayerStatus.Idle, () => {
        if (server.index <= server.queue.length) {
            ++server.index;
        }
        check_queue(ctx);
    });

    const embed = embed_for(song);
    embed.title = "Now Playing!";
    embed.description = hyperlink(song);

    await ctx.channel.send({
        embeds: [embed],
    });
}

async function check_music_interactions(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (interaction.customId.startsWith("music.select.")) {
        if (!search_results.hasOwnProperty(interaction.message.id)) return;
        const { user_id, results, ctx } =
            search_results[interaction.message.id];
        if (interaction.user.id != user_id) return;
        await interaction.message.delete();
        await _queue(
            ctx,
            results[parseInt(interaction.customId.split(".")[2])]
        );
    }
}
