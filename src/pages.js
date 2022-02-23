const { ButtonInteraction } = require("discord.js");

const items = {};

exports.pagify = async function (ctx, embed, fields, page_size, mini) {
    const page = fields.length > page_size;
    const pages = Math.ceil(fields.length / page_size);
    if (mini) {
        embed.description = fields.slice(0, page_size).join("\n");
    } else {
        embed.fields = fields.slice(0, page_size);
    }
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
            mini: mini ? true : false,
        };
        setTimeout(() => {
            delete items[message.id];
        }, 600000);
    }
};

exports.pageInteraction = async function (client, interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    if (items.hasOwnProperty(interaction.message.id)) {
        const item = items[interaction.message.id];
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
        const fields = item.fields.slice(
            item.page * item.size,
            (item.page + 1) * item.size
        );
        if (item.mini) {
            embed.description = fields.join("\n");
        } else {
            embed.fields = fields;
        }
        embed.footer = { text: `Page ${item.page + 1} / ${item.pages}` };
        await interaction.update({ embeds: [embed] });
    }
};
