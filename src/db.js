const { Client } = require("pg");

const config = require("../config.json");

const client = new Client(config.db_options);
exports.client = client;

exports.get_prefix = async function () {
    return (await client.query(`SELECT prefix FROM settings`)).rows[0].prefix;
};

exports.set_prefix = async function (new_prefix) {
    await client.query(`UPDATE settings SET prefix = $1`, prefix);
};
