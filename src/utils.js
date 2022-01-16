const { CommandSyntaxError } = require("./errors.js");

function pluralize(x, a, b) {
    return x == 1 ? b || "" : a || "s";
}

class Context {
    constructor(message) {
        this.message = message;
        this.channel = message.channel;
        this.guild = message.guild;
    }

    async reply() {
        await this._reply(false, ...arguments);
    }

    async replyPing() {
        await this._reply(true, ...arguments);
    }

    async _reply(ping) {
        const last = arguments[arguments.length - 1];
        if (last instanceof Object) {
            last.allowedMentions ||= {};
            if (last.allowedMentions.repliedUser === undefined) {
                last.allowedMentions.repliedUser = false;
            }
        }
        await this.message.reply(...arguments.slice(1));
    }

    async delete() {
        await this.message.delete();
    }

    async edit() {
        await this.message.edit(...arguments);
    }
}

function checkCount(args, min, max) {
    if (max === undefined) max = min;
    if (args.length != min && min == max) {
        throw new CommandSyntaxError(
            `Expected ${min} argument${pluralize(min)} but got ${args.length}.`
        );
    } else if (args.length < min) {
        throw new CommandSyntaxError(
            `Expected at least ${min} argument${pluralize(min)} but got ${
                args.length
            }.`
        );
    } else if (args.length > max) {
        throw new CommandSyntaxError(
            `Expected at most ${max} argument${pluralize(max)} but got ${
                args.length
            }.`
        );
    }
}

exports.pluralize = pluralize;
exports.Context = Context;
exports.checkCount = checkCount;
