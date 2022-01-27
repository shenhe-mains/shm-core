const { has_permission } = require("../../core/privileges");
const { PermissionError, Success } = require("../../errors");
const { client } = require("../../db");
const { pagify } = require("../../pages");

exports.commands = {
    db: dbquery,
};

async function dbquery(ctx, args, body) {
    if (!has_permission(ctx.author, "database")) {
        throw new PermissionError(
            "You do not have permission to query the database."
        );
    }
    const result = await client.query(body);
    if (result.rows.length == 0) {
        throw new Success(
            "Database Query Result",
            "Your database query did not return any rows."
        );
    }
    const fields = [];
    const field_names = result.fields.map((field) => field.name);
    for (const row in result.rows) {
        fields.push({
            name: `Row ${row + 1}`,
            value:
                "```" +
                field_names
                    .map((name) => name + ": " + result.rows[row][name])
                    .join("\n") +
                "```",
        });
    }
    await pagify(
        ctx,
        {
            title: "Database Query Result",
            color: "GREEN",
        },
        fields,
        5
    );
    throw new Success();
}
