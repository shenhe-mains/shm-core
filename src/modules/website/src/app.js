const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("cookie-session");
const data = require("../../../../data");

exports.app = app = express();
app.use("/static", express.static(path.join(__dirname, "../static")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(
    session({
        name: "session",
        keys: data.session_keys,
    })
);
app.use(function (err, req, res, next) {
    console.error("EXPRESSJS ERROR");
    console.error("===============");
    console.error(err.stack);
    res.status(500).send(
        "An unexpected internal error occurred. If this error persists, please contact a developer. <a href='/'>Return to Home Page</a>."
    );
});
