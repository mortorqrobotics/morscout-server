var mongoose = require("mongoose");
var util = require("./util.js");
var app = require("express")();
var session = require("express-session");

var DataPoint = require("./schemas/DataPoint.js");
var Report = require("./schemas/Report.js");
var User = require("./schemas/User.js");
var Assignment = require("./schemas/Assignment.js");

var server = null;

mongoose.connect("mongodb://localhost:27017/morscout");

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
			password: password,
			admin: false
		}, util.handleError(res, function() {
			res.end(username);
		}));
	}));
});

app.post("/login", function(req, res) {
	User.findOne({
		username: req.body.username,
	}, util.handleError(res, function(user){
		if(user){
			user.comparePassword(req.body.password, function(err, isMatch){
				if(err){
					console.error(err);
					res.end("fail");
				}else{
					if(isMatch){
						req.session.user = user;
						res.end("success");
					}else{
						res.end("incorrect_password");
					}
				}
			})
		}else{
			res.end("incorrect_username");
		}
	});
});

app.post("/submitReport", util.requireLogin, function(req, res){ //Check all middleware
	var report = req.body; //req.body contains data, team, context and match(if needed): NOT scouter info
	report.scout = req.session.user._id;
	util.submitReport(report, function(didSubmit){
		res.end(util.respond(didSubmit));
	});
});

app.post("/getMatchReports", util.requireLogin, function(req, res){
	Report.find({
		context: "match",//not needed
		match: req.body.match,
		team: req.body.team
	}, util.handleError(res, function(reports){
		res.end(JSON.stringify(reports));
	}));
});

app.post("/getPitReports", util.requireLogin, function(req, res){
	Report.find({
		context: "pit",
		team: req.body.team
	}, util.handleError(res, function(reports){
		res.end(JSON.stringify(reports));
	}));
});

app.post("/setScoutForm", util.requireAdmin, function(req, res){//Set and edit scout form
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

app.post("/getScoutForm", util.requireLogin, function(req, res){//get?
	DataPoint.find({}, function(err, dataPoints){//Gets match and pit forms
		if (!err) res.end(JSON.stringify(dataPoints));
		else res.end("fail");
	});
});

app.post("/assignTask", util.requireAdmin, function(req, res){
	//req.body.scoutID is the _id of the user assigned the task
	Assignment.create({
		scout: req.body.scoutID,
		task: req.body.task,
		assignedBy: req.session.user._id
	}, util.handleError(res, function(){
		res.end("success");
	}));
});

app.post("/showTasks", util.requireLogin, function(req, res){
	if (req.body.userID == req.session.user._id || req.session.user.admin){ //So you can only view you own tasks if you aren't an admin
		Assignment.find({
			scout: req.body.userID
		}, util.handleError(res, function(assignments){
			res.end(JSON.stringify(assignments));
		}));
	}
	else {
		res.end("fail");
	}
});

app.post("/getTeammatesInfo", util.requireLogin, function(req, res){
	util.getTeammatesInfo(function(users){//will be team specific soon
		res.end(JSON.stringify(users));
	});
});

app.post("/getUserStats", util.requireLogin, function(req, res){//add for whole team at once too
	util.getUserStats(req.body.userID, function(stats){
		if (stats != {}){
			res.end(JSON.stringify(stats));
		}
		else {
			res.end("fail");
		}
	});
});
