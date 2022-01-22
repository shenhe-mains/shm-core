const { Client } = require("pg");

const { config } = require("./core/config");

const client = new Client(config.db_options);
exports.client = client;

client.query(
    `CREATE TABLE IF NOT EXISTS warns (
        id SERIAL PRIMARY KEY,
        time TIMESTAMP,
        mod_id VARCHAR(32),
        user_id VARCHAR(32),
        reason VARCHAR(4096),
        origin VARCHAR(256)
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS mutes (
        id SERIAL PRIMARY KEY,
        time TIMESTAMP,
        mod_id VARCHAR(32),
        user_id VARCHAR(32),
        duration INT,
        reason VARCHAR(4096),
        origin VARCHAR(256)
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS kicks (
        id SERIAL PRIMARY KEY,
        time TIMESTAMP,
        mod_id VARCHAR(32),
        user_id VARCHAR(32),
        reason VARCHAR(4096),
        origin VARCHAR(256)
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        time TIMESTAMP,
        mod_id VARCHAR(32),
        user_id VARCHAR(32),
        duration INT,
        reason VARCHAR(4096),
        origin VARCHAR(256)
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS unmutes (
        user_id VARCHAR(32) PRIMARY KEY,
        time TIMESTAMP
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS unbans (
        user_id VARCHAR(32) PRIMARY KEY,
        time TIMESTAMP
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS custom_roles (
        user_id VARCHAR(32) PRIMARY KEY,
        role_id VARCHAR(32)
    )`
);

exports.add_warn = async function (mod_id, user_id, reason, origin) {
    await client.query(
        `INSERT INTO warns (time, mod_id, user_id, reason, origin) VALUES ($1, $2, $3, $4, $5)`,
        [new Date(), mod_id, user_id, reason, origin]
    );
};

exports.add_mute = async function (mod_id, user_id, duration, reason, origin) {
    await mute_or_ban("mutes", mod_id, user_id, duration, reason, origin);
};

exports.add_kick = async function (mod_id, user_id, reason, origin) {
    await client.query(
        `INSERT INTO kicks (time, mod_id, user_id, reason, origin) VALUES ($1, $2, $3, $4, $5)`,
        [new Date(), mod_id, user_id, reason, origin]
    );
};

exports.add_ban = async function (mod_id, user_id, duration, reason, origin) {
    await mute_or_ban("bans", mod_id, user_id, duration, reason, origin);
};

async function mute_or_ban(type, mod_id, user_id, duration, reason, origin) {
    const now = new Date();
    await client.query(
        `INSERT INTO ${type} (time, mod_id, user_id, duration, reason, origin) VALUES ($1, $2, $3, $4, $5, $6)`,
        [now, mod_id, user_id, duration, reason, origin]
    );
    if (duration != 0) {
        now.setSeconds(now.getSeconds() + duration);
        if (
            (
                await client.query(
                    `SELECT 1 FROM un${type} WHERE user_id = $1`,
                    [user_id]
                )
            ).rows.length > 0
        ) {
            await client.query(
                `UPDATE un${type} SET time = $2 WHERE user_id = $1`,
                [user_id, now]
            );
        } else {
            await client.query(
                `INSERT INTO un${type} (user_id, time) VALUES ($1, $2)`,
                [user_id, now]
            );
        }
    }
}

exports.remove_mute = async function (user_id) {
    await client.query(`DELETE FROM unmutes WHERE user_id = $1`, [user_id]);
};

exports.remove_ban = async function (user_id) {
    await client.query(`DELETE FROM unbans WHERE user_id = $1`, [user_id]);
};

exports.get_custom_role = get_custom_role = async function (user_id) {
    const result = (
        await client.query(
            `SELECT role_id FROM custom_roles WHERE user_id = $1`,
            [user_id]
        )
    ).rows;
    return result && result.length > 0 ? result[0].role_id : undefined;
};

exports.set_custom_role = async function (user_id, role_id) {
    if ((await get_custom_role(user_id)) === undefined) {
        await client.query(
            `INSERT INTO custom_roles (user_id, role_id) VALUES ($1, $2)`,
            [user_id, role_id]
        );
    } else {
        await client.query(
            `UPDATE custom_roles SET role_id = $2 WHERE user_id = $1`,
            [user_id, role_id]
        );
    }
};
