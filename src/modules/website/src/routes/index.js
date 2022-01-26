const { config } = require("../../../../core/config");
const { app } = require("../app");
const { render, flash } = require("../utils");

app.get("/", (req, res) => {
    if (req.query.nomember) {
        flash(
            req,
            "I was not able to load your profile in discord.gg/shenhe!",
            "ERROR"
        );
    }
    res.send(
        render(req, "index/index.pug", {
            title: "Shenhe Mains",
            carousel: config.website.carousel,
            socials: [
                { link: "https://discord.gg/shenhe", name: "discord" },
                { link: "https://reddit.com/r/ShenheMains", name: "reddit" },
                { link: "https://twitch.tv/shenhemains", name: "twitch" },
                { link: "https://twitter.com/ShenheMains", name: "twitter" },
            ],
        })
    );
});
