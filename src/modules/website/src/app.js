const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

exports.app = app = express();
app.use("/static", express.static(path.join(__dirname, "../static")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());
