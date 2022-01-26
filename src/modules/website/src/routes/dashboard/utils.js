const { has_permission } = require("../../../../../core/privileges");
const { client } = require("../../../../../client");
const {
    get_modmail_threads,
    get_open_applications,
} = require("../../../../../db");
const { flash } = require("../../utils");
const { config } = require("../../../../../core/config");

exports.staffData = async function (req, res, next) {
    req.permissions = {};
    req.no_permissions = true;
    for (const key of ["modmail", "application"]) {
        const perm = (req.permissions[key] = has_permission(req.member, key));
        req.no_permissions &&= !perm;
    }

    if (req.permissions.modmail) {
        req.modmail = await get_modmail_threads();
    }

    if (req.permissions.application) {
        req.applications = {};
        const guild = await client.guilds.fetch(config.guild);
        for (var [team, entry] of await get_open_applications()) {
            try {
                const member = await guild.members.fetch(entry.user_id);
                const key = `${member.user.username}#${member.user.discriminator}`;
                req.applications[key] ||= {
                    id: member.id,
                    teams: [],
                };
                req.applications[key].teams.push(team);
            } catch {}
        }
    }

    next();
};

exports.assertPermission = (permission) =>
    function (req, res, next) {
        if (has_permission(req.member, permission)) {
            next();
        } else {
            flash(req, "You do not have access to that endpoint.", "ERROR");
            res.redirect(303, "/dashboard/");
        }
    };
