const { Client } = require("pg");

const { config } = require("./core/config");

const client = new Client(config.db_options);
exports.client = client;

// moderation
{
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

    exports.add_warn = async function (mod_id, user_id, reason, origin) {
        await client.query(
            `INSERT INTO warns (time, mod_id, user_id, reason, origin) VALUES ($1, $2, $3, $4, $5)`,
            [new Date(), mod_id, user_id, reason, origin]
        );
    };

    exports.add_mute = async function (
        mod_id,
        user_id,
        duration,
        reason,
        origin
    ) {
        await mute_or_ban("mutes", mod_id, user_id, duration, reason, origin);
    };

    exports.add_kick = async function (mod_id, user_id, reason, origin) {
        await client.query(
            `INSERT INTO kicks (time, mod_id, user_id, reason, origin) VALUES ($1, $2, $3, $4, $5)`,
            [new Date(), mod_id, user_id, reason, origin]
        );
    };

    exports.add_ban = async function (
        mod_id,
        user_id,
        duration,
        reason,
        origin
    ) {
        await mute_or_ban("bans", mod_id, user_id, duration, reason, origin);
    };

    async function mute_or_ban(
        type,
        mod_id,
        user_id,
        duration,
        reason,
        origin
    ) {
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
}

// custom roles
{
    client.query(
        `CREATE TABLE IF NOT EXISTS custom_roles (
            user_id VARCHAR(32) PRIMARY KEY,
            role_id VARCHAR(32)
        )`
    );

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
}

// nukeguard
{
    client.query(
        `CREATE TABLE IF NOT EXISTS protected_channels (
            id VARCHAR(32) PRIMARY KEY
        )`
    );

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
            await client.query(
                `INSERT INTO protected_channels (id) VALUES ($1)`,
                [channel_id]
            );
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
}

// polls
{
    client.query(
        `CREATE TABLE IF NOT EXISTS user_roles (
            role_id VARCHAR(32),
            user_id VARCHAR(32)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS polls (
            message_id VARCHAR(32),
            channel_id VARCHAR(32),
            type INT
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS poll_options (
            message_id VARCHAR(32),
            option VARCHAR(100)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS poll_votes (
            message_id VARCHAR(32),
            user_id VARCHAR(32),
            option VARCHAR(100)
        )`
    );

    exports.create_poll = async function (
        message_id,
        channel_id,
        type,
        options
    ) {
        await client.query(
            `INSERT INTO polls (message_id, channel_id, type) VALUES ($1, $2, $3)`,
            [message_id, channel_id, type]
        );
        for (var option of options) {
            await client.query(
                `INSERT INTO poll_options (message_id, option) VALUES ($1, $2)`,
                [message_id, option]
            );
        }
    };

    exports.fetch_poll = async function (message_id) {
        return (
            await client.query(`SELECT * FROM polls WHERE message_id = $1`, [
                message_id,
            ])
        ).rows[0];
    };

    exports.poll_type = async function (message_id) {
        return (
            await client.query(`SELECT type FROM polls WHERE message_id = $1`, [
                message_id,
            ])
        ).rows[0].type;
    };

    exports.poll_options = async function (message_id) {
        return (
            await client.query(
                `SELECT option FROM poll_options WHERE message_id = $1`,
                [message_id]
            )
        ).rows.map((entry) => entry.option);
    };

    exports.poll_votes = async function (message_id, option) {
        return parseInt(
            (
                await client.query(
                    `SELECT COUNT(1) FROM poll_votes WHERE message_id = $1 AND option = $2`,
                    [message_id, option]
                )
            ).rows[0].count
        );
    };

    exports.has_any_vote = async function (message_id, user_id) {
        return (
            (
                await client.query(
                    `SELECT 1 FROM poll_votes WHERE message_id = $1 AND user_id = $2`,
                    [message_id, user_id]
                )
            ).rows.length > 0
        );
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

    exports.clear_votes = async function (message_id, user_id) {
        await client.query(
            `DELETE FROM poll_votes WHERE message_id = $1 AND user_id = $2`,
            [message_id, user_id]
        );
    };
}

// sticky messages
{
    client.query(
        `CREATE TABLE IF NOT EXISTS sticky_messages (
            channel_id VARCHAR(32) PRIMARY KEY,
            content VARCHAR(4096),
            message_id VARCHAR(32)
        )`
    );

    exports.create_sticky = async function (channel_id, content) {
        await client.query(
            `INSERT INTO sticky_messages (channel_id, content) VALUES ($1, $2)`,
            [channel_id, content]
        );
    };

    exports.has_sticky = async function (channel_id) {
        return (
            (
                await client.query(
                    `SELECT 1 FROM sticky_messages WHERE channel_id = $1`,
                    [channel_id]
                )
            ).rows.length > 0
        );
    };

    exports.get_sticky = async function (channel_id) {
        return (
            await client.query(
                `SELECT content, message_id FROM sticky_messages WHERE channel_id = $1`,
                [channel_id]
            )
        ).rows[0];
    };

    exports.set_sticky = async function (channel_id, message_id) {
        await client.query(
            `UPDATE sticky_messages SET message_id = $1 WHERE channel_id = $2`,
            [message_id, channel_id]
        );
    };

    exports.delete_sticky = async function (channel_id) {
        await client.query(
            `DELETE FROM sticky_messages WHERE channel_id = $1`,
            [channel_id]
        );
    };
}

// triggers
{
    client.query(
        `CREATE TABLE IF NOT EXISTS triggers (
            match VARCHAR(4096) PRIMARY KEY,
            wildcard BOOLEAN,
            public BOOLEAN,
            reply INT,
            response VARCHAR(2000)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS trigger_allow (
            match VARCHAR(4096),
            channel_id VARCHAR(32),
            allow BOOLEAN
        )`
    );

    exports.create_trigger = async function (
        match,
        wildcard,
        public,
        reply,
        response
    ) {
        await client.query(
            `INSERT INTO triggers (match, wildcard, public, reply, response) VALUES ($1, $2, $3, $4, $5)`,
            [match, wildcard, public, reply, response]
        );
    };

    exports.has_trigger = async function (match) {
        return (
            (
                await client.query(`SELECT 1 FROM triggers WHERE match = $1`, [
                    match,
                ])
            ).rows.length > 0
        );
    };

    exports.get_trigger = async function (match) {
        return (
            await client.query(`SELECT * FROM triggers WHERE match = $1`, [
                match,
            ])
        ).rows[0];
    };

    exports.set_trigger_allow = async function (match, channel_id, allow) {
        if (
            (
                await client.query(
                    `SELECT 1 FROM trigger_allow WHERE match = $1 AND channel_id = $2`,
                    [match, channel_id]
                )
            ).rows.length > 0
        ) {
            await client.query(
                `UPDATE trigger_allow SET allow = $1 WHERE match = $2 AND channel_id = $3`,
                [allow, match, channel_id]
            );
        } else {
            await client.query(
                `INSERT INTO trigger_allow (match, channel_id, allow) VALUES ($1, $2, $3)`,
                [match, channel_id, allow]
            );
        }
    };

    exports.get_trigger_allow = async function (match, channel_id) {
        const entry = (
            await client.query(
                `SELECT allow FROM trigger_allow WHERE match = $1 AND channel_id = $2`,
                [match, channel_id]
            )
        ).rows[0];
        return entry === undefined
            ? (
                  await client.query(
                      `SELECT public FROM triggers WHERE match = $1`,
                      [match]
                  )
              ).rows[0].public
            : entry.allow;
    };

    exports.remove_trigger = async function (match) {
        await client.query(`DELETE FROM triggers WHERE match = $1`, [match]);
    };
}

// modmail
{
    client.query(
        `CREATE TABLE IF NOT EXISTS modmail_channels (
            user_id VARCHAR(32),
            channel_id VARCHAR(32)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS modmail_messages (
            user_id VARCHAR(32),
            time TIMESTAMP,
            sender_id VARCHAR(32),
            sender_name VARCHAR(64),
            message_type INTEGER,
            content VARCHAR(4096)
        )`
    );

    exports.get_modmail_threads = async function () {
        return (await client.query(`SELECT COUNT(1) FROM modmail_channels`))
            .rows[0].count;
    };

    exports.get_modmail_channel = async function (user_id) {
        return (
            await client.query(
                `SELECT channel_id FROM modmail_channels WHERE user_id = $1`,
                [user_id]
            )
        ).rows[0].channel_id;
    };

    exports.get_modmail_for_channel = async function (channel_id) {
        return (
            await client.query(
                `SELECT user_id FROM modmail_channels WHERE channel_id = $1`,
                [channel_id]
            )
        ).rows[0].user_id;
    };

    exports.is_modmail_channel = async function (channel_id) {
        return (
            (
                await client.query(
                    `SELECT 1 FROM modmail_channels WHERE channel_id = $1`,
                    [channel_id]
                )
            ).rows.length > 0
        );
    };

    exports.set_modmail_channel = async function (user_id, channel_id) {
        if (
            (
                await client.query(
                    `SELECT 1 FROM modmail_channels WHERE user_id = $1`,
                    [user_id]
                )
            ).rows.length > 0
        ) {
            await client.query(
                `UPDATE modmail_channels SET channel_id = $1 WHERE user_id = $2`,
                [channel_id, user_id]
            );
        } else {
            await client.query(
                `INSERT INTO modmail_channels (user_id, channel_id) VALUES ($1, $2)`,
                [user_id, channel_id]
            );
        }
    };

    exports.close_modmail_channel = async function (user_id) {
        await client.query(`DELETE FROM modmail_channels WHERE user_id = $1`, [
            user_id,
        ]);
    };

    exports.create_modmail_message = async function (
        user_id,
        sender,
        message_type,
        content
    ) {
        await client.query(
            `INSERT INTO modmail_messages (user_id, time, sender_id, sender_name, message_type, content) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                user_id,
                new Date(),
                sender.id,
                `${sender.username}#${sender.discriminator}`,
                message_type,
                content,
            ]
        );
    };

    exports.get_modmail_messages = async function (user_id) {
        return (
            await client.query(
                `SELECT * FROM modmail_messages WHERE user_id = $1 ORDER BY time ASC`,
                [user_id]
            )
        ).rows;
    };
}

// staff applications
{
    client.query(
        `CREATE TABLE IF NOT EXISTS mod_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            mod_intro VARCHAR(4096),
            mod_strengths VARCHAR(4096),
            mod_scenarios VARCHAR(4096),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS tcmod_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            mod_intro VARCHAR(4096),
            tc_experience VARCHAR(4096),
            mod_scenarios VARCHAR(4096),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS dev_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            dev_experience VARCHAR(4096),
            dev_languages VARCHAR(1024),
            dev_databases VARCHAR(1024),
            dev_portfolio VARCHAR(1024),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS art_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            art_forms VARCHAR(1024),
            art_uploads VARCHAR(1024),
            art_portfolio VARCHAR(1024),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS tc_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            tc_experience VARCHAR(4096),
            tc_shenhe VARCHAR(4096),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS tl_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            tl_intro VARCHAR(4096),
            tl_chinese VARCHAR(4096),
            tl_leaks VARCHAR(16),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS event_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            event_experience VARCHAR(4096),
            event_ideas VARCHAR(4096),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS media_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(32),
            time TIMESTAMP,
            status INT,
            timezone INT,
            media_profiles VARCHAR(1024),
            media_post_ideas VARCHAR(4096),
            media_reach_ideas VARCHAR(4096),
            time_dedication VARCHAR(1024),
            motivation VARCHAR(1024),
            advocate VARCHAR(1024)
        )`
    );

    exports.has_application = has_application = async function (team, user_id) {
        return (
            (
                await client.query(
                    `SELECT 1 FROM ${team}_applications WHERE user_id = $1 AND status = 0`,
                    [user_id]
                )
            ).rows.length > 0
        );
    };

    exports.get_application = async function (team, user_id) {
        return (
            await client.query(
                `SELECT * FROM ${team}_applications WHERE user_id = $1 AND status = 0`,
                [user_id]
            )
        ).rows[0];
    };

    exports.resolve_application = async function (team, user_id, accept) {
        await client.query(
            `UPDATE ${team}_applications SET status = $1 WHERE user_id = $2 AND status = 0`,
            [accept ? 1 : 2, user_id]
        );
    };

    exports.get_application_by_id = async function (team, id) {
        return (
            await client.query(
                `SELECT * FROM ${team}_applications WHERE id = $1`,
                [id]
            )
        ).rows[0];
    };

    exports.apply = async function (team, user_id, keys, values) {
        var query_string;
        if (await has_application(team, user_id)) {
            query_string =
                `UPDATE ${team}_applications SET ` +
                keys.map((key, index) => `${key} = $${index + 2}`).join(", ") +
                ` WHERE user_id = $1`;
        } else {
            query_string = `INSERT INTO ${team}_applications (user_id, status, time, ${keys.join(
                ", "
            )}) VALUES ($1, 0, $2, ${keys
                .map((key, index) => `$${index + 3}`)
                .join(", ")})`;
        }
        await client.query(query_string, [user_id, new Date(), values].flat());
    };

    exports.get_applications = async function (user_id) {
        const applications = [];
        for (const team in config.staff_teams) {
            for (const entry of (
                await client.query(
                    `SELECT * FROM ${team}_applications WHERE user_id = $1`,
                    [user_id]
                )
            ).rows) {
                applications.push([team, entry]);
            }
        }
        return applications.sort((a, b) => b[1].time - a[1].time);
    };

    exports.get_open_applications = async function () {
        const applications = [];
        for (const team in config.staff_teams) {
            for (const entry of (
                await client.query(
                    `SELECT * FROM ${team}_applications WHERE status = 0`
                )
            ).rows) {
                applications.push([team, entry]);
            }
        }
        return applications;
    };
}
