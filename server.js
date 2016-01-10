var mongoose = require("mongoose");
var util = require("./util.js");
var app = require("express")();
var session = require("express-session");
var fs = require("fs");

var DataPoint = require("./schemas/DataPoint.js");
var Report = require("./schemas/Report.js");
var User = require("./schemas/User.js");
var Assignment = require("./schemas/Assignment.js");

var server = null;

mongoose.connect("mongodb://localhost:27017/morscout");

module.exports = {
	start: function() {
		server = app.listen(8080);
		if(!fs.existsSync("pitImages")) {
			fs.mkdirSync("pitImages");
		}
	},
	stop: function() {
		if(server) {
			server.close();
		}
	}
};


app.post("/registerTeam", function(req, res){//add on login too
	Team.count({
		teamCode: req.body.teamCode
	}, util.handleError(res, function(count){
		if (count == 0){
			Team.create({
				teamNumber: req.body.teamNumber,
				teamName: req.body.teamName,
				teamCode: req.body.teamCode
			}, util.handleError(res, function(){
				res.end("success");
			}));
		}
		else {
			res.end("teamCode taken");
		}
	}));
});

app.post("/signup", function(req, res) {
	var firstName = util.nameCase(req.body.firstName);
	var lastName = util.nameCase(req.body.lastName);
	var teamCode = req.body.teamCode;
	var password = req.body.password;
	User.count({
		firstName: new RegExp("^" + firstName.charAt(0)),
		lastName: lastName
	}, util.handleError(res, function(countNames) {
		Team.count({
			teamCode: teamCode
		}, util.handleError(res, function(numberOfTeamsWithCode){
			if (numberOfTeamsWithCode == 1){
				User.count({
					teamCode: teamCode
				}, handleError(res, function(usersInTeam){
					var username = firstName.charAt(0).toLowerCase() + lastName.toLowerCase();
					var isAdmin = false;
					if (usersInTeam == 0) isAdmin = true;
					if(countNames > 0) username += countNames + 1;
					User.create({
						firstName: firstName,
						lastName: lastName,
						username: username,
						teamCode: teamCode,
						password: password,
						admin: isAdmin
					}, util.handleError(res, function() {
						res.end(username);
					}));
				}));
			}
			else {
				res.end("team does not exist");
			}
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
                }
                else{
                    if(isMatch){
                        req.session.user = user;
                        delete user.password;
                        Team.find({
                            teamCode: user.teamCode
                        }, handleError(res, function(teamInfo){
                            user.teamName = teamInfo.teamName;
                            user.teamNumber = teamInfo.teamNumber;
                            res.end(user);//user contains firstName, lastName, username, teamCode, teamName, teamNumber, and admin(boolean)
                        }));
                    }
                    else{
                        res.end("incorrect_password");
                    }
                }
            });
        }
        else{
            res.end("incorrect_username");
        }
    }));
});

app.post("/getRegionalsForTeam", util.requireLogin, function(req, res) {
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/team/frc" + team.teamNumber + "/" + req.body.year + "/events", function(events){
				if (events) res.end(JSON.stringify(events));
				else res.end("fail")
			});
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/chooseCurrentRegional", util.requireAdmin, function(req, res) {
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/team/frc" + team.teamNumber + "/" + req.body.year + "/events", function(events){
				if (events && events.length > 0) {
					for (var i = 0; i < events.length; i++){
						var registeredForRegional = false;
						if (req.body.eventCode == events[i].key){
							registeredForRegional = true;
							break;
						}
					}
					if (registeredForRegional){
						Team.update({
							teamCode: req.session.user.teamCode
						},{
							currentRegional: req.body.eventCode
						}, util.handleError(res, function(){
							res.end("success");
						}));
					}
					else {
						res.end("not registered for this regional");
					}
				}
				else {
					res.end("fail");
				}
			});
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/getMatchesForCurrentRegional", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/team/frc" + team.teamNumber + "/event/" + team.currentRegional + "/matches", function(matches){
				if (matches) res.end(JSON.stringify(matches));
				else res.end("fail");
			});
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/submitReport", util.requireLogin, function(req, res){ //Check all middleware
    var report = req.body; //req.body contains data, team, context, match(if needed), isPrivate, and images([Object]): NOT scouter info
    report.scout = req.session.user._id;
    if (!report.images || report.context == "match") report.images = [];
    report.scoutTeamCode = req.session.user.teamCode;
	util.getTeamInfoForUser(report.scout, function(team){
		if (team.currentRegional){
			report.event = team.currentRegional;
			util.submitReport(report, function(didSubmit){
		        res.end(util.respond(didSubmit));
		    });
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/getMatchReports", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		var allReports = {yourTeam:[], otherTeams:[]};
		if (team){
			Report.find({
		        context: "match",
		        match: req.body.match,
		        team: req.body.team,
				event: team.currentRegional,
		        scoutTeamCode: req.session.user.teamCode
		    }, util.handleError(res, function(yourReports){
		        allReports.yourTeam = reports;
				Report.find({
			        context: "match",
			        match: req.body.match,
			        team: req.body.team,
					event: team.currentRegional,
					isPrivate: false,
			        scoutTeamCode: {$ne: req.session.user.teamCode}
			    }, "data scout team match event imagePaths", util.handleError(res, function(otherReports){
			        allReports.otherTeams = otherReports;
					res.end(JSON.stringify(allReports));
			    }));
		    }));
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/getTeamReports", util.requireLogin, function(req, res){
    util.getTeamReports(req.session.user.teamCode, req.body.teamNumber, req.body.reportContext, function(allReports){
        if (allReports) {
            res.end(JSON.stringify(allReports));
        }
        else {
            res.end("fail");
        }
    });
});

/*app.post("/getPitReports", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
		    Report.find({
		        context: "pit",
		        team: req.body.team,
		        scoutTeamCode: req.session.user.teamCode
		    }, util.handleError(res, function(reports){
		        var reportDone = 0;
		        for (var i = 0; i < reports.length; i++){
		            var report = reports[i];
		            var imageBuffers = [];
		            var imagesDone = 0;
		            if (report.imagePaths.length == 0){//if it has no images
		                delete report.imagePaths;
		                report.imageBuffers = [];
		                reportDone++;
		            }
		            for (var j = 0; j < report.imagePaths; j++){//if it has images
		                var imagePath = imagePaths[j];
		                fs.readFileSync(imagePath, function(err, buffer){//check cb args
		                    imagesDone++;
		                    imageBuffers.push(buffer);
		                    if (imagesDone == imagePaths.length){
		                        delete report.imagePaths;
		                        report.imageBuffers = imageBuffers;
		                        reportDone++;
		                    }
		                });
		            }
		            if (reportDone == reports.length){
		                res.end(reports);
		            }
		        }
	    	}));
		}
		else {
			res.end("fail");
		}
});*/

app.post("/setScoutForm", util.requireAdmin, function(req, res){//Set and edit scout form
    var dataPoints = req.body;//[Object]
    Report.count({
        teamCode: req.session.user.teamCode
    }, function(err, count){
        if (!err && count == 0){
            util.addDataPoints(dataPoints, req.session.user.teamCode, function(formSet){//also removes previous data points
                res.end(util.respond(formSet));
            });
        }
        else {
            res.end("fail");
        }
    });
});

app.post("/getScoutForm", util.requireLogin, function(req, res){//get?
    DataPoint.find({
        teamCode: req.session.user.teamCode
    }, function(err, dataPoints){//Gets match and pit forms
        if (!err) res.end(JSON.stringify(dataPoints));
        else res.end("fail");
    });
});

app.post("/assignTask", util.requireAdmin, function(req, res){
    //req.body.scoutID is the _id of the user assigned the task
    Assignment.create({
        scout: req.body.scoutID,
        teamCode: req.session.user.teamCode,
        task: req.body.task,
        assignedBy: req.session.user._id
    }, util.handleError(res, function(){
        res.end("success");
    }));
});

app.post("/showTasks", util.requireLogin, function(req, res){
    if (req.body.userID == req.session.user._id || req.session.user.admin){ //So you can only view you own tasks if you aren't an admin
        Assignment.find({
            scout: req.body.userID,
            teamCode: req.session.user.teamCode//
        }, util.handleError(res, function(assignments){
            res.end(JSON.stringify(assignments));
        }));
    }
    else {
        res.end("fail");
    }
});

app.post("/getTeammatesInfo", util.requireLogin, function(req, res){
    util.getTeammatesInfo(req.session.user.teamCode, function(err, users){//will be team specific soon
        res.end(JSON.stringify(users));
    });
});

app.post("/getUserStats", util.requireLogin, function(req, res){//add for whole team at once too
    util.getUserStats(req.body.userID, function(err, stats){
        if (stats != {}){
            res.end(JSON.stringify(stats));
        }
        else {
            res.end("fail");
        }
    });
});
