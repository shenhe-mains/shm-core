const { default: fetch } = require("node-fetch");
const path = require("path");
const pug = require("pug");
const data = require("../../../../data");
const { config } = require("../../../core/config");
const { client } = require("../../../client");

const version = "?v=" + Math.floor(Math.random() * 1000000).toString();

exports.createError = function (status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
};

exports.flash = function (req, message, category) {
    req.session.flashes ||= [];
    req.session.flashes.push({
        category: category,
        message: message,
    });
};

exports.template = template = function (file) {
    return path.join(__dirname, "../templates", file);
};

exports.render = function (req, file, options) {
    options ||= {};
    options.flashes = req.session.flashes || [];
    req.session.flashes = undefined;
    options.navpages = [
        { url: "/", name: "home" },
        { url: "/about/", name: "about" },
        { url: "/apply/", name: "apply" },
    ];
    options.version = version;
    options.req = req;
    return pug.renderFile(template(file), options);
};

exports.discordAuth = (redirect) =>
    function (req, res, next) {
        if (process.argv.indexOf("test-login") != -1) {
            req.discord_id = "251082987360223233";
            next();
        } else {
            if (req.session.discord_token === undefined) {
                res.redirect(
                    303,
                    `https://discord.com/api/v8/oauth2/authorize?response_type=code&client_id=${
                        data.client_id
                    }&scope=identify&redirect_uri=${encodeURIComponent(
                        config.website.domain + "/discord-oauth/" + redirect
                    )}`
                );
            } else {
                fetch("https://discord.com/api/v8/oauth2/@me", {
                    headers: {
                        Authorization: "Bearer " + req.session.discord_token,
                    },
                })
                    .then((response) => response.json())
                    .then((json) => {
                        req.discord_id = json.user.id;
                        next();
                    });
            }
        }
    };

exports.verifyMember = function (req, res, next) {
    client.guilds
        .fetch(config.guild)
        .then((guild) => guild.members.fetch(req.discord_id))
        .then((member) => {
            req.member = member;
            next();
        })
        .catch((error) => {
            res.redirect("/?nomember=1");
        });
};
