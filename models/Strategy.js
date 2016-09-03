module.exports = function(imports) {
    var mongoose = imports.modules.mongoose;
    var Schema = mongoose.Schema;

    var strategySchema = new Schema({
        eventCode: {type: String, required: true},
        team: {type: Schema.Types.ObjectId, ref: "Team", required: true},
        matchNumber: {type: Number, required: true},
        strategy: {type: String, required: true}
    });

	var Strategy = mongoose.model('Strategy', strategySchema);
	return Strategy;
};
