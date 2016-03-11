var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var imageSchema = new Schema({
	imagePath: {type: String, required: true},
    scoutTeamCode: {type: String, required: true},
    team: {type: String, required: true},
    year: {type: Number, required: true}
});

module.exports = function(db) {
	var Image = db.model('Image', imageSchema);
	return Image;
};
