const { Info, PermissionError } = require("../../errors");
const { checkCount } = require("../../utils");
const { ranks, has_permission } = require("../../core/privileges");
const { reload } = require("../../core/config");

exports.commands = {
    ranks: _ranks,
    "reload-config": reload_config,
};

async function _ranks(ctx, args) {
    checkCount(args, 0, 1);
    var member;
    if (args.length == 0) {
        member = ctx.author;
    } else {
        member = await ctx.parse_member(args[0]);
    }

    throw new Info(
        `${member.user.username}#${member.user.discriminator}'s ranks:`,
        ranks(member).join(", ") || "(none)"
    );
}

async function reload_config(ctx, args) {
    checkCount(args, 0);
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to edit or reload bot settings."
        );
    }
    reload();
}
