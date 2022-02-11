const { config } = require("../../../../core/config");
const { has_application, get_application, apply } = require("../../../../db");
const { app } = require("../app");
const { team_info, timezones, application_fields, fields } = require("../data");
const {
    render,
    discordAuth,
    verifyMember,
    flash,
    send_to_application_channel,
} = require("../utils");

async function status(member, team) {
    if (
        config.staff_teams[team].roles.some((id) => member.roles.cache.has(id))
    ) {
        return "in";
    } else if (!config.staff_teams[team].open) {
        return "closed";
    } else if (await has_application(team, member.id)) {
        return "applied";
    } else {
        return "open";
    }
}

app.param("team", async (req, res, next, team) => {
    if (!team_info.hasOwnProperty(team)) {
        flash(req, `There is no team by that ID! (${team})`, "ERROR");
        res.redirect(303, "/apply/");
    } else {
        req.team = team;
        next();
    }
});

team_status = (do_flash) =>
    async function (req, res, next) {
        switch (await status(req.member, req.team)) {
            case "in":
                if (do_flash) {
                    flash(
                        req,
                        "You are already in this team, but you can still view the application.",
                        "ERROR"
                    );
                }
                req.cannot_apply = true;
                break;
            case "closed":
                if (do_flash) {
                    flash(
                        req,
                        "This team is not open for applications right now, but you can still view the application.",
                        "ERROR"
                    );
                }
                req.cannot_apply = true;
                break;
            case "applied":
                req.application = await get_application(
                    req.team,
                    req.member.id
                );
                break;
        }
        next();
    };

app.get("/apply/", discordAuth("apply"), verifyMember, async (req, res) => {
    const statuses = {};
    for (const key in config.staff_teams) {
        statuses[key] = await status(req.member, key);
    }
    const team_keys = ["open", "applied", "closed", "in"]
        .map((stat) =>
            Object.keys(statuses).filter((team) => statuses[team] == stat)
        )
        .flat();
    res.send(
        render(req, "apply/apply.pug", {
            title: "Apply for Staff",
            statuses: statuses,
            team_info: team_info,
            team_keys: team_keys,
        })
    );
});

exports.fields_for = fields_for = function (team) {
    return [
        application_fields[team],
        "time_dedication",
        "motivation",
        "advocate",
    ].flat();
};

function appl_options(req, appl) {
    return {
        title: "Apply for Staff",
        timezones: timezones,
        appl: appl,
        team: req.team,
        info: team_info[req.team],
        fields: fields_for(req.team),
        field_data: fields,
    };
}

app.get(
    "/apply/:team",
    discordAuth("apply"),
    verifyMember,
    team_status(true),
    (req, res) => {
        res.send(
            render(req, "apply/form.pug", appl_options(req, req.application))
        );
    }
);

app.post(
    "/apply/:team",
    discordAuth("apply"),
    verifyMember,
    team_status(false),
    async (req, res) => {
        if (req.cannot_apply) return res.redirect(303, req.url);
        try {
            if (!req.body.timezone) throw "Please fill out your timezone!";
            const timezone = parseInt(req.body.timezone);
            if (isNaN(timezone)) {
                throw "Your timezone should be an integer; please select an option from the dropdown!";
            }
            if (timezone < -720 || timezone > 720) {
                throw "Your timezone is outside of the valid range; please select an option from the dropdown!";
            }
            const keys = ["timezone"];
            const values = [timezone];
            for (var field of fields_for(req.team)) {
                const data = fields[field];
                if (data.required && !req.body[field]) {
                    throw `You are missing a required field: ${field}`;
                }
                if (
                    data.type == "textarea" &&
                    data.maxlen &&
                    req.body[field].length > data.maxlen
                ) {
                    throw `One of your answers exceeds the maximum allowed length: ${field}`;
                }
                if (
                    data.type == "radio" &&
                    data.options
                        .map((option) => option[0])
                        .indexOf(req.body[field]) == -1
                ) {
                    throw `One of your answers is not a valid selection: ${field}`;
                }
                keys.push(field);
                values.push(req.body[field]);
            }
            await apply(req.team, req.member.id, keys, values);
            flash(
                req,
                `Your application has been ${
                    req.application ? "updated" : "submitted"
                }!`,
                "SUCCESS"
            );
            try {
                const url = `https://shenhemains.com/dashboard/applications/${req.team}/${req.member.id}`;
                await send_to_application_channel(
                    req.team,
                    req.member.user,
                    req.member.guild,
                    {
                        embeds: [
                            {
                                title: `${req.member.user.tag} ${
                                    req.application
                                        ? "updated their"
                                        : "submitted an"
                                } application for the ${
                                    team_info[req.team].title
                                }`,
                                description: `${req.member} just ${
                                    req.application
                                        ? "edited their application"
                                        : "applied"
                                }; check it out [here](${url}).`,
                                url: url,
                                color: config.color,
                            },
                        ],
                    },
                    !req.application
                );
            } finally {
                res.redirect(303, "/apply/");
            }
        } catch (error) {
            console.error(error);
            flash(req, error, "ERROR");
            res.send(
                render(req, "apply/form.pug", appl_options(req, req.body))
            );
        }
    }
);
