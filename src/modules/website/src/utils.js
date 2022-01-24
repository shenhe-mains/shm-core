const path = require("path");
const pug = require("pug");

const version = "?v=" + Math.floor(Math.random() * 1000000).toString();

exports.createError = function (status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
};

exports.template = template = function (file) {
    return path.join(__dirname, "../templates", file);
};

exports.render = function (req, file, options) {
    options ||= {};
    options.flashes = req.flashes || [];
    options.navpages = [
        { url: "/", name: "home" },
        { url: "/about/", name: "about" },
        { url: "/apply/", name: "apply" },
    ];
    options.version = version;
    return pug.renderFile(template(file), options);
};
