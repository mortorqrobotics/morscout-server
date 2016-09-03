module.exports = function(imports) {
    var mongoose = imports.modules.mongoose;
    var Schema = mongoose.Schema;

    var imageSchema = new Schema({
	    imagePath: {type: String, required: true},
        scoutTeam: {type: Schema.Types.ObjectId, ref: "Team", required: true},
        team: {type: String, required: true},
        year: {type: Number, required: true}
    });

	var Image = mongoose.model('Image', imageSchema);
	return Image;
};
