const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const actionSchema = new Schema({
    game: {
        type: Schema.Types.ObjectId,
        ref: "Game",
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    actionType: {
        type: String,
    },
    card: {
        type: Schema.Types.ObjectId,
        ref: "Card",
    },
    createdAt: {
        type: Date,
        expires: 43200,
        default: Date.now,
    },
});

module.exports = mongoose.model("Action", actionSchema);
