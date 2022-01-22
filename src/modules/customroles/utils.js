const { config } = require("../../core/config");
const { get_custom_role, set_custom_role, client } = require("../../db");
const { PermissionError, UserError } = require("../../errors");

const cooldown = {};

function ratelimit(ctx) {
    if (
        cooldown.hasOwnProperty(ctx.author.id) &&
        +new Date() - cooldown[ctx.author.id] < 7500
    ) {
        throw new UserError(
            "Please wait a bit before using this command. Thanks!"
        );
    }
    cooldown[ctx.author.id] = +new Date();
}

exports.assert_supporter = function (ctx) {
    if (
        !ctx.author.roles.cache.some((role) =>
            config.support_roles.hasOwnProperty(role.id)
        )
    ) {
        throw new PermissionError(
            "Sorry, only server supporters can use custom roles!"
        );
    }
};

exports.get_role = get_role = async function (ctx) {
    var role_id = await get_custom_role(ctx.author.id);
    var role;
    if (role_id === undefined) {
        ratelimit(ctx);
        const anchor = await ctx.guild.roles.fetch(config.support_anchor);
        role = await ctx.guild.roles.create({
            position: anchor.position,
        });
        await ctx.author.roles.add(role);
        await set_custom_role(ctx.author.id, role.id);
        return role;
    } else {
        role = await ctx.guild.roles.fetch(role_id);
        if (role === null) {
            await client.query(`DELETE FROM custom_roles WHERE user_id = $1`, [
                ctx.author.id,
            ]);
            return await get_role(ctx);
        }
        return role;
    }
};

exports.remove_role = async function (member) {
    const role_id = await get_custom_role(member.id);
    await client.query(`DELETE FROM custom_roles WHERE user_id = $1`, [
        member.id,
    ]);
    if (role_id === undefined) return;
    try {
        const role = await member.guild.roles.fetch(role_id);
        await role.delete();
    } catch {
        return;
    }
};
