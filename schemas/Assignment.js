var mongoose = require("mongoose");
var Schema = mongoose.Schema;

//var User = require("./User.js");

var assignmentSchema = new Schema({
	scout: {type: Schema.Types.ObjectId, ref: "User", required: true},
	task: {type: String, required: true},
	assignedBy: {type: Schema.Types.ObjectId, ref: "User", required: true},
}));

var Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;
