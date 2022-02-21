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

// automod
{
    client.query(
        `CREATE TABLE IF NOT EXISTS automod_terms (
            match VARCHAR(1024) PRIMARY KEY,
            type INT,
            severity INT,
            reports INT
        )`
    );

    exports.get_automod_terms = async function () {
        return (await client.query(`SELECT * FROM automod_terms`)).rows;
    };

    exports.has_automod_term = async function (match) {
        return (
            (
                await client.query(
                    `SELECT COUNT(1) FROM automod_terms WHERE match = $1`,
                    [match]
                )
            ).rows[0].count > 0
        );
    };

    exports.add_automod_report = async function (match) {
        const count = (
            await client.query(
                `SELECT reports FROM automod_terms WHERE match = $1`,
                [match]
            )
        ).rows[0].reports;
        await client.query(
            `UPDATE automod_terms SET reports = $1 WHERE match = $2`,
            [count + 1, match]
        );
    };

    exports.add_automod_term = async function (match, type, severity) {
        await client.query(
            `INSERT INTO automod_terms (match, type, severity, reports) VALUES ($1, $2, $3, 0)`,
            [match, type, severity]
        );
    };

    exports.remove_automod_term = async function (match) {
        await client.query(`DELETE FROM automod_terms WHERE match = $1`, [
            match,
        ]);
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

    client.query(
        `CREATE TABLE IF NOT EXISTS user_roles (
            role_id VARCHAR(32),
            user_id VARCHAR(32)
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
        `CREATE TABLE IF NOT EXISTS closed_modmail (
            channel_id VARCHAR(32) PRIMARY KEY
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

    exports.close_modmail_channel = async function (user_id, channel_id) {
        await client.query(`DELETE FROM modmail_channels WHERE user_id = $1`, [
            user_id,
        ]);
        await client.query(
            `INSERT INTO closed_modmail (channel_id) VALUES ($1)`,
            [channel_id]
        );
    };

    exports.is_closed_modmail = async function (channel_id) {
        return (
            (
                await client.query(
                    `SELECT COUNT(1) FROM closed_modmail WHERE channel_id = $1`,
                    [channel_id]
                )
            ).rows[0].count > 0
        );
    };

    exports.delete_modmail = async function (channel_id) {
        await client.query(`DELETE FROM closed_modmail WHERE channel_id = $1`, [
            channel_id,
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
            [user_id, new Date(), sender.id, sender.tag, message_type, content]
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
        `CREATE TABLE IF NOT EXISTS application_channels (
            team VARCHAR(16),
            user_id VARCHAR(32),
            channel_id VARCHAR(32)
        )`
    );

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
        const exists = await has_application(team, user_id);
        if (exists) {
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
        await client.query(
            query_string,
            [user_id, exists ? [] : [new Date()], values].flat()
        );
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

    exports.has_application_channel = has_application_channel = async function (
        team,
        user_id
    ) {
        return (
            (
                await client.query(
                    `SELECT 1 FROM application_channels WHERE team = $1 AND user_id = $2`,
                    [team, user_id]
                )
            ).rows.length > 0
        );
    };

    exports.get_application_channel = async function (team, user_id) {
        return (
            await client.query(
                `SELECT channel_id FROM application_channels WHERE team = $1 AND user_id = $2`,
                [team, user_id]
            )
        ).rows[0].channel_id;
    };

    exports.set_application_channel = async function (
        team,
        user_id,
        channel_id
    ) {
        if (await has_application_channel(team, user_id)) {
            await client.query(
                `UPDATE application_channels SET channel_id = $1 WHERE team = $2 AND user_id = $3`,
                [channel_id, team, user_id]
            );
        } else {
            await client.query(
                `INSERT INTO application_channels (team, user_id, channel_id) VALUES ($1, $2, $3)`,
                [team, user_id, channel_id]
            );
        }
    };
}

// starboard
{
    client.query(
        `CREATE TABLE IF NOT EXISTS starboard (
            message_id VARCHAR(32) PRIMARY KEY,
            channel_id VARCHAR(32),
            relayed_id VARCHAR(32)
        )`
    );

    exports.get_starboard_message = get_starboard_message = async function (
        message_id
    ) {
        return (
            await client.query(
                `SELECT channel_id, relayed_id FROM starboard WHERE message_id = $1`,
                [message_id]
            )
        ).rows[0];
    };

    exports.set_starboard_message = async function (
        message_id,
        channel_id,
        relayed_id
    ) {
        if ((await get_starboard_message(message_id)) === undefined) {
            await client.query(
                `INSERT INTO starboard (message_id, channel_id, relayed_id) VALUES ($1, $2, $3)`,
                [message_id, channel_id, relayed_id]
            );
        } else {
            await client.query(
                `UPDATE starboard SET channel_id = $1, relayed_id = $2 WHERE message_id = $3`,
                [channel_id, relayed_id, message_id]
            );
        }
    };

    exports.delete_starboard_message = async function (message_id) {
        await client.query(`DELETE FROM starboard WHERE message_id = $1`, [
            message_id,
        ]);
    };
}

// autoroles
{
    client.query(
        `CREATE TABLE IF NOT EXISTS autoroles (
            user_id VARCHAR(32),
            role_id VARCHAR(32)
        )`
    );

    exports.set_autoroles = async function (user_id, role_ids) {
        await client.query(`DELETE FROM autoroles WHERE user_id = $1`, [
            user_id,
        ]);
        await client.query(
            `INSERT INTO autoroles (user_id, role_id) VALUES ${role_ids
                .map(
                    (role_id, index) => `($${index * 2 + 1}, $${index * 2 + 2})`
                )
                .join(", ")}`,
            role_ids.map((role_id) => [user_id, role_id]).flat()
        );
    };

    exports.get_autoroles = async function (user_id) {
        return (
            await client.query(
                `SELECT role_id FROM autoroles WHERE user_id = $1`,
                [user_id]
            )
        ).rows.map((row) => row.role_id);
    };
}

// suggestions
{
    client.query(
        `CREATE TABLE IF NOT EXISTS suggestions (
            id SERIAL PRIMARY KEY,
            message_id VARCHAR(32),
            user_id VARCHAR(32)
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS suggestion_votes (
            id INT,
            user_id VARCHAR(32),
            up BOOLEAN
        )`
    );

    exports.create_suggestion = async function (temp_id, user_id) {
        await client.query(
            `INSERT INTO suggestions (message_id, user_id) VALUES ($1, $2)`,
            [temp_id, user_id]
        );
        return (
            await client.query(
                `SELECT id FROM suggestions WHERE message_id = $1`,
                [temp_id]
            )
        ).rows[0].id;
    };

    exports.set_suggestion = async function (id, message_id) {
        await client.query(
            `UPDATE suggestions SET message_id = $1 WHERE id = $2`,
            [message_id, id]
        );
    };

    exports.get_suggestion = async function (id) {
        return (
            await client.query(
                `SELECT message_id, user_id FROM suggestions WHERE id = $1`,
                [id]
            )
        ).rows[0];
    };

    exports.get_vote = get_vote = async function (id, user_id) {
        const results = (
            await client.query(
                `SELECT up FROM suggestion_votes WHERE id = $1 AND user_id = $2`,
                [id, user_id]
            )
        ).rows;
        return results.length > 0 ? (results[0].up ? 1 : -1) : 0;
    };

    exports.set_vote = async function (id, user_id, val) {
        if (val == 0) {
            await client.query(
                `DELETE FROM suggestion_votes WHERE id = $1 AND user_id = $2`,
                [id, user_id]
            );
        } else if ((await get_vote(id, user_id)) == 0) {
            await client.query(
                `INSERT INTO suggestion_votes (id, user_id, up) VALUES ($1, $2, $3)`,
                [id, user_id, val > 0]
            );
        } else {
            await client.query(
                `UPDATE suggestion_votes SET up = $1 WHERE id = $2 AND user_id = $3`,
                [val > 0, id, user_id]
            );
        }
    };

    exports.get_scores = async function (id) {
        return (
            await Promise.all(
                [true, false].map((up) =>
                    client.query(
                        `SELECT COUNT(1) FROM suggestion_votes WHERE id = $1 AND up = $2`,
                        [id, up]
                    )
                )
            )
        ).map((x) => x.rows[0].count);
    };
}

// highlights
{
    client.query(
        `CREATE TABLE IF NOT EXISTS highlights (
            user_id VARCHAR(32),
            match VARCHAR(100)
        )`
    );

    exports.add_highlight = async function (user_id, match) {
        await client.query(
            `INSERT INTO highlights (user_id, match) VALUES ($1, $2)`,
            [user_id, match]
        );
    };

    exports.highlighting = async function (user_id, match) {
        return (
            (
                await client.query(
                    `SELECT COUNT(1) FROM highlights WHERE user_id = $1 AND match = $2`,
                    [user_id, match]
                )
            ).rows[0].count > 0
        );
    };

    exports.rm_highlight = async function (user_id, match) {
        await client.query(
            `DELETE FROM highlights WHERE user_id = $1 AND match = $2`,
            [user_id, match]
        );
    };

    exports.highlights_for = async function (user_id) {
        return (
            await client.query(
                `SELECT match FROM highlights WHERE user_id = $1`,
                [user_id]
            )
        ).rows.map((row) => row.match);
    };

    exports.clear_highlights = async function (user_id) {
        await client.query(`DELETE FROM highlights WHERE user_id = $1`, [
            user_id,
        ]);
    };

    exports.highlighting_users = async function () {
        return (
            await client.query(`SELECT DISTINCT user_id FROM highlights`)
        ).rows.map((row) => row.user_id);
    };
}

// reminders
{
    client.query(
        `CREATE TABLE IF NOT EXISTS reminders (
            id SERIAL PRIMARY KEY,
            message_id VARCHAR(32),
            user_id VARCHAR(32),
            time TIMESTAMP,
            content VARCHAR(4000),
            origin VARCHAR(256)
        )`
    );

    exports.add_reminder = async function (
        message_id,
        user_id,
        time,
        content,
        origin
    ) {
        await client.query(
            `INSERT INTO reminders (message_id, user_id, time, content, origin) VALUES ($1, $2, $3, $4, $5)`,
            [message_id, user_id, time, content, origin]
        );
        return (
            await client.query(
                `SELECT * FROM reminders WHERE message_id = $1`,
                [message_id]
            )
        ).rows[0];
    };

    exports.reminder_exists = async function (id) {
        return (
            (
                await client.query(
                    `SELECT COUNT(1) FROM reminders WHERE id = $1`,
                    [id]
                )
            ).rows[0].count > 0
        );
    };

    exports.reminder_owner = async function (id) {
        return (
            await client.query(`SELECT user_id FROM reminders WHERE id = $1`, [
                id,
            ])
        ).rows[0].user_id;
    };

    exports.get_reminders = async function (user_id) {
        return (
            await client.query(`SELECT * FROM reminders WHERE user_id = $1`, [
                id,
            ])
        ).rows;
    };

    exports.all_reminders = async function () {
        return (await client.query(`SELECT * FROM reminders`)).rows;
    };

    exports.rm_reminder = async function (id) {
        await client.query(`DELETE FROM reminders WHERE id = $1`, [id]);
    };
}

// xp
{
    client.query(
        `CREATE TABLE IF NOT EXISTS xp (
            user_id VARCHAR(32) PRIMARY KEY,
            text_xp FLOAT,
            voice_xp FLOAT
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS role_xp (
            role_id VARCHAR(32) PRIMARY KEY,
            xp FLOAT
        )`
    );

    client.query(
        `CREATE TABLE IF NOT EXISTS no_xp_channels (
            channel_id VARCHAR(32) PRIMARY KEY
        )`
    );

    exports.is_blocked = async function (channel) {
        for (const id of [channel.id, channel.parentId || []].flat()) {
            if (
                (
                    await client.query(
                        `SELECT COUNT(*) FROM no_xp_channels WHERE channel_id = $1`,
                        [id]
                    )
                ).rows[0].count > 0
            ) {
                return true;
            }
        }
        return false;
    };

    exports.block_channel = async function (channel_id) {
        await client.query(
            `INSERT INTO no_xp_channels (
                channel_id
            ) VALUES ($1) ON CONFLICT (
                channel_id
            ) DO UPDATE set channel_id = no_xp_channels.channel_id`,
            [channel_id]
        );
    };

    exports.unblock_channel = async function (channel_id) {
        await client.query(`DELETE FROM no_xp_channels WHERE channel_id = $1`, [
            channel_id,
        ]);
    };

    exports.register_role = async function (role_id) {
        await client.query(
            `INSERT INTO role_xp (
                role_id, xp
            ) VALUES ($1, 0) ON CONFLICT (
                role_id
            ) DO UPDATE SET xp = role_xp.xp`,
            [role_id]
        );
    };

    exports.delist_role = async function (role_id) {
        await client.query(`DELETE FROM role_xp WHERE role_id = $1`, [role_id]);
    };

    exports.drop_xp_roles = async function () {
        await client.query(`DELETE FROM role_xp`);
    };

    exports.list_xp_roles = async function () {
        return (await client.query(`SELECT * FROM role_xp`)).rows;
    };

    exports.add_role_xp = async function (role_id, xp) {
        await client.query(
            `UPDATE role_xp SET xp = xp + $1 WHERE role_id = $2`,
            [xp, role_id]
        );
    };

    exports.increase_xp = async function (
        user_id,
        text_amount,
        voice_amount,
        skip_check
    ) {
        if (!skip_check) {
            if (
                (
                    await client.query(
                        `SELECT COUNT(1) FROM xp WHERE user_id = $1`,
                        [user_id]
                    )
                ).rows[0].count == 0
            ) {
                await client.query(
                    `INSERT INTO xp (user_id, text_xp, voice_xp) VALUES ($1, 0, 0)`,
                    [user_id]
                );
            }
        }
        if (text_amount == 0 && voice_amount == 0) return;
        await client.query(
            `UPDATE xp SET text_xp = text_xp + $1, voice_xp = voice_xp + $2 WHERE user_id = $3`,
            [text_amount, voice_amount, user_id]
        );
    };

    exports.xp_rank_for = async function (type, user_id) {
        const result = (
            await client.query(`SELECT ${type}_xp FROM xp WHERE user_id = $1`, [
                user_id,
            ])
        ).rows;
        const xp = result.length == 0 ? 0 : result[0][type + "_xp"];
        return {
            xp: xp,
            rank: parseInt(
                (
                    await client.query(
                        `SELECT COUNT(1) FROM xp WHERE ${type}_xp > $1 OR ${type}_xp = $1 AND user_id < $2`,
                        [xp, user_id]
                    )
                ).rows[0].count
            ),
        };
    };

    exports.leaderboard = async function (type, limit, offset) {
        return (
            await client.query(
                `SELECT user_id, ${type}_xp as xp FROM xp WHERE ${type}_xp != 0 ORDER BY ${type}_xp DESC, user_id ASC LIMIT $1 OFFSET $2`,
                [limit, offset]
            )
        ).rows;
    };
}
