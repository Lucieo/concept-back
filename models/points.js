const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// const { pubsub } = require('../schema');
const pubsub = require("../schema/pubsub");
const _ = require("lodash");
const debug = require("debug")("esquisse:game");

const pointsSchema = new Schema({
    player: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
    },
    points: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        expires: 43200,
        default: Date.now,
    },
});

module.exports = mongoose.model("Points", pointsSchema);
