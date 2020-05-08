const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// const { pubsub } = require('../schema');
const pubsub = require("../schema/pubsub");
const _ = require("lodash");
const debug = require("debug")("esquisse:game");
const Card = require("./card");
const User = require("./user");
const Deck = require("./deck");
const { shuffle } = require("../utils");

const gameSchema = new Schema({
    players: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    creator: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    status: {
        type: String,
        default: "new",
    },
    step: {
        type: String,
        default: "init",
    },
    turn: {
        type: String,
        default: 0,
    },
    turnVotes: [
        {
            type: Schema.Types.ObjectId,
            ref: "Action",
        },
    ],
    turnDeck: [
        {
            type: Schema.Types.ObjectId,
            ref: "Action",
        },
    ],
    currentWord: {
        type: String,
    },
    distributedCards: [
        {
            type: Schema.Types.ObjectId,
            ref: "Card",
        },
    ],
    decks: [
        {
            type: Schema.Types.ObjectId,
            ref: "Deck",
        },
    ],
    gamePoints: {
        type: Array,
    },
    turnPoints: {
        type: Array,
    },
    createdAt: {
        type: Date,
        expires: 43200,
        default: Date.now,
    },
});

//

gameSchema.statics.endTurn = async function (game) {
    const winner = game.gamePoints.find((point) => point.points >= 25);
    const cardsLeft = Card.count() - game.distributedCards.length;
    if (winner || cardsLeft < game.players.length) {
        game.status = "over";
        game.gamePoints.forEach(async (point) => {
            const user = await User.findById(point.player.toString());
            user.totalPoints += point.points;
            user.totalGames += 1;
            await user.save();
        });
    } else {
        //Get each player a new card
        let selectedCards = await Card.find({
            _id: { $nin: game.distributedCards },
        });
        selectedCards = shuffle(selectedCards);
        selectedCards = selectedCards.splice(0, game.players.length);
        game.distributedCards = [...game.distributedCards, ...selectedCards];
        game.players.forEach(async (owner) => {
            const newCard = selectedCards.splice(0, 1)[0];
            const deck = await Deck.findOne({ owner, gameId: game.id });
            deck.cards = [...deck.cards, newCard._id];
            await deck.save();
        });
        //Update Turn
        game.turn =
            +game.turn + 1 > game.players.length - 1 ? 0 : +game.turn + 1;
        game.currentWord = "";
        game.turnPoints = [];
        game.turnDeck = [];
        game.turnVotes = [];
    }
    game.save();
};

gameSchema.statics.evaluateTurn = async function (game, turnMaster) {
    const points = game.players.map((player) => ({
        player: player._id,
        points: 0,
    }));
    const masterCardId = game.turnDeck.find(
        (card) => card.owner.toString() === turnMaster
    ).card.id;

    const votesForMaster = game.turnVotes
        .filter((vote) => {
            return vote.card.id === masterCardId;
        })
        .map((el) => el.owner);
    const hasMasterWon =
        votesForMaster.length > 0 &&
        votesForMaster.length < game.players.length - 1;

    if (hasMasterWon) {
        votesForMaster.push(turnMaster);
        points.forEach((el, idx) => {
            if (votesForMaster.indexOf(el.player.toString()) > -1) {
                points[idx] = { ...el, points: el.points + 3 };
            }
        });
    } else {
        points.forEach((el, idx) => {
            if (el.player.toString() !== turnMaster) {
                points[idx] = { ...el, points: el.points + 2 };
            }
        });
    }

    const otherPlayers = game.players
        .filter((player) => player._id.toString() !== turnMaster)
        .map((player) => player._id);

    otherPlayers.forEach((player) => {
        const playerCardId = game.turnDeck.find(
            (card) => card.owner.toString() === player._id.toString()
        ).card.id;
        const votesReceived = game.turnVotes.filter(
            (vote) => vote.card.id === playerCardId
        );
        const pointsId = points.findIndex((el) => el.player === player);
        const pointsObj = points[pointsId];
        points[pointsId] = {
            ...pointsObj,
            points: pointsObj.points + votesReceived.length,
        };
    });
    game.turnPoints = points;
    game.gamePoints = points.map((el, idx) => {
        let points;
        if (game.gamePoints[idx]) {
            points = el.points + game.gamePoints[idx].points;
        } else {
            points = el.points;
        }
        return { ...el, points };
    });
    game.save();
    return game;
};

module.exports = mongoose.model("Game", gameSchema);
