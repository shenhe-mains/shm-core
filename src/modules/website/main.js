delete require.cache[require.resolve("./src/utils")];

const http = require("http");
const { createHttpTerminator } = require("http-terminator");
const { config } = require("../../core/config");

function require_reload(path) {
    delete require.cache[require.resolve(path)];
    return require(path);
}

const { app } = require_reload("./src/app");

require_reload("./src/routes/captcha");

const httpServer = http.createServer(app);
const httpTerminator = createHttpTerminator({ server: httpServer });
httpServer.listen(config.port);

exports.shutdown = async function () {
    await httpTerminator.terminate();
};
