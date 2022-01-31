const { confirmationInteraction } = require("../../confirmation");
const { create_tasks } = require("../../core/moderation");
const { pageInteraction } = require("../../pages");

exports.listeners = {
    ready: [create_tasks],
    interactionCreate: [pageInteraction, confirmationInteraction],
};
