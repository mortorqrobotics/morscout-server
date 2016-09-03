module.exports = function(imports) {
    var mongoose = imports.modules.mongoose;
    var Schema = mongoose.Schema;

    var dataPointSchema = new Schema({
	    name: {type: String, required: true},//prov
	    type: {type: String, required: true},//number, text, radiobutton, dropdown, checkbox, label //prov
	    context: {type: String, required: true},//pit or match
	    team: {type: Schema.Types.ObjectId, ref: "Team", required: true},
	    pointNumber: {type: Number, required: true},
	    min: {type: Number, required: false}, //prov
	    max: {type: Number, required: false}, //prov
	    start: {type: Number, required: false}, //prov
	    options: {type: [String], required: false} //prov
    });


	var DataPoint = mongoose.model('DataPoint', dataPointSchema);
	return DataPoint;
};
