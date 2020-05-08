const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    admin: {
        type: Boolean,
        default: false,
    },
    icon: {
        type: String,
        default: "player1",
    },
    totalPoints: {
        type: Number,
        default: 0,
    },
    totalGames: {
        type: Number,
        default: 0,
    },
});

module.exports = mongoose.model("User", userSchema);
