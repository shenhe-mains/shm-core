class CommandSyntaxError extends Error {
    constructor(message) {
        super(message);
        this.name = "CommandSyntaxError";
    }
}

class ArgumentError extends Error {
    constructor(message) {
        super(message);
        this.name = "ArgumentError";
    }
}

class UserError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserError";
    }
}

class Success extends Error {
    constructor(title, message) {
        super(message);
        this.title = title;
        this.name = "Success";
    }
}

exports.CommandSyntaxError = CommandSyntaxError;
exports.ArgumentError = ArgumentError;
exports.UserError = UserError;
exports.Success = Success;
