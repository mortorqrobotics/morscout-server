var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var strategySchema = new Schema({
    eventCode: {type: String, required: true},
    teamCode: {type: String, required: true},
    matchNumber: {type: Number, required: true},
    strategy: {type: String, required: true}
});


var Strategy = mongoose.model("Strategy", strategySchema);

module.exports = Strategy;
