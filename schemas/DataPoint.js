var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var dataPointSchema = new Schema({
	name: {type: String, required: true},
	type: {type: String, required: true},
	context: {type: String, required: true},//"pit" or "match"
	min: {type: Number, required: false},
	max: {type: Number, required: false},
	start: {type: Number, required: false},
	options: {type: [String], required: false}
});

var DataPoint = mongoose.model('DataPoint', dataPointSchema);

module.exports = DataPoint;
