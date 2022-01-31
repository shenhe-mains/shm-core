const fs = require("fs");
const { UserError, PermissionError } = require("./errors");
const { checkCount } = require("./utils");
const { has_permission } = require("./core/privileges");
const path = require("path");

const command_registry = {
    load: load,
    unload: unload,
    reload: reload,
};
const listener_registry = {};
const log_exclude_registry = new Set(["load", "unload", "reload"]);
const shutdowns = {};
const modules = {};

exports.get_command = function (key) {
    if (command_registry.hasOwnProperty(key)) {
        return {
            execute: command_registry[key],
            log: !log_exclude_registry.has(key),
        };
    }
    return { execute: undefined };
};

exports.handle_event = function (key, ...event) {
    if (!listener_registry.hasOwnProperty(key)) return;
    for (var module in listener_registry[key]) {
        for (var listener of listener_registry[key][module]) {
            listener(...event);
        }
    }
};

async function load(ctx, args) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings."
        );
    }
    checkCount(args, 1);
    await _load(args[0]);
    return {
        title: "Loaded Module",
        description: `Successfully loaded the \`${args[0]}\` module.`,
    };
}

async function unload(ctx, args) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings."
        );
    }
    checkCount(args, 1);
    await _unload(args[0]);
    return {
        title: "Unloaded Module",
        description: `Successfully unloaded the \`${args[0]}\` module.`,
    };
}

async function reload(ctx, args) {
    if (!has_permission(ctx.author, "settings")) {
        throw new PermissionError(
            "You do not have permission to modify bot settings."
        );
    }
    checkCount(args, 1);
    await _unload(args[0]);
    await _load(args[0]);
    return {
        title: "Reloaded Module",
        description: `Successfully reloaded the \`${args[0]}\` module.`,
    };
}

async function _load(module) {
    if (modules.hasOwnProperty(module)) {
        throw new UserError(`The \`${module}\` module is already loaded.`);
    }

    const {
        commands,
        log_exclude,
        listeners,
        shutdown,
    } = require(`./modules/${module}/main.js`);

    if (commands) {
        for (const key in commands) {
            if (command_registry.hasOwnProperty(key)) {
                throw `Duplicate key \`${key}\`.`;
            }

            command_registry[key] = commands[key];
        }
    }

    if (log_exclude) {
        for (const key of log_exclude) {
            log_exclude_registry.add(key);
        }
    }

    if (listeners) {
        for (var key in listeners) {
            listener_registry[key] ||= {};
            listener_registry[key][module] = listeners[key];
        }
    }

    if (shutdown) {
        shutdowns[module] = shutdown;
    }

    modules[module] = commands;
}

async function _unload(module) {
    if (!modules.hasOwnProperty(module)) {
        throw new UserError(`The \`${module}\` module is not loaded.`);
    }

    for (var key in modules[module]) {
        if (command_registry.hasOwnProperty(key)) {
            delete command_registry[key];
        }
        if (log_exclude_registry.has(key)) {
            log_exclude_registry.delete(key);
        }
    }

    for (var key in listener_registry) {
        if (listener_registry[key].hasOwnProperty(module)) {
            delete listener_registry[key][module];
        }
    }

    if (shutdowns.hasOwnProperty(module)) {
        await shutdowns[module]();
        delete shutdowns[module];
    }

    delete require.cache[require.resolve(`./modules/${module}/main.js`)];
    delete modules[module];
}

if (process.argv.indexOf("no-start") == -1) {
    fs.readdir(path.join(__dirname, "modules"), function (error, items) {
        items.forEach(_load);
    });
}
