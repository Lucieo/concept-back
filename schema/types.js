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
        currentWord: String
        creator: ID
        players: [User]
        turn: Int
        step: String
        winner: ID
        conceptsLists: [[ID]]
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
    type gameActionResponse {
        gameId: ID
    }
    type guessUpdate {
        gameId: ID
        word: String
        player: User
        winner: Boolean
        currentWord: String
    }
    type conceptUpdate {
        gameId: ID
        concepts: [[ID]]
    }
    type Action {
        owner: ID
        card: Card
    }
    type Query {
        currentUser: User!
        getGameInfo(gameId: ID): Game!
    }
    type Mutation {
        signup(name: String!, email: String!, password: String!): User!
        login(email: String!, password: String!): LoginResponse!
        modifyUser(name: String!, icon: String!): User!
        createGame: CreatedGame
        joinGame(gameId: ID!): Game
        leaveGame(gameId: ID!): Game
        changeGameStatus(gameId: ID!, newStatus: String!): Game
        initGame(gameId: ID!, currentWord: String!): gameActionResponse
        guessAction(
            gameId: ID!
            word: String!
            action: String
        ): gameActionResponse
        nextTurn(gameId: ID!): gameActionResponse
        modifyConcept(
            gameId: ID!
            conceptId: ID
            listIndex: Int
            action: String
        ): gameActionResponse
        modifyConceptsList(
            gameId: ID!
            listIndex: Int
            action: String
        ): gameActionResponse
    }
    type Subscription {
        playerUpdate(gameId: ID!): PlayerModifyResponse
        gameUpdate(gameId: ID!): Game
        guessUpdate(gameId: ID!): guessUpdate
        conceptsUpdate(gameId: ID!): conceptUpdate
    }
`;

module.exports = typeDefs;
