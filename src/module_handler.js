const { UserError } = require("./errors");
const { checkCount } = require("./utils");
const { config } = require("./core/config");

var command_registry = {
    load: load,
    unload: unload,
    reload: reload,
};

var listener_registry = {};

var modules = {};

exports.get_command = function (key) {
    if (command_registry.hasOwnProperty(key)) {
        return command_registry[key];
    }
    return undefined;
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
    checkCount(args, 1);
    _load(args[0]);
    return {
        title: "Loaded Module",
        description: `Successfully loaded the \`${args[0]}\` module.`,
    };
}

async function unload(ctx, args) {
    checkCount(args, 1);
    _unload(args[0]);
    return {
        title: "Unloaded Module",
        description: `Successfully unloaded the \`${args[0]}\` module.`,
    };
}

async function reload(ctx, args) {
    checkCount(args, 1);
    _unload(args[0]);
    _load(args[0]);
    return {
        title: "Reloaded Module",
        description: `Successfully reloaded the \`${args[0]}\` module.`,
    };
}

function _load(module) {
    if (modules.hasOwnProperty(module)) {
        throw new UserError(`The \`${module}\` module is already loaded.`);
    }

    const { commands, listeners } = require(`./modules/${module}/main.js`);

    if (commands) {
        for (var key in commands) {
            if (command_registry.hasOwnProperty(key)) {
                throw `Duplicate key \`${key}\`.`;
            }

            command_registry[key] = commands[key];
        }
    }

    if (listeners) {
        for (var key in listeners) {
            listener_registry[key] ||= {};
            listener_registry[key][module] = listeners[key];
        }
    }

    modules[module] = commands;
}

function _unload(module) {
    if (!modules.hasOwnProperty(module)) {
        throw new UserError(`The \`${module}\` module is not loaded.`);
    }

    for (var key in modules[module]) {
        if (command_registry.hasOwnProperty(key)) {
            delete command_registry[key];
        }
    }

    for (var key in listener_registry) {
        if (listener_registry[key].hasOwnProperty(module)) {
            delete listener_registry[key][module];
        }
    }

    delete require.cache[require.resolve(`./modules/${module}/main.js`)];
    delete modules[module];
}

for (var module of config.startup) {
    _load(module);
}
