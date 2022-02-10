const {
    Guild,
    GuildMember,
    User,
    Role,
    TextChannel,
    VoiceChannel,
    CategoryChannel,
    NewsChannel,
    StageChannel,
    ThreadChannel,
} = require("discord.js");
const { get_custom_role } = require("../../db");
const {
    Info,
    PermissionError,
    UserError,
    ArgumentError,
} = require("../../errors");
const {
    checkCount,
    censor_attachments,
    pluralize,
    display_duration,
} = require("../../utils");
const { ranks, has_permission } = require("../../core/privileges");
const { reload, modify, config } = require("../../core/config");
const { pagify } = require("../../pages");

exports.commands = {
    ranks: _ranks,
    "reload-config": reload_config,
    clone: clone,
    webhook: webhook,
    point: point,
    find: find(),
    "find-user": find("user"),
    "find-role": find("role"),
    "find-channel": find("channel"),
    info: async (ctx, args) => info(ctx, args, ctx.guild),
    "user-info": async (ctx, args) => info(ctx, args, ctx.author),
    "role-info": async (ctx, args) => info(ctx, args, ctx.author.roles.highest),
    "channel-info": async (ctx, args) => info(ctx, args, ctx.channel),
    avatar: avatar,
};

exports.log_exclude = [
    "find",
    "find-user",
    "find-role",
    "find-channel",
    "info",
    "user-info",
    "role-info",
    "channel-info",
    "avatar",
];

async function _ranks(ctx, args) {
    checkCount(args, 0, 1);
    var member;
    if (args.length == 0) {
        member = ctx.author;
    } else {
        member = await ctx.parse_member(args[0]);
    }

    throw new Info(
        `${member.user.tag}'s ranks:`,
        ranks(member).join(", ") || "(none)"
    );
}

async function reload_config(ctx, args) {
    checkCount(args, 0);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to edit or reload bot settings."
        );
    }
    reload();
}

async function clone(ctx, args) {
    checkCount(args, 2);
    if (!has_permission(ctx.author, "send")) {
        throw new PermissionError(
            "You do not have permission to command the bot to send messages."
        );
    }
    const channel = await ctx.parse_channel(args[0]);
    const message = await ctx.parse_message(args[1]);
    const response = {
        embeds: message.embeds,
        components: message.components,
        files: censor_attachments(message, true),
    };
    if (message.content) response.content = message.content;
    await channel.send(response);
}

async function webhook(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "webhook")) {
        throw new PermissionError(
            "You do not have permission to alter or get the webhook."
        );
    }
    modify({
        webhook: args[0],
    });
}

async function point(ctx, args) {
    checkCount(args, 1);
    if (!has_permission(ctx.author, "webhook")) {
        throw new PermissionError(
            "You do not have permission to alter or get the webhook."
        );
    }
    const channel = await ctx.parse_channel(args[0]);
    const webhooks = await ctx.guild.fetchWebhooks();
    const webhook = webhooks.get(config.webhook);
    if (webhook === undefined) {
        throw new UserError(
            `This server's webhook is not set or the configured webhook no longer exists. ` +
                `Please set it using \`${config.prefix}webhook <id>\` (note: copy the ID and not the URL, as exposing the URL is a security issue).`
        );
    }
    await webhook.edit({
        channel: channel,
    });
    try {
        await ctx.author.send(webhook.url);
    } catch {}
}

function find(type) {
    return async (ctx, args, body) => {
        body = body.toLowerCase();
        if (body.length < 3) {
            throw new ArgumentError(
                "Please enter a search query of at least 3 characters to find."
            );
        }
        const items = [];
        if (type === undefined || type == "user") {
            for (const member of ctx.guild.members.cache.values()) {
                if (
                    member.displayName.toLowerCase().match(body) ||
                    member.user.username.toLowerCase().match(body)
                ) {
                    items.push(
                        `\`user ${member.id}\`: ${member} (${inline_code(
                            `${member.user.tag}`
                        )})`
                    );
                }
            }
        }
        if (type === undefined || type == "role") {
            for (const role of ctx.guild.roles.cache.values()) {
                if (role.name.toLowerCase().match(body)) {
                    items.push(`\`role ${role.id}\`: ${role}`);
                }
            }
        }
        if (type === undefined || type == "channel") {
            for (const channel of ctx.guild.channels.cache.values()) {
                if (channel.name.toLowerCase().match(body)) {
                    items.push(`\`chnl ${channel.id}\`: ${channel}`);
                }
            }
        }
        if (items.length == 0) {
            throw new Info(
                "No matches found",
                "Nothing was found for that query."
            );
        }
        await pagify(
            ctx,
            {
                title: "Matches",
                color: "GREY",
            },
            items,
            10,
            true
        );
        throw new Info();
    };
}

function timestamp(ts, flag) {
    return `<t:${Math.floor(ts / 1000)}${flag ? `:${flag}` : ""}>`;
}

function timedisplay(ts) {
    return `${timestamp(ts)} (${timestamp(ts, "R")})`;
}

function channel_breakdown(channels) {
    var count = 0;
    var text = 0;
    var voice = 0;
    var category = 0;
    var news = 0;
    var stage = 0;
    var thread = 0;
    for (const channel of channels.values()) {
        ++count;
        if (channel instanceof TextChannel) ++text;
        if (channel instanceof VoiceChannel) ++voice;
        if (channel instanceof CategoryChannel) ++category;
        if (channel instanceof NewsChannel) ++news;
        if (channel instanceof StageChannel) ++stage;
        if (channel instanceof ThreadChannel) ++thread;
    }
    return `${count} (${[
        text ? `${text} text` : [],
        voice ? `${voice} voice` : [],
        category ? `${category} categor${pluralize(category, "ies", "y")}` : [],
        news ? `${news} news` : [],
        stage ? `${stage} stage` : [],
        thread ? `${thread} thread${pluralize(thread)}` : [],
    ]
        .flat()
        .join(", ")})`;
}

async function _info(ctx, item) {
    const creation = {
        name: "Creation Date",
        value: timedisplay(item.createdTimestamp || item.user.createdTimestamp),
    };
    const ID = {
        name: "ID",
        value: `\`${item.id}\` ${item}`,
    };
    const category = item.parent
        ? {
              name: "Category",
              value: item.parent.name,
          }
        : [];
    if (item instanceof Guild) {
        return {
            title: `Guild info for ${item.name}`,
            description: item.description,
            color: config.color,
            image: {
                url: item.bannerURL({ size: 4096 }),
            },
            footer: {
                iconURL: item.iconURL({ dynamic: true }),
                text: item.name,
            },
            fields: [
                ID,
                {
                    name: "Owner",
                    value: `<@${item.ownerId}>`,
                },
                creation,
                {
                    name: "Channels",
                    value: channel_breakdown(await item.channels.fetch()),
                },
                {
                    name: "Members",
                    value: item.memberCount.toString(),
                    inline: true,
                },
                {
                    name: "Default Notifications",
                    value: item.defaultMessageNotifications,
                    inline: true,
                },
                {
                    name: "Content Filter",
                    value: item.explicitContentFilter,
                    inline: true,
                },
                {
                    name: "NSFW Level",
                    value: item.nsfwLevel,
                    inline: true,
                },
                {
                    name: "2FA Level",
                    value: item.mfaLevel,
                    inline: true,
                },
                {
                    name: "Verification Level",
                    value: item.verificationLevel,
                    inline: true,
                },
                {
                    name: "Invites",
                    value: (await item.invites.fetch()).size.toString(),
                    inline: true,
                },
                {
                    name: "Maximum Bitrate",
                    value: item.maximumBitrate.toString(),
                    inline: true,
                },
                {
                    name: "Maximum Members",
                    value: item.maximumMembers.toString(),
                    inline: true,
                },
                {
                    name: "Bans",
                    value: (await item.bans.fetch()).size.toString(),
                    inline: true,
                },
                {
                    name: "Preferred Locale",
                    value: item.preferredLocale,
                    inline: true,
                },
                {
                    name: "Roles",
                    value: (await item.roles.fetch()).size.toString(),
                    inline: true,
                },
                {
                    name: "Boosters",
                    value: item.premiumSubscriptionCount.toString(),
                    inline: true,
                },
                {
                    name: "Events",
                    value: (await item.scheduledEvents.fetch()).size.toString(),
                    inline: true,
                },
                item.vanityURLCode
                    ? {
                          name: "Vanity Code",
                          value: ((data) =>
                              `https://discord.gg/${data.code} (used ${
                                  data.uses
                              } time${pluralize(data.uses)})`)(
                              await item.fetchVanityData()
                          ),
                      }
                    : [],
                item.systemChannel
                    ? {
                          name: "System Channel",
                          value: item.systemChannel.toString(),
                          inline: true,
                      }
                    : [],
                item.publicUpdatesChannel
                    ? {
                          name: "Public Updates",
                          value: item.publicUpdatesChannel.toString(),
                          inline: true,
                      }
                    : [],
                item.rulesChannel
                    ? {
                          name: "Rules Channel",
                          value: item.rulesChannel.toString(),
                          inline: true,
                      }
                    : [],
                item.afkChannel
                    ? [
                          {
                              name: "AFK Channel",
                              value: item.afkChannel.toString(),
                              inline: true,
                          },
                          {
                              name: "AFK Timeout",
                              value:
                                  item.afkTimeout === undefined
                                      ? "N/A"
                                      : `${item.afkTimeout}s`,
                              inline: true,
                          },
                      ]
                    : [],
            ].flat(),
        };
    } else if (item instanceof GuildMember) {
        const custom = await get_custom_role(item.id);
        return {
            title: `Member info for ${item.user.tag}`,
            description: item.user.bot ? "**This user is a bot**" : "",
            color: item.displayColor,
            thumbnail: {
                url:
                    item.avatarURL({ dynamic: true }) ||
                    item.user.avatarURL({ dynamic: true }),
            },
            fields: [
                ID,
                creation,
                {
                    name: "Join Date",
                    value: timedisplay(item.joinedTimestamp),
                },
                {
                    name: "Display Name",
                    value: item.displayName,
                },
                {
                    name: "Display Color",
                    value: `\`${item.displayHexColor}\``,
                },
                item.communicationDisabledUntilTimestamp &&
                has_permission(ctx.author, "history")
                    ? {
                          name: "Timed Out Until",
                          value: timedisplay(
                              item.communicationDisabledUntilTimestamp
                          ),
                      }
                    : [],
                item.premiumSinceTimestamp
                    ? {
                          name: "Boosting Since",
                          value: timedisplay(item.premiumSinceTimestamp),
                      }
                    : [],
                custom
                    ? {
                          name: "Custom Role",
                          value: `<@&${custom}>`,
                      }
                    : [],
                {
                    name: "Roles",
                    value:
                        item.roles.cache
                            .toJSON()
                            .sort((a, b) => b.comparePositionTo(a))
                            .slice(0, -1)
                            .map((x) => x.toString())
                            .join(", ") || "(none)",
                },
                {
                    name: "Permissions",
                    value:
                        item.permissions
                            .toArray()
                            .map((x) => `\`${x}\``)
                            .join(", ") || "(none)",
                },
                {
                    name: "User Flags",
                    value: item.user.flags.toArray().join(", ") || "(none)",
                },
            ].flat(),
        };
    } else if (item instanceof User) {
        item = await item.fetch();
        return {
            title: `User info for ${item.tag}`,
            description: item.bot ? "**This user is a bot**" : "",
            color: item.accentColor,
            thumbnail: {
                url: item.avatarURL({ dynamic: true }),
            },
            fields: [
                ID,
                creation,
                has_permission(ctx.author, "history")
                    ? {
                          name: "Ban Status",
                          value: await (async () => {
                              try {
                                  await ctx.guild.bans.fetch(item.id);
                                  return "This user is banned from this server.";
                              } catch {
                                  return "This user is not banned from this server.";
                              }
                          })(),
                      }
                    : [],
                {
                    name: "User Flags",
                    value: item.flags.toArray().join(", ") || "(none)",
                },
            ].flat(),
        };
    } else if (item instanceof Role) {
        return {
            title: `Role info for ${item.name}`,
            description: "",
            color: item.color,
            thumbnail: {
                url: item.iconURL(),
            },
            fields: [
                ID,
                creation,
                {
                    name: "Display Color",
                    value: item.hexColor,
                    inline: true,
                },
                {
                    name: "Members",
                    value: item.members.size.toString(),
                    inline: true,
                },
                {
                    name: "Position",
                    value: item.position.toString(),
                    inline: true,
                },
                {
                    name: "Hoist",
                    value: `Members with this role are ${
                        item.hoist ? "" : "not "
                    }displayed separately from other members.`,
                },
                {
                    name: "Mentionable",
                    value: `This role is ${
                        item.mentionable ? "" : "not "
                    }mentionable by everyone.`,
                },
                item.tags
                    ? [
                          item.tags.botId
                              ? {
                                    name: "Bot",
                                    value: `This role is managed by <@${item.tags.botId}>.`,
                                }
                              : [],
                          item.tags.integrationId
                              ? {
                                    name: "Integration",
                                    value: `This role is managed by integration \`${item.tags.integrationId}\`.`,
                                }
                              : [],
                          item.tags.premiumSubscriberRole
                              ? {
                                    name: "Booster Role",
                                    value: "This role is this server's premium subscriber role.",
                                }
                              : [],
                      ].flat()
                    : [],
                {
                    name: "Permissions",
                    value: item.permissions
                        .toArray()
                        .map((x) => `\`${x}\``)
                        .join(", "),
                },
            ].flat(),
        };
    } else if (item instanceof TextChannel || item instanceof NewsChannel) {
        return {
            title: `${
                item instanceof TextChannel ? "Text" : "News"
            } channel info for ${item.name}`,
            description: item.topic,
            color: "GREY",
            fields: [
                ID,
                creation,
                category,
                {
                    name: "Members",
                    value: item.members.size.toString(),
                },
                {
                    name: item.nsfw ? "NSFW" : "SFW",
                    value: item.nsfw
                        ? "This channel is NSFW. Only members aged 18+ are allowed. It is still subject to Discord's ToS."
                        : "This channel is SFW. All members are allowed. Refrain from posting explicit content.",
                },
                {
                    name: "Active Threads",
                    value: (
                        await item.threads.fetchActive()
                    ).threads.size.toString(),
                },
                {
                    name: "Thread Auto-Archive Duration",
                    value:
                        {
                            60: "1 hour",
                            1440: "1 day",
                            4320: "3 days",
                            10080: "7 days",
                            MAX: "maximum",
                        }[item.defaultAutoArchiveDuration] || "1 day",
                },
                item.rateLimitPerUser
                    ? {
                          name: "Slowmode",
                          value: display_duration(item.rateLimitPerUser),
                      }
                    : [],
            ].flat(),
        };
    } else if (item instanceof VoiceChannel || item instanceof StageChannel) {
        return {
            title: `${
                item instanceof VoiceChannel ? "Voice" : "Stage"
            } channel info for ${item.name}`,
            description: "",
            color: "GREY",
            fields: [
                ID,
                creation,
                category,
                {
                    name: "Bitrate",
                    value: item.bitrate.toString(),
                    inline: true,
                },
                {
                    name: "RTC Region",
                    value: item.rtcRegion || "auto",
                    inline: true,
                },
                {
                    name: "User Limit",
                    value: (item.userLimit || "none").toString(),
                    inline: true,
                },
            ],
        };
    } else if (item instanceof CategoryChannel) {
        return {
            title: `Category channel info for ${item.name}`,
            description: "",
            color: "GREY",
            fields: [
                ID,
                creation,
                {
                    name: "Channels",
                    value: channel_breakdown(item.children),
                },
            ],
        };
    } else if (item instanceof ThreadChannel) {
        return {
            title: `Thread channel info for ${item.name}`,
            description: "",
            color: "GREY",
            fields: [
                ID,
                creation,
                {
                    name: "Parent Channel",
                    value: item.parent.toString(),
                },
                item.archived
                    ? {
                          name: "Archived At",
                          value: timedisplay(item.archiveTimestamp),
                      }
                    : {
                          name: "Auto-Archive Duration",
                          value: display_duration(
                              item.autoArchiveDuration * 60
                          ),
                      },
                {
                    name: "Members",
                    value: (await item.members.fetch()).size.toString(),
                },
                item.rateLimitPerUser
                    ? {
                          name: "Slowmode",
                          value: display_duration(item.rateLimitPerUser),
                      }
                    : [],
            ],
        };
    }
}

async function show_info(ctx, item) {
    const res = await _info(ctx, item);
    if (res.fields) {
        res.fields = res.fields.map(
            (field) => ((field.name = `**※ ${field.name}**`), field)
        );
    }
    await ctx.replyEmbed(res);
    throw new Info();
}

async function parse(ctx, arg) {
    try {
        return ctx, await ctx.parse_member(arg);
    } catch {}
    try {
        return ctx, await ctx.parse_user(arg);
    } catch {}
    try {
        return ctx, await ctx.parse_role(arg);
    } catch {}
    try {
        return ctx, await ctx.parse_channel(arg);
    } catch {}
    throw new ArgumentError(
        `${inline_code(
            arg
        )} is not a valid representation of a member, role, or channel.`
    );
}

async function info(ctx, args, df) {
    checkCount(args, 0, 1);
    if (args.length == 0) {
        await show_info(ctx, df);
    } else {
        await show_info(ctx, await parse(ctx, args[0]));
    }
}

async function avatar(ctx, args) {
    checkCount(args, 0, 1);
    const member =
        args.length == 0 ? ctx.author : await ctx.parse_member(args[0]);
    const url =
        member.avatarURL({ dynamic: true }) ||
        member.user.avatarURL({ dynamic: true });
    await ctx.replyEmbed({
        description: url,
        image: { url: url },
    });
    throw new Info();
}
