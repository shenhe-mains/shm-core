const { app } = require("../../app");
const { discordAuth, verifyMember, render } = require("../../utils");
const { team_info } = require("../../data");
const { staffData } = require("./utils");

app.get(
    "/dashboard/",
    discordAuth("dashboard"),
    verifyMember,
    staffData,
    async (req, res) => {
        res.send(
            render(req, "dashboard/index.pug", {
                title: "SHM Dashboard",
                applications: req.applications,
                permissions: req.permissions,
                team_info: team_info,
                modmail: req.modmail,
            })
        );
    }
);
