const { client } = require("../../../../../client");
const { get_modmail_messages } = require("../../../../../db");
const { app } = require("../../app");
const { flash, render, discordAuth, verifyMember } = require("../../utils");
const { staffData, assertPermission } = require("./utils");

app.param("modmail_user_id", async function (req, res, next, id) {
    if (!id.match(/^\d+$/)) {
        flash(req, `${id} is not a valid user ID.`, "ERROR");
        res.redirect(303, "/dashboard/");
    } else {
        req.messages = await get_modmail_messages(id);
        try {
            req.modmail_target = await client.users.fetch(id);
        } catch {}
        next();
    }
});

app.get(
    "/dashboard/modmail/:modmail_user_id",
    discordAuth("dashboard"),
    verifyMember,
    staffData,
    assertPermission("modmail"),
    function (req, res) {
        res.send(
            render(req, "dashboard/modmail.pug", {
                title: "SHM Modmail",
                messages: req.messages,
                modmail_target: req.modmail_target,
            })
        );
    }
);
