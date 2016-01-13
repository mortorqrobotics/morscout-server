var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var dataPointSchema = new Schema({
	name: {type: String, required: true},//prov
	type: {type: String, required: true},//number, text, radiobutton, dropdown, checkbox, label //prov
	context: {type: String, required: true},//pit or match
	teamCode: {type: String, required: true},
	pointNumber: {type: Number, required: true},
	min: {type: Number, required: false}, //prov
	max: {type: Number, required: false}, //prov
	start: {type: Number, required: false}, //prov
	options: {type: [String], required: false} //prov
});

var DataPoint = mongoose.model("DataPoint", dataPointSchema);

module.exports = DataPoint;
