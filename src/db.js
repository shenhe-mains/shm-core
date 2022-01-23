const { Client } = require("pg");

const { config } = require("./core/config");
const { PollError } = require("./errors");

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

client.query(
    `CREATE TABLE IF NOT EXISTS protected_channels (
        id VARCHAR(32) PRIMARY KEY
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS user_roles (
        role_id VARCHAR(32),
        user_id VARCHAR(32)
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS polls (
        message_id VARCHAR(32),
        type INT
    )`
);

client.query(
    `CREATE TABLE IF NOT EXISTS poll_votes (
        message_id VARCHAR(32) PRIMARY KEY,
        user_id VARCHAR(32),
        option VARCHAR(100)
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

exports.is_protected = is_protected = async function (channel_id) {
    return (
        (
            await client.query(
                `SELECT 1 FROM protected_channels WHERE id = $1`,
                [channel_id]
            )
        ).rows.length > 0
    );
};

exports.add_protect = async function (channel_id) {
    if (!(await is_protected(channel_id))) {
        await client.query(`INSERT INTO protected_channels (id) VALUES ($1)`, [
            channel_id,
        ]);
    }
};

exports.remove_protect = async function (channel_id) {
    await client.query(`DELETE FROM protected_channels WHERE id = $1`, [
        channel_id,
    ]);
};

exports.add_user_role = async function (user_id, role_id) {
    await client.query(
        `INSERT INTO user_roles (role_id, user_id) VALUES ($1, $2)`,
        [role_id, user_id]
    );
};

exports.remove_user_role = async function (user_id, role_id) {
    await client.query(
        `DELETE FROM user_roles WHERE role_id = $1 AND user_id = $2`,
        [role_id, user_id]
    );
};

exports.get_users_by_role = async function (role_id) {
    return (
        await client.query(
            `SELECT user_id FROM user_roles WHERE role_id = $1`,
            [role_id]
        )
    ).rows.map((row) => row.user_id);
};

exports.create_poll = async function (message_id, type) {
    await client.query(`INSERT INTO polls (message_id, type) VALUES ($1, $2)`, [
        message_id,
        type,
    ]);
};

exports.poll_type = async function (message_id) {
    const results = (
        await client.query(`SELECT type FROM polls WHERE message_id = $1`, [
            message_id,
        ])
    ).rows;
    return results.length == 0 ? -1 : results[0].type;
};

exports.has_vote = async function (message_id, user_id, option) {
    return (
        (
            await client.query(
                `SELECT 1 FROM poll_votes WHERE message_id = $1 AND user_id = $2 AND option = $3`,
                [message_id, user_id, option]
            )
        ).rows.length > 0
    );
};

exports.add_vote = async function (message_id, user_id, option) {
    await client.query(
        `INSERT INTO poll_votes (message_id, user_id, option) VALUES ($1, $2, $3)`,
        [message_id, user_id, option]
    );
};

exports.remove_vote = async function (message_id, user_id, option) {
    await client.query(
        `DELETE FROM poll_votes WHERE message_id = $1 AND user_id = $2 AND option = $3`,
        [message_id, user_id, option]
    );
};
