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

app.post("/submitReport", function(req, res){
	var report = req.body;//req.body contains data, team, context and match(if needed): NOT scouter info
	report.scout = req.session.user; //scout must be User object and that is what this is
	util.submitReport(report, function(didSubmit){
		res.end(util.respond(didSubmit));
	});
});

app.post("/getMatchReports", function(req, res){
	Report.find({
		context: "match",//not needed
		match: req.body.match,
		team: req.body.team
	}, util.handleError(res, function(reports){
		res.end(JSON.stringify(reports));
	}));
});

app.post("/getPitReports", function(req, res){
	Report.find({
		context: "pit",
		team: req.body.team
	}, util.handleError(res, function(reports){
		res.end(JSON.stringify(reports));
	}));
});

app.post("/setScoutForm", function(req, res){//Set and edit scout form
	var dataPoints = req.body;
	Report.count({}, function(err, count){
		if (!err && count == 0){
			util.addDataPoints(dataPoints, function(formSet){//also removes previous data points
				res.end(util.respond(formSet));
			});
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/getScoutForm", function(req, res){//get?
	DataPoint.find({}, function(err, dataPoints){//Gets match and pit forms
		if (!err) res.end(JSON.stringify(dataPoints));
		else res.end("fail");
	});
});
