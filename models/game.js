const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// const { pubsub } = require('../schema');
const pubsub = require("../schema/pubsub");
const _ = require("lodash");
const debug = require("debug")("esquisse:game");

const gameSchema = new Schema({
    players: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    currentWord: {
        type: String,
        default: "",
    },
    creator: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    status: {
        type: String,
        default: "new",
    },
    turn: {
        type: Number,
        default: 0,
    },
    step: {
        type: String,
        default: "selectWord",
    },
    gamePoints: {
        type: Array,
    },
    conceptsLists: {
        type: Array,
        default: [[]],
    },
    createdAt: {
        type: Date,
        expires: 43200,
        default: Date.now,
    },
});

module.exports = mongoose.model("Game", gameSchema);
