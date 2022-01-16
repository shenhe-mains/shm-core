const { UserError } = require("./errors.js");
const { checkCount } = require("./utils.js");
const config = require("../config.json");

var command_registry = {
    load: load,
    unload: unload,
    reload: reload,
};

var modules = {};

function get_command(key) {
    if (command_registry.hasOwnProperty(key)) {
        return command_registry[key];
    }
    return undefined;
}

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

    const { commands } = require(`./modules/${module}/main.js`);

    for (var key in commands) {
        if (command_registry.hasOwnProperty(key)) {
            throw `Duplicate key \`${key}\`.`;
        }

        command_registry[key] = commands[key];
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

    delete require.cache[require.resolve(`./modules/${module}/main.js`)];
    delete modules[module];
}

for (var module of config.startup) {
    _load(module);
}

exports.get_command = get_command;
