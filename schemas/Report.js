var mongoose = require("mongoose");
var Schema = mongoose.Schema;

//var User = require("./User.js");

var reportSchema = new Schema({
    data: {type: Object, required: true},
    scout: {type: Schema.Types.ObjectId, ref: "User", required: true},
    scoutTeamCode: {type: String, required: true},
    team: {type: Number, required: true},
    context: {type: String, required: true},
    match: {type: Number, required: false}
});


var Report = mongoose.model("Report", reportSchema);

module.exports = Report;
