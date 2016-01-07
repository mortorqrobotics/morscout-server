var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var userSchema = new Schema({
	firstName: {type: String, required: true},
	lastName: {type: String, required: true},
	username: {type: String, required: true},
	password: {type: String, required: true},//encrypted
	admin: {type: Boolean, required: true}
}));

var User = mongoose.model("User", userSchema);

module.exports = User;