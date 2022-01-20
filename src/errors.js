exports.StatusError = StatusError = class extends Error {
    constructor(message) {
        super(message);
        this.has_message = message !== undefined;
    }
};

exports.CommandSyntaxError = class extends StatusError {
    constructor(message) {
        super(message);
        this.name = "CommandSyntaxError";
    }
};

exports.ArgumentError = class extends StatusError {
    constructor(message) {
        super(message);
        this.name = "ArgumentError";
    }
};

exports.UserError = class extends StatusError {
    constructor(message) {
        super(message);
        this.name = "UserError";
    }
};

exports.PermissionError = class extends StatusError {
    constructor(message) {
        super(message);
        this.name = "PermissionError";
    }
};

exports.Info = class extends StatusError {
    constructor(title, message, modify) {
        super(message);
        this.title = title;
        this.modify = modify;
        this.name = "Info";
    }
};

exports.Canceled = class extends StatusError {
    constructor(message) {
        super(message);
        this.name = "Canceled";
    }
};

exports.PartialSuccess = class extends StatusError {
    constructor(title, message, modify) {
        super(message);
        this.title = title;
        this.modify = modify;
        this.name = "PartialSuccess";
    }
};

exports.Success = class extends StatusError {
    constructor(title, message, modify) {
        super(message);
        this.title = title;
        this.modify = modify;
        this.name = "Success";
    }
};
