const { config } = require("../../core/config");
const { UserError, PermissionError, Canceled } = require("../../errors");
const { pluralize } = require("../../utils");

exports.commands = {
    coop: coop,
    "co-op": coop,
};

exports.log_exclude = ["coop", "co-op"];

const cooldown = {};

const CD = 1800000;

function ratelimit(ctx) {
    const timediff = cooldown.hasOwnProperty(ctx.author.id)
        ? new Date() - cooldown[ctx.author.id]
        : Infinity;
    if (timediff < CD) {
        const rem = CD - timediff;
        const val = Math.floor(rem > 60000 ? rem / 60000 : rem / 1000);
        const unit = rem > 60000 ? "minute" : "second";
        throw new PermissionError(
            `You cannot use this command for another ${val} ${unit}${pluralize(
                val
            )}.`
        );
    }
}

async function coop(ctx, args, body) {
    ratelimit(ctx);
    const data = config.coop.regions[ctx.channel.id];
    if (!data) {
        throw new UserError(
            "This command can only be used in the co-op help channels."
        );
    }
    if (!ctx.author.roles.cache.has(data.role)) {
        throw new UserError(
            `You need to have the <@&${data.role}> command to use this command here. Perhaps you are in the wrong channel, or you can go over to <#901510802727636992> to pick up region roles.`
        );
    }
    var wl;
    for (var x = 7; x >= 0; --x) {
        if (ctx.author.roles.cache.has(config.coop.wl[x])) {
            wl = x + 1;
        }
    }
    if (wl === undefined) {
        const message = await ctx.reply({
            embeds: [
                {
                    title: "Please select your world level.",
                    description:
                        "Tip: if you set your world level role in <#901510802727636992>, you won't need to manually select your WL. [60s limit]",
                    color: config.color,
                },
            ],
            components: [0, 4].map((x) => ({
                type: "ACTION_ROW",
                components: [1, 2, 3, 4].map((y) => ({
                    type: "BUTTON",
                    style: "PRIMARY",
                    emoji: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"][
                        x + y - 1
                    ],
                    customId: `coop.confirmwl.${x + y}`,
                })),
            })),
            allowedMentions: { repliedUser: false },
        });
        try {
            wl = parseInt(
                (
                    await message.awaitMessageComponent({
                        filter: (interaction) =>
                            interaction.user.id == ctx.author.id &&
                            interaction.customId.startsWith("coop.confirmwl."),
                        time: 60000,
                    })
                ).customId.split(".")[2]
            );
            await message.delete();
        } catch {
            await message.delete();
            throw new Canceled("Command timed out.");
        }
    }
    await (
        await ctx.confirmOrCancel({
            title: "Confirm co-op ping?",
            description: `This will ping <@&${data.helper}> to help you ${
                body ? `with ${inline_code(body)} ` : ""
            }in a WL${wl} world.`,
            color: config.color,
        })
    ).message.delete();
    ratelimit(ctx);
    await ctx.send({
        content: `<@&${data.helper}>, ${ctx.author} is requesting assistance (WL${wl})`,
        embeds: body
            ? [
                  {
                      description: `${ctx.author} would like help with: ${body}`,
                      color: config.color,
                  },
              ]
            : [],
    });
    cooldown[ctx.author.id] = new Date();
}
