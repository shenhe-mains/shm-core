const http = require("http");
const data = require("../config.json");

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("Hello, World!");
    res.end();
}).listen(data.port);
