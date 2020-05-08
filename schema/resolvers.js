const bcrypt = require("bcrypt");
const User = require("../models/user");
const Game = require("../models/game");
const Deck = require("../models/deck");
const Card = require("../models/card");
const Action = require("../models/action");
const { shuffle } = require("../utils");

const jwt = require("jsonwebtoken");
const { withFilter } = require("apollo-server-express");
const pubsub = require("./pubsub");
const debug = require("debug")("esquisse:resolvers");

const resolvers = {
    Query: {
        currentUser: async (parent, args, { user }) => {
            if (!user) {
                throw new Error("Not Authenticated");
            }
            return user;
        },
        getGameInfo: async (parent, { gameId }, { user }) => {
            const game = await Game.findById(gameId)
                .populate("players")
                .populate({
                    path: "turnDeck",
                    populate: {
                        path: "card",
                    },
                })
                .populate({
                    path: "turnVotes",
                    populate: {
                        path: "card",
                    },
                });
            return game;
        },
        getDeck: async (parent, { gameId }, { user }) => {
            const deck = await Deck.findOne({
                gameId,
                owner: user,
            }).populate("cards");
            return deck;
        },
    },
    Mutation: {
        signup: async (parent, { name, email, password }, context, info) => {
            const existingUser = await User.find({ email });
            if (existingUser.length > 0) {
                throw new Error("User with email already exists");
            }

            const hashedPw = await bcrypt.hash(password, 12);
            user = new User({
                email,
                name,
                password: hashedPw,
                name,
            });
            await user.save();
            return user;
        },
        login: async (parent, { email, password }, context) => {
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error("Invalid Login");
            }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                throw new Error("Invalid Login");
            }
            const token = jwt.sign(
                {
                    id: user.id,
                },
                process.env.SESSION_SECRET,
                {
                    expiresIn: "30d",
                }
            );
            return {
                token,
                user,
            };
        },
        modifyUser: (parent, { name, icon }, context) => {
            const user = context.user;
            user.name = name;
            user.icon = icon;
            user.save();
            return user;
        },
        createGame: (parent, {}, context) => {
            const game = new Game({
                creator: context.user.id,
                players: [context.user.id],
            });
            game.save();
            return {
                id: game.id,
            };
        },
        joinGame: async (parent, { gameId }, context) => {
            const game = await Game.findById(gameId).populate("players");
            if (game.players.indexOf(context.user.id) < 0) {
                game.players.push(context.user);
                await game.save();
            }
            pubsub.publish("PLAYER_UPDATE", {
                playerUpdate: {
                    players: game.players,
                    gameId: game.id,
                    creator: game.creator,
                },
            });
            return game;
        },
        leaveGame: async (parent, { gameId }, context) => {
            const game = await Game.findById(gameId).populate("players");
            const playersIds = game.players.map((player) => player._id);
            if (
                playersIds.indexOf(context.user.id) > -1 &&
                game.status === "new"
            ) {
                game.players = game.players.filter((user) => {
                    return user.id !== context.user.id;
                });
                if (game.players.length === 0) game.status = "abandonned";
                if (
                    game.creator.toString() === context.user.id.toString() &&
                    game.players.length > 0
                ) {
                    const newCreator = game.players[0].id;
                    game.creator = newCreator;
                }
                await game.save();
                pubsub.publish("PLAYER_UPDATE", {
                    playerUpdate: {
                        players: game.players,
                        gameId: game.id,
                        creator: game.creator,
                    },
                });
            }
            return game;
        },
        changeGameStatus: async (parent, { gameId, newStatus }, context) => {
            const game = await Game.findById(gameId)
                .populate("players")
                .populate("decks");
            if (
                game.status !== newStatus &&
                context.user.id === game.creator.toString()
            ) {
                game.status = newStatus;
                if (newStatus === "active") {
                    let selectedCards = await Card.find({
                        _id: { $nin: game.distributedCards },
                    });
                    //selectedCards = shuffle(selectedCards);
                    selectedCards.sort(function () {
                        return 0.5 - Math.random();
                    });
                    game.players.forEach((owner) => {
                        const userCards = selectedCards.splice(0, 6);
                        const deck = new Deck({
                            owner,
                            gameId,
                            cards: userCards,
                        });
                        deck.save();
                        game.decks.push(deck);
                        const userCardsIds = userCards.map((card) => card._id);
                        game.distributedCards = [
                            ...game.distributedCards,
                            ...userCardsIds,
                        ];
                    });
                }
                game.save();
                pubsub.publish("GAME_UPDATE", { gameUpdate: game });
            }
            return game;
        },
        initGame: async (parent, { gameId, cardId, currentWord }, { user }) => {
            const card = await Card.findById(cardId);
            const action = new Action({
                owner: user.id,
                actionType: "submitCard",
                card,
                game: gameId,
            });
            await action.save();
            userDeck = await Deck.findOne({ owner: user, gameId });
            userDeck.cards = userDeck.cards.filter((card) => {
                return card.toString() !== cardId;
            });
            await userDeck.save();
            const game = await Game.findById(gameId)
                .populate("players")
                .populate({
                    path: "turnDeck",
                    populate: {
                        path: "card",
                    },
                })
                .populate({
                    path: "turnVotes",
                    populate: {
                        path: "card",
                    },
                });
            if (game.turnDeck.indexOf(action) < 0) {
                game.turnDeck.push(action);
            }
            game.currentWord = currentWord;
            game.step = "select";
            await game.save();
            pubsub.publish("GAME_UPDATE", { gameUpdate: game });
            return { gameId, step: "init", status: "Game initiated" };
        },
        selectCard: async (
            parent,
            { gameId, cardId, actionType },
            { user }
        ) => {
            const card = await Card.findById(cardId);
            const action = new Action({
                owner: user.id,
                actionType,
                card,
                game: gameId,
            });
            await action.save();

            const game = await Game.findById(gameId);
            if (actionType === "submitCard") {
                //Select Card Action
                if (game.turnDeck.indexOf(action) < 0) {
                    game.turnDeck.push(action);
                    userDeck = await Deck.findOne({ owner: user, gameId });
                    userDeck.cards = userDeck.cards.filter((card) => {
                        return card.toString() !== cardId;
                    });
                    await userDeck.save();
                }
            } else {
                //Vote for Card Acton
                if (game.turnVotes.indexOf(action) < 0) {
                    game.turnVotes.push(action);
                }
            }
            await game.save();
            pubsub.publish("GAME_ACTION", {
                gameAction: {
                    gameId,
                    action,
                    actionType,
                },
            });
            return { gameId, step: actionType, status: "Action saved" };
        },
        launchGameStep: async (
            parent,
            { gameId, step, turnMaster },
            { user }
        ) => {
            let game = await Game.findById(gameId)
                .populate("players")
                .populate({
                    path: "turnDeck",
                    populate: {
                        path: "card",
                    },
                })
                .populate({
                    path: "turnVotes",
                    populate: {
                        path: "card",
                    },
                });
            if (step === "launchVote") {
                game.step = "vote";
                await game.save();
            } else if (step === "launchEvaluation") {
                game.step = "evaluate";
                await Game.evaluateTurn(game, turnMaster);
            } else if (step === "nextTurn") {
                game.step = "init";
                await Game.endTurn(game);
            }
            pubsub.publish("GAME_UPDATE", { gameUpdate: game });
            return game;
        },
    },
    Subscription: {
        playerUpdate: {
            subscribe: withFilter(
                () => {
                    return pubsub.asyncIterator(["PLAYER_UPDATE"]);
                },
                (payload, variables) => {
                    return payload.playerUpdate.gameId === variables.gameId;
                }
            ),
        },
        gameUpdate: {
            subscribe: withFilter(
                () => {
                    return pubsub.asyncIterator(["GAME_UPDATE"]);
                },
                (payload, variables) => {
                    debug(
                        "GAME UPDATE CALLED should pass ",
                        payload.gameUpdate.id === variables.gameId
                    );
                    return payload.gameUpdate.id === variables.gameId;
                }
            ),
        },
        gameAction: {
            subscribe: withFilter(
                () => {
                    return pubsub.asyncIterator(["GAME_ACTION"]);
                },
                (payload, variables) => {
                    return payload.gameAction.gameId === variables.gameId;
                }
            ),
        },
    },
};

module.exports = resolvers;
