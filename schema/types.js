const { gql } = require("apollo-server-express");

const typeDefs = gql`
    type User {
        id: ID
        name: String
        email: String
        icon: String
        totalPoints: Int
        totalGames: Int
    }
    type LoginResponse {
        token: String
        user: User
    }
    type Deck {
        gameId: ID
        owner: User
        cards: [Card]
    }
    type Card {
        id: ID
        fileName: String
    }
    type PointDetail {
        player: ID
        points: Int
    }
    type Game {
        id: ID
        status: String
        creator: ID
        players: [User]
        turn: Int
        turnDeck: [Action]
        turnVotes: [Action]
        currentWord: String
        turnPoints: [PointDetail]
        gamePoints: [PointDetail]
        step: String
    }
    type CreatedGame {
        id: ID
    }
    type PlayerModifyResponse {
        players: [User]
        gameId: ID
        creator: ID
    }
    type submitCardResponse {
        status: String
        gameId: ID
        actionType: String
    }
    type gameStepResponse {
        status: String
        gameId: ID
        stepType: String
    }
    type GameAction {
        gameId: ID
        actionType: String
        action: Action
    }
    type Action {
        owner: ID
        card: Card
    }
    type Query {
        currentUser: User!
        getGameInfo(gameId: ID): Game!
        getDeck(gameId: ID): Deck!
    }
    type Mutation {
        signup(name: String!, email: String!, password: String!): User!
        login(email: String!, password: String!): LoginResponse!
        modifyUser(name: String!, icon: String!): User!
        createGame: CreatedGame
        joinGame(gameId: ID!): Game
        leaveGame(gameId: ID!): Game
        changeGameStatus(gameId: ID!, newStatus: String!): Game
        initGame(
            gameId: ID!
            currentWord: String!
            cardId: ID!
        ): gameStepResponse
        selectCard(
            gameId: ID!
            cardId: ID!
            actionType: String!
        ): gameStepResponse
        launchGameStep(gameId: ID!, step: String!, turnMaster: ID!): Game
    }
    type Subscription {
        playerUpdate(gameId: ID!): PlayerModifyResponse
        gameUpdate(gameId: ID!): Game
        gameAction(gameId: ID!): GameAction
    }
`;

module.exports = typeDefs;
