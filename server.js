var mongoose = require("mongoose");
var util = require("./util.js");
var app = require("express")();
var session = require("express-session");

var User = require("./schemas/User.js");


var server = null;

module.exports = {
	start: function() {
		server = app.listen(80);
	},
	stop: function() {
		if(server) {
			server.close();
		}
	}
};

app.post("/signup", function(req, res) {
	var firstName = util.nameCase(req.body.firstName);
	var lastName = util.nameCase(req.body.lastName);
	var password = req.body.password;
	var encryptedPassword = util.hash(password);//todo
	User.count({
		firstName: new RegExp("^" + firstName.charAt(0)),
		lastName: lastName
	}, util.handleError(res, function(count) {
		var username = firstName.charAt(0).toLowerCase() + lastName.toLowerCase();
		if(count > 0) username += count + 1;
		User.create({
			firstName: firstName,
			lastName: lastName,
			username: username,
			password: encryptedPassword,
			admin: false
		}, util.handleError(res, function() {
			res.end(username);
		}));
	}));
});

app.post("/login", function(req, res) {
	User.findOne({
		username: req.body.username,
		password: util.hash(req.body.password)
	}, util.handleError(res, function(user){
		req.session.user = user;
		res.end("success");
	});
});
