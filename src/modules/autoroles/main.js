const { config } = require("../../core/config");
const { set_autoroles, get_autoroles } = require("../../db");

exports.listeners = {
    guildMemberAdd: [restore_roles],
    guildMemberRemove: [save_roles],
};

async function restore_roles(client, member) {
    const roles = [];
    const anchor = await member.guild.roles.fetch(config.autorole_exclude);
    for (const role_id of await get_autoroles(member.id)) {
        try {
            const role = await member.guild.roles.fetch(role_id);
            if (role.comparePositionTo(anchor) < 0) {
                roles.push(role);
            }
        } catch {}
    }
    await member.roles.add(roles, "restoring roles to returning user");
}

async function save_roles(client, member) {
    await set_autoroles(
        member.id,
        member.roles.cache.map((role) => role.id)
    );
}
