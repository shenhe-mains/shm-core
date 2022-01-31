const { exec, spawn } = require("child_process");

exports.shell = function (command, args) {
    return new Promise((resolve, reject) => {
        const res = spawn(command, args);
        res.on("exit", (code, signal) => {
            if (code == 0) {
                resolve();
            } else {
                reject();
            }
        });
    });
};
