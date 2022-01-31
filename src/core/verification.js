const { config } = require("./config");

exports.keys = keys = {};
exports.rmap = rmap = {};

exports.link_user = function (key, user) {
    keys[key] = user;
    rmap[user.id] = key;
};

exports.verify = async function (key) {
    const user = keys[key];
    if (user !== undefined) {
        await user.roles.add(config.verify, "user completed verification");
    }
};
