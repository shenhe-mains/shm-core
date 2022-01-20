const { ButtonInteraction } = require("discord.js");

const items = {};

exports.pagify = async function (ctx, embed, fields, page_size) {
    const page = fields.length > page_size;
    const pages = Math.ceil(fields.length / page_size);
    embed.fields = fields.slice(0, page_size);
    embed.footer = { text: `Page 1 / ${pages}` };
    const message = await ctx.reply({
        embeds: [embed],
        components: page
            ? [
                  {
                      type: "ACTION_ROW",
                      components: [
                          ["⏪", "pagify.page_leftmost"],
                          ["◀️", "pagify.page_left"],
                          ["▶️", "pagify.page_right"],
                          ["⏩", "pagify.page_rightmost"],
                      ].map(([emoji, id]) => ({
                          type: "BUTTON",
                          style: "PRIMARY",
                          customId: id,
                          emoji: emoji,
                      })),
                  },
              ]
            : [],
        allowedMentions: { repliedUser: false },
    });
    if (page) {
        items[message.id] = {
            page: 0,
            pages: pages,
            size: page_size,
            fields: fields,
        };
    }
};

exports.pageInteraction = async function (interaction) {
    if (!interaction instanceof ButtonInteraction) return;
    if (items.hasOwnProperty(interaction.message.id)) {
        const item = items[interaction.message.id];
        const old = item.page;
        switch (interaction.customId) {
            case "pagify.page_leftmost":
                item.page = 0;
                break;
            case "pagify.page_left":
                --item.page;
                if (item.page < 0) item.page += item.pages;
                break;
            case "pagify.page_right":
                ++item.page;
                if (item.page >= item.pages) item.page -= item.pages;
                break;
            case "pagify.page_rightmost":
                item.page = item.pages - 1;
                break;
        }
        const embed = interaction.message.embeds[0];
        embed.fields = item.fields.slice(
            item.page * item.size,
            (item.page + 1) * item.size
        );
        embed.footer = { text: `Page ${item.page + 1} / ${item.pages}` };
        await interaction.update({ embeds: [embed] });
    } else if (interaction.customId.startsWith("pagify.")) {
        await interaction.reply({
            content:
                "This paged embed is no longer in my cache so I cannot fetch the other pages anymore.",
            ephemeral: true,
        });
    }
};
