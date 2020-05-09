const bcrypt = require("bcrypt");
const User = require("../models/user");
const Game = require("../models/game");
const Points = require("../models/points");

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
            const game = await Game.findById(gameId).populate("players");
            return game;
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
        createGame: async (parent, {}, context) => {
            const game = new Game({
                creator: context.user.id,
                players: [context.user.id],
            });
            await game.save();
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
            const game = await Game.findById(gameId).populate("players");
            if (
                game.status !== newStatus &&
                context.user.id === game.creator.toString()
            ) {
                game.status = newStatus;
                if (newStatus === "active") {
                    console.log(game.players);
                    game.players.forEach(async (player) => {
                        console.log(player);
                        const point = new Points({
                            gameId: game,
                            player,
                        });
                        await point.save();
                    });
                }
                game.save();
            }
            pubsub.publish("GAME_UPDATE", { gameUpdate: game });
            return game;
        },
        initGame: async (parent, { gameId, currentWord }, { user }) => {
            const game = await Game.findById(gameId).populate("players");
            game.currentWord = currentWord;
            game.step = "selectConcepts";
            await game.save();
            pubsub.publish("GAME_UPDATE", { gameUpdate: game });
            return { gameId };
        },
        nextTurn: async (parent, { gameId }, { user }) => {
            const game = await Game.findById(gameId).populate("players");
            const scores = await Points.find({ gameId });
            const finalWinner = scores.some((score) => +score.points >= 15);
            if (finalWinner) {
                game.status = "over";
                game.players.forEach(async (player) => {
                    const user = User.findById(player.id);
                    user.points += scores.find(
                        (score) => score.player.id === user.id.toString()
                    );
                    user.totalGames += 1;
                    await user.save();
                });
            } else {
                game.turn =
                    +game.turn + 1 > game.players.length - 1
                        ? 0
                        : +game.turn + 1;
                game.step = "selectWord";
                game.conceptsLists = [[]];
                game.currentWord = undefined;
            }
            await game.save();
            pubsub.publish("GAME_UPDATE", { gameUpdate: game });
            return { gameId };
        },
        guessAction: async (parent, { gameId, word }, { user }) => {
            const game = await Game.findById(gameId).populate("players");
            const winner =
                game.currentWord &&
                cleanWord(game.currentWord) === cleanWord(word);
            if (winner) {
                const turnMaster = game.players[game.turn];
                const turnMasterPoints = await Points.findOne({
                    player: turnMaster,
                    gameId,
                });
                turnMasterPoints.points = +turnMasterPoints.points + 1;
                await turnMasterPoints.save();
                const playerPoints = await Points.findOne({
                    player: user,
                    gameId,
                });
                playerPoints.points = +playerPoints.points + 1;
                await playerPoints.save();
                game.turnWinner = user;
                await game.save();
            }
            pubsub.publish("GUESS_UPDATE", {
                guessUpdate: {
                    gameId,
                    word,
                    currentWord: game.currentWord,
                    player: user,
                    winner,
                },
            });
            return { gameId };
        },
        modifyConcept: async (
            parent,
            { gameId, conceptId, listIndex, action },
            { user }
        ) => {
            console.log("MODIFY CONCEPT CALLED", listIndex, action, conceptId);
            const game = await Game.findById(gameId);
            let newList = [...game.conceptsLists[listIndex]];
            console.log("NEW LIST BEFORE", newList);
            let modifiedConceptsLists = [...game.conceptsLists];
            if (action === "add") {
                newList = [...newList, conceptId];
            } else {
                newList = newList.filter((el) => el === conceptId);
            }
            console.log("NEW LIST AFTER", newList);
            modifiedConceptsLists[listIndex] = newList;
            game.conceptsLists = modifiedConceptsLists;
            await game.save();
            pubsub.publish("CONCEPTS_UPDATE", {
                conceptsUpdate: {
                    gameId,
                    concepts: game.conceptsLists,
                },
            });
        },
        modifyConceptsList: async (
            parent,
            { gameId, listIndex, action },
            { user }
        ) => {
            const game = await Game.findById(gameId);
            console.log("GAME CONCEPTS LISTS IS", game.conceptsLists);
            if (action === "add") {
                game.conceptsLists = [...game.conceptsLists, []];
            } else {
                let newConceptsLists = [...game.conceptsLists];
                newConceptsLists.splice(listIndex, 1);
                game.conceptsLists = newConceptsLists;
            }
            await game.save();
            pubsub.publish("CONCEPTS_UPDATE", {
                conceptsUpdate: {
                    gameId,
                    concepts: game.conceptsLists,
                },
            });
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
        guessUpdate: {
            subscribe: withFilter(
                () => {
                    return pubsub.asyncIterator(["GUESS_UPDATE"]);
                },
                (payload, variables) => {
                    return payload.guessUpdate.gameId === variables.gameId;
                }
            ),
        },
        conceptsUpdate: {
            subscribe: withFilter(
                () => {
                    return pubsub.asyncIterator(["CONCEPTS_UPDATE"]);
                },
                (payload, variables) => {
                    console.log("CONCEPTS_UPDATE CALLED");
                    console.log(
                        "should pass",
                        payload.conceptsUpdate.gameId === variables.gameId
                    );
                    return payload.conceptsUpdate.gameId === variables.gameId;
                }
            ),
        },
    },
};

module.exports = resolvers;

const cleanWord = (word) => {
    return word
        .toLowerCase()
        .replace(/\s+/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};
