var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var User = require("./schemas/User.js");

var reportSchema = new Schema({
    data: {type: Object, required: true},
    scout: {type: User, required: true},
    team: {type: Number, required: true},
    context: {type: String, required: true},
    match: {type: Number, required: false}
});


var Report = mongoose.model('Report', reportSchema);

module.exports = Report;
