const { client } = require("../../../../../client");
const { config } = require("../../../../../core/config");
const {
    get_application,
    get_applications,
    get_application_by_id,
    resolve_application,
} = require("../../../../../db");
const { app } = require("../../app");
const { team_info, fields } = require("../../data");
const { flash, discordAuth, verifyMember, render } = require("../../utils");
const { fields_for } = require("../apply");
const { staffData, assertPermission } = require("./utils");

app.param("team", async function (req, res, next, id) {
    if (!team_info.hasOwnProperty(id)) {
        flash(req, `${id} is not a valid team ID.`, "ERROR");
        res.redirect(303, "/dashboard/");
    } else {
        req.team = id;
        next();
    }
});

app.param("user_id", function (req, res, next, id) {
    if (!id.match(/^\d+$/)) {
        flash(req, `${id} is not a valid user ID.`, "ERROR");
        res.redirect(303, "/dashboard/");
    } else {
        req.applicant_id = id;
        next();
    }
});

app.param("status", function (req, res, next, id) {
    if (id == "accept") {
        req.accept = true;
        next();
    } else if (id == "reject") {
        req.accept = false;
        next();
    } else {
        flash(
            req,
            "application resolve status must be accept or reject",
            "ERROR"
        );
        res.redirect(303, "/dashboard/");
    }
});

async function loadApplicationData(req, res, next) {
    var id;
    if (req.applicant_id.length < 10) {
        req.application = await get_application_by_id(
            req.team,
            parseInt(req.applicant_id)
        );
        id = req.applicant_id = req.application.user_id;
    } else {
        id = req.applicant_id;
        req.application = await get_application(req.team, id);
    }
    if (!req.application) {
        flash(
            req,
            "That user does not have a pending application to that team, or that application ID does not exist.",
            "ERROR"
        );
        res.redirect(303, "/dashboard/");
    } else {
        req.timezone = "GMT";
        const tz = req.application.timezone;
        if (tz > 0) {
            req.timezone += " +";
        } else if (tz < 0) {
            req.timezone += " -";
        }
        if (tz != 0) {
            var minutes = Math.abs(tz);
            const hours = Math.floor(minutes / 60);
            minutes %= 60;
            req.timezone +=
                (hours < 10 ? "0" : "") +
                hours +
                ":" +
                (minutes < 10 ? "0" : "") +
                minutes;
        }
        try {
            req.applicant = await (
                await client.guilds.fetch(config.guild)
            ).members.fetch(id);
        } catch {}
        next();
    }
}

async function loadAllApplicationData(req, res, next) {
    const id = req.applicant_id;
    req.applications = (await get_applications(id)).map(([team, entry]) => ({
        team: team,
        entry: entry,
    }));
    try {
        req.applicant_member = await (
            await client.guilds.fetch(config.guild)
        ).members.fetch(id);
    } catch {
        try {
            req.applicant_user = await client.users.fetch(id);
        } catch {}
    }
    next();
}

app.get(
    "/dashboard/applications/:team/:user_id",
    discordAuth("dashboard"),
    verifyMember,
    staffData,
    assertPermission("application"),
    loadApplicationData,
    function (req, res) {
        res.send(
            render(req, "dashboard/application.pug", {
                title: "SHM Staff Application Dashboard",
                team: req.team,
                application: req.application,
                timezone: req.timezone,
                applicant: req.applicant,
                info: team_info[req.team],
                fields: fields_for(req.team),
                field_data: fields,
            })
        );
    }
);

app.get(
    "/dashboard/all-applications/:user_id",
    discordAuth("dashboard"),
    verifyMember,
    staffData,
    assertPermission("application"),
    loadAllApplicationData,
    function (req, res) {
        res.send(
            render(req, "dashboard/all-applications.pug", {
                title: "SHM Staff Application Dashboard",
                applications: req.applications,
                applicant_member: req.applicant_member,
                applicant_user: req.applicant_user,
                applicant_id: req.applicant_id,
                info: team_info,
            })
        );
    }
);

app.get(
    "/dashboard/resolve-application/:team/:user_id/:status",
    discordAuth("dashboard"),
    verifyMember,
    staffData,
    assertPermission("application"),
    loadApplicationData,
    async function (req, res) {
        await resolve_application(req.team, req.applicant_id, req.accept);
        flash(
            req,
            `Application ${
                req.accept ? "accepted" : "rejected"
            }. Remember to DM the user and update their roles if needed.`,
            "SUCCESS"
        );
        try {
            await (
                await client.channels.fetch(
                    config.staff_teams[req.team].channel
                )
            ).send({
                embeds: [
                    {
                        title: `Application ${
                            req.accept ? "accepted" : "rejected"
                        }`,
                        description: `<@${
                            req.applicant_id
                        }>'s application to the ${
                            team_info[req.team].title
                        } was ${req.accept ? "accepted" : "rejected"} by ${
                            req.member
                        }.`,
                        color: req.accept ? "GREEN" : "RED",
                    },
                ],
            });
        } finally {
            res.redirect(303, "/dashboard/");
        }
    }
);
