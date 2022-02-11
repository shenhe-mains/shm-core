const { app } = require("../app");
const data = require("../../../../../data");
const { config } = require("../../../../core/config");
const { default: fetch } = require("node-fetch");
const { flash } = require("../utils");

app.param("destination", function (req, res, next, destination) {
    req.destination = destination;
    next();
});

app.get("/discord-oauth/:destination", function (req, res) {
    const code = req.query.code;
    fetch("https://discord.com/api/v8/oauth2/token", {
        method: "post",
        body: new URLSearchParams({
            client_id: data.client_id,
            client_secret: data.client_secret,
            grant_type: "authorization_code",
            code: code,
            redirect_uri:
                config.website.domain + "/discord-oauth/" + req.destination,
        }),
    })
        .then((response) => response.json())
        .then((json) => {
            if (json.access_token === undefined) {
                flash(
                    req,
                    "Something unexpected went wrong during the OAuth process. Please try again."
                );
                res.redirect("/");
            } else {
                req.session.discord_token = json.access_token;
                res.redirect("/" + req.destination + "/");
            }
        });
});

app.get("/logout/", function (req, res) {
    req.session.discord_token = undefined;
    res.redirect("/");
});
