var mongoose = require("mongoose");
var Schema = mongoose.Schema;

//var User = require("./User.js");

var assignmentSchema = new Schema({
	// task: {type: String, requred: true},
	assignedBy: {type: Schema.Types.ObjectId, ref: "User", required: true},
	scout: {type: Schema.Types.ObjectId, ref: "User", required: true},
	// teamCode: {type: String, required: true},
	eventCode: {type: String, required: true},
	startMatch: {type: Number, required: true},
	endMatch: {type: Number, required: true},
	alliance: {type: String, required: true},
	teamSection: {type: Number, required: true}
});

var Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;
