const genius = require("genius-lyrics");
const ytdl = require("ytdl-core");
const yts = require("yt-search");
const ytpl = require("ytpl");
const { Util, ButtonInteraction } = require("discord.js");
const {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    StreamType,
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus,
} = require("@discordjs/voice");
const { checkCount, pluralize, shuffle } = require("../../utils");
const { ArgumentError, PermissionError, UserError } = require("../../errors");
const { pagify } = require("../../pages");
const { config } = require("../../core/config");
const { client } = require("../../client");
const data = require("../../../data.json");

const genius_client = new genius.Client(data.genius_token);

const bt = skip(
    -1,
    "backtrack",
    "Backtracked to the previous song",
    "Backtracked"
);

const forceplay = play(false);
const ppfalse = play_playlist(false);
const pptrue = play_playlist(true);

exports.commands = {
    p: forceplay,
    play: forceplay,
    pp: ppfalse,
    playlist: ppfalse,
    ppshuffle: pptrue,
    playlist: pptrue,
    search: play(true),
    pause: pause,
    unpause: unpause,
    skip: skip(1, "skip", "Skipped the current song.", "Skipped"),
    backtrack: bt,
    bt: bt,
    "restart-player": restart_player,
    np: playing,
    nowplaying: playing,
    stop: stop,
    dc: disconnect,
    disconnect: disconnect,
    leave: disconnect,
    q: queue,
    queue: queue,
    songhistory: history,
    repeat: loop("repeat"),
    loop: loop("loop"),
    radio: radio,
    "rm-song": remove,
    shuffle: do_shuffle,
    "shuffle-all": shuffle_all,
    volume: volume,
    lyrics: lyrics,
};

exports.log_exclude = [
    "p",
    "play",
    "pp",
    "playlist",
    "ppshuffle",
    "playlist-shuffle",
    "search",
    "pause",
    "unpause",
    "skip",
    "backtrack",
    "bt",
    "restart-player",
    "np",
    "nowplaying",
    "stop",
    "dc",
    "disconnect",
    "leave",
    "q",
    "queue",
    "songhistory",
    "repeat",
    "loop",
    "radio",
    "rm-song",
    "shuffle",
    "shuffle-all",
    "volume",
    "lyrics",
];

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

async function get_player(server, song) {
    const player = createAudioPlayer();
    const stream = ytdl(song.url, {
        filter: "audioonly",
        highWaterMark: 1 << 25,
    });
    const resource = (server.resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
    }));
    if (server.volume !== undefined) resource.volume.setVolume(server.volume);
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

    const my_channel = (await ctx.guild.members.fetch(client.user.id)).voice
        .channel;

    if (my_channel && server.connection) {
        if (my_channel.id != ctx.author.voice.channel.id) {
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

function ytdlToSimple(result) {
    result.url = result.video_url;
    result.timestamp = stringify_duration(parseInt(result.lengthSeconds));
    try {
        result.image = result.thumbnails[result.thumbnails.length - 1].url;
    } catch {}
    result.author.url = result.author.channel_url;
    return result;
}

async function getSongs(query) {
    if (ytdl.validateURL(query)) {
        try {
            return [ytdlToSimple((await ytdl.getInfo(query)).videoDetails)];
        } catch {
            throw new ArgumentError("I could not get the video from that URL.");
        }
    } else {
        try {
            const results = (await yts.search(query)).videos;
            if (results.length == 0) throw 0;
            return results;
        } catch {
            try {
                await ytpl(query);
            } catch {
                throw new ArgumentError(
                    "I could not find anything with that query."
                );
            }
            throw new ArgumentError(
                `I could not find anything with that query. If you meant to queue a playlist, please use \`${config.prefix}playlist\`.`
            );
        }
    }
}

function play(prompt) {
    return async (ctx, args, body, key, nosend) => {
        checkCount(args, 1, Infinity);
        await connect(ctx);
        const results = await getSongs(body);
        if (results.length == 1 || !prompt) {
            await _queue(ctx, results[0], nosend);
        } else {
            const message = await ctx.reply({
                embeds: [
                    {
                        title: "Search Results",
                        description: results
                            .slice(0, 5)
                            .map(
                                (item, index) =>
                                    `\`${index + 1}.\` ${hyperlink(item)}`
                            )
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
                    {
                        type: "ACTION_ROW",
                        components: [
                            {
                                type: "BUTTON",
                                style: "DANGER",
                                customId: "music.select.cancel",
                                emoji: "❌",
                            },
                        ],
                    },
                ],
                allowedMentions: { repliedUser: false },
            });
            search_results[message.id] = {
                user_id: ctx.author.id,
                results: results.slice(0, 5),
                ctx: ctx,
            };
            setTimeout(() => {
                delete search_results[message.id];
            }, 600000);
        }
    };
}

function play_playlist(do_shuffle) {
    return async (ctx, args, body) => {
        checkCount(args, 1, Infinity);
        await connect(ctx);
        var list;
        try {
            list = await ytpl(body);
        } catch {
            throw new ArgumentError(
                "Error fetching playlist; please make sure it exists and is not private."
            );
        }
        const message = await ctx.replyEmbed({
            title: "Queueing Playlist...",
            description:
                `Attempting to queue ${list.items.length} song${pluralize(
                    list.items.length
                )}.` +
                (list.estimatedItemCount > 100
                    ? " Your playlist had over 100 items, so only the first 100 will be attempted due to dependency restrictions."
                    : ""),
            color: "AQUA",
        });
        var success = 0;
        for (const item of do_shuffle ? shuffle(list.items) : list.items) {
            try {
                await forceplay(
                    ctx,
                    [item.shortUrl],
                    item.shortUrl,
                    null,
                    true
                );
                ++success;
            } catch {}
        }
        await message.edit({
            embeds: [
                {
                    title: "Playlist Queued",
                    description: `Queued ${success} song${pluralize(success)}.`,
                    color: "GREEN",
                },
            ],
        });
    };
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
        server.index += count * mult;
        check_queue(ctx, true);
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
    } else if (server.index >= server.queue.length) {
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
    server.repeat = server.loop = server.radio = false;
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
    if (server.index == 0 || server.queue.length == 0) {
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

function loop(key) {
    return async (ctx, args) => {
        checkCount(args, 0, 1);
        await connect(ctx, true);
        const server = get_server(ctx);
        server[key] ||= 0;
        server[key == "loop" ? "repeat" : "loop"] = 0;
        if (args.length > 0) {
            const count = parseInt(args[0]);
            if (isNaN(count) || count < 0) {
                throw new ArgumentError(
                    `${
                        key == "loop" ? "Loop" : "Repeat"
                    } counter must be non-negative.`
                );
            }
            server[key] = count;
        } else {
            server[key] = server[key] == 0 ? -1 : 0;
        }
        return {
            title: `${key == "loop" ? "Loop" : "Repeat"}: ${
                server[key] ? "On" : "Off"
            }`,
            description: server[key]
                ? (key == "loop"
                      ? "When I reach the end of the queue, I will return to the start instead of stopping."
                      : "When this song ends, it will play again instead of moving to the next song.") +
                  (server[key] > 0 ? ` (${server[key]}×)` : "")
                : "",
        };
    };
}

async function radio(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    server.radio = !server.radio;
    return {
        title: `Radio: ${server.radio ? "On" : "Off"}`,
        description: server.radio
            ? "Radio mode is now on. When I reach the end of the queue, I will randomly select a related song and keep going."
            : "Radio mode is now off.",
    };
}

async function remove(ctx, args) {
    checkCount(args, 0, 2);
    await connect(ctx, true);
    const server = get_server(ctx);
    const vals = args.map((arg) => parseInt(arg));
    const min = -server.index;
    const max = server.queue.length - server.index - 1;
    if (
        vals.some(
            (x) =>
                isNaN(x) ||
                x < -server.index ||
                x >= server.queue.length - server.index
        )
    ) {
        throw new ArgumentError(
            `Arguments must be integers between ${min} and ${max}.`
        );
    }
    if (args.length == 0 || vals[0] == 0) {
        const [removed] = server.queue.splice(server.index, 1);
        check_queue(ctx, true);
        return {
            title: "Song Removed",
            description: `The current song, ${hyperlink(
                removed
            )}, was just removed.`,
        };
    } else if (args.length == 1 || vals[0] == vals[1]) {
        const [removed] = server.queue.splice(server.index + vals[0], 1);
        if (vals[0] < 0) {
            --server.index;
            --server.playing;
        }
        return {
            title: "Song Removed",
            description: `${hyperlink(removed)} was just removed.`,
        };
    } else {
        if (vals[0] > vals[1]) [vals[0], vals[1]] = [vals[1], vals[0]];
        const left = server.index + vals[0];
        const right = server.index + vals[1];
        const amt = right - left + 1;
        server.queue.splice(left, amt);
        if (server.index > right) {
            server.index -= amt;
            server.playing -= amt;
        } else if (server.index >= left) {
            server.index = left;
            check_queue(ctx, true);
        }
        return {
            title: `Songs Removed`,
            description: `${amt} songs were just removed.`,
        };
    }
}

async function do_shuffle(ctx, args) {
    checkCount(args, 0, 1);
    await connect(ctx, true);
    const server = get_server(ctx);
    if (args.length > 0) {
        args[0] = parseInt(args[0]);
        if (isNaN(args[0]) || args[0] < 0) {
            throw new ArgumentError(
                "The number of songs to shuffle must be a positive integer."
            );
        }
    }
    if (server.index >= server.queue.length - 1) {
        throw new UserError("There are no songs left in the queue to shuffle.");
    }
    const count = Math.min(
        server.queue.length - server.index - 1,
        args.length > 0 ? args[0] : server.queue.length - server.index - 1
    );
    if (count >= 2) {
        server.queue.splice(
            server.index + 1,
            count,
            ...shuffle(
                server.queue.slice(server.index + 1, server.index + count + 1)
            )
        );
    }
    return {
        title: "Shuffled",
        description:
            count == 1
                ? "There was only one song included in the shuffle, so nothing has changed."
                : `${count} songs were just shuffled.`,
    };
}

async function shuffle_all(ctx, args) {
    checkCount(args, 0);
    await connect(ctx, true);
    const server = get_server(ctx);
    if (server.queue.length == 0) {
        throw new UserError("There are no songs to shuffle.");
    }
    const id = server.queue[server.index].videoId;
    shuffle(server.queue);
    if (server.queue[server.index].videoId != id) check_queue(ctx, true);
    return {
        title: "Shuffled",
        description:
            server.queue.length == 1
                ? "There was only one song, so nothing has changed."
                : "All songs, including the history and queue, have been shuffled.",
    };
}

async function volume(ctx, args) {
    checkCount(args, 1);
    await connect(ctx, true);
    const server = get_server(ctx);
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 100) {
        throw new ArgumentError("Volume must be an integer between 0 and 100.");
    }
    if (!server.resource) {
        throw new UserError("I am not playing anything right now.");
    }
    server.resource.volume.setVolume((server.volume = vol / 100));
}

async function lyrics(ctx, args, body) {
    var query;
    if (args.length > 0) {
        query = body;
    } else {
        await connect(ctx, true);
        const server = get_server(ctx);
        if (server.index < 0 || server.index >= server.queue.length) {
            throw new UserError("I am not playing anything right now.");
        }
        query = server.queue[server.index].title;
    }
    const results = await genius_client.songs.search(query);
    if (results.length == 0) {
        throw new UserError(
            "I could not find any lyrics. " +
                (args.length == 0
                    ? "If the title contains a lot of extra characters or words, you might be able to find one with a manual search."
                    : "Please make sure your search isn't too specific.")
        );
    }
    return {
        title: "Lyrics",
        description: (await results[0].lyrics()).substring(0, 4096),
    };
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

async function _queue(ctx, item, nosend, requester) {
    const server = get_server(ctx);
    item.requester = requester || ctx.author;
    server.queue.push(item);

    if (!nosend) {
        const embed = embed_for(item);
        embed.title = "Song Queued";
        embed.description = `${hyperlink(item)} has been added to the queue!`;
        await ctx.reply({
            embeds: [embed],
            allowedMentions: { repliedUser: false },
        });
    }

    check_queue(ctx);
}

async function end(ctx, server) {
    if (server.channel.members.size == 0) {
        try {
            (await connect(ctx, true)).destroy();
        } catch {}
    } else {
        try {
            server.player.stop();
        } catch {}
    }
}

async function check_queue(ctx, force) {
    const server = get_server(ctx);

    if (server.index >= server.queue.length) {
        if (server.radio) {
            const related = (
                await ytdl.getInfo(server.queue[server.queue.length - 1].url)
            ).related_videos;
            while (related.length > 0) {
                if (
                    !server.queue.some((item) => item.videoId == related[0].id)
                ) {
                    break;
                }
                related.shift();
            }
            if (related.length == 0) {
                await end(ctx, server);
                await ctx.send({
                    embeds: [
                        {
                            title: "Radio Mode - No Videos Found",
                            description: `There are no more songs in the queue and I could not find any related videos. \`${config.prefix}play\` your favorite songs to keep it going.`,
                            color: "AQUA",
                        },
                    ],
                });
            } else {
                try {
                    const id = related[0].id;
                    const item = ytdlToSimple(
                        (await ytdl.getInfo(id)).videoDetails
                    );
                    item.requester = client.user;
                    server.queue.push(item);
                    server.index = server.queue.length - 1;
                    force = true;
                } catch {
                    await ctx.send({
                        embeds: [
                            {
                                title: "Radio Mode Failed",
                                description:
                                    "An unexpected error occurred while trying to load a random related song.",
                                color: "RED",
                            },
                        ],
                    });
                }
            }
        } else if (server.loop) {
            server.index = 0;
            if (server.loop > 0) --server.loop;
        } else {
            await end(ctx, server);
            await ctx.send({
                embeds: [
                    {
                        title: "Queue Ended",
                        description: `There are no more songs in the queue. \`${config.prefix}play\` your favorite songs to keep it going.`,
                        color: "AQUA",
                    },
                ],
            });
            return;
        }
    }

    if (!force && server.playing == server.index) return;

    const song = server.queue[server.index];
    const connection = await connect(ctx);
    server.player = await get_player(server, song);
    connection.subscribe(server.player);
    server.playing = server.index;
    server.paused = false;

    server.player.on(AudioPlayerStatus.Idle, () => {
        if (server.repeat) {
            if (server.repeat > 0) --server.repeat;
            check_queue(ctx, true);
        } else {
            if (server.index <= server.queue.length) {
                ++server.index;
            }
            check_queue(ctx);
        }
    });

    const embed = embed_for(song);
    embed.title = "Now Playing!";
    embed.description = hyperlink(song);

    await ctx.send({
        embeds: [embed],
    });
}

async function check_music_interactions(client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (interaction.customId == "music.select.cancel") {
        await interaction.update({ components: [] });
    } else if (interaction.customId.startsWith("music.select.")) {
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
