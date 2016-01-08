var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var teamSchema = new Schema({
    teamNumber: {type: Number, required: true},
    teamName: {type: String, required: true},
    teamCode: {type: String, required: true},
});

var Team = mongoose.model("Team", teamSchema);

module.exports = Team;
