const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cardSchema = new Schema({
    fileName:{
        type:String,
        unique : true
    }
})


module.exports = mongoose.model('Card', cardSchema)
