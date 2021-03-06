const { default: fetch } = require("node-fetch");
const path = require("path");
const pug = require("pug");
const data = require("../../../../data");
const { config } = require("../../../core/config");
const { client } = require("../../../client");
const {
    has_application_channel,
    get_application_channel,
    set_application_channel,
} = require("../../../db");
const { team_info } = require("./data");

const version = "?v=" + Math.floor(Math.random() * 1000000).toString();

exports.createError = function (status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
};

exports.flash = flash = function (req, message, category) {
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
                    })
                    .catch((error) => {
                        flash(
                            req,
                            "Unknown failure fetching your user account. Your access token may have expired; please login again.",
                            "ERROR"
                        );
                        res.redirect("/logout/");
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

async function get_app_channel(team, user, guild) {
    const name = `${team}-${user.username}-${user.discriminator}`;
    const topic = `${user}'s application for ${team_info[team].name}`;
    var channel;
    if (await has_application_channel(team, user.id)) {
        try {
            channel = await client.channels.fetch(
                await get_application_channel(team, user.id)
            );
        } catch {}
    }
    if (channel === undefined) {
        try {
            channel = await (
                await client.channels.fetch(
                    config.channels.application_category
                )
            ).createChannel(name, { topic: topic });
        } catch {
            channel = await guild.channels.create(name, {
                topic: topic,
            });
        }
        await set_application_channel(team, user.id, channel.id);
    }
    return channel;
}

exports.send_to_application_channel = async function (
    team,
    user,
    guild,
    message,
    pin
) {
    var channel;
    try {
        channel = await get_app_channel(team, user, guild);
        const msg = await channel.send(message);
        if (pin) await msg.pin();
    } catch {}
    try {
        await (
            await client.channels.fetch(config.channels.application_logs)
        ).send(message);
    } catch {}
};
