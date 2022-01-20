const { PermissionError } = require("../errors");
const { config } = require("./config");

exports.ranks = ranks = function (user) {
    var ranks = [];
    for (var rank in config.ranks) {
        if (
            config.ranks[rank].ids.indexOf(user.id) >= 0 ||
            user.roles.cache.some(
                (role) => config.ranks[rank].ids.indexOf(role.id) >= 0
            )
        ) {
            ranks.push(rank);
        }
    }
    return ranks.sort((a, b) => config.ranks[b].level - config.ranks[a].level);
};

exports.rank_level = rank_level = function (user) {
    const user_ranks = ranks(user);
    if (user_ranks.length == 0) return 0;
    return user_ranks
        .map((rank) => config.ranks[rank].level)
        .reduce((a, b) => Math.max(a, b));
};

exports.assert_hierarchy = function (mod, user) {
    const mrank = rank_level(mod);
    const urank = rank_level(user);
    if (mrank < urank) {
        throw new PermissionError(`${user} outranks you.`);
    } else if (mrank == urank) {
        throw new PermissionError(`You have the same rank as ${user}.`);
    }
};

exports.has_permission = function (user, permission) {
    return ranks(user).some(
        (rank) => config.permissions[permission].indexOf(rank) >= 0
    );
};
