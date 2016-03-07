var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var strategySchema = new Schema({
    eventCode: {type: String, required: true},
    teamCode: {type: String, required: true},
    matchNumber: {type: Number, required: true},
    strategy: {type: String, required: true}
});


module.exports = function(db) {
	var Strategy = db.model('Strategy', StrategySchema);
	return Strategy;
};
