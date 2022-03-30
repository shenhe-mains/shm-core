delete require.cache[require.resolve("./src/data")];
delete require.cache[require.resolve("./src/utils")];
delete require.cache[require.resolve("./src/routes/dashboard/utils")];

const http = require("http");
const { createHttpTerminator } = require("http-terminator");
const { config } = require("../../core/config");

function require_reload(path) {
    delete require.cache[require.resolve(path)];
    return require(path);
}

const { app } = require_reload("./src/app");

require_reload("./src/routes/captcha");
require_reload("./src/routes/index");
require_reload("./src/routes/about");
require_reload("./src/routes/apply");
require_reload("./src/routes/nsfw");

require_reload("./src/routes/dashboard/index");
require_reload("./src/routes/dashboard/application");
require_reload("./src/routes/dashboard/modmail");

require_reload("./src/routes/oauth");

const httpServer = http.createServer(app);
const httpTerminator = createHttpTerminator({ server: httpServer });
httpServer.listen(config.port);

exports.shutdown = async function () {
    await httpTerminator.terminate();
};
