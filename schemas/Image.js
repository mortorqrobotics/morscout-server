var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var imageSchema = new Schema({
	imagePath: {type: String, ref: "User", required: true},
    scoutTeamCode: {type: String, required: true},
    team: {type: String, required: true},
    year: {type: Number, required: true}
});

var Image = mongoose.model("Image", imageSchema);

module.exports = Image;
