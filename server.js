var mongoose = require("mongoose");
var util = require("./util.js");
var express = require("express");
var app = express();
var session = require("express-session");
var MongoStore = require("connect-mongo/es5")(session);//es5 because some const error
var fs = require("fs");
var bodyParser = require("body-parser");

//schemas
var DataPoint = require("./schemas/DataPoint.js");
var Team = require("./schemas/Team.js");
var Report = require("./schemas/Report.js");
var User = require("./schemas/User.js");
var Assignment = require("./schemas/Assignment.js");

mongoose.connect("mongodb://localhost:27017/morscout");


app.listen(8080);

//TODO: FIX THIS MESS
if(!fs.existsSync("pitImages")) {
	fs.mkdirSync("pitImages");
}

String.prototype.contains = function(arg) {
	 return this.indexOf(arg) > -1;
};

Array.prototype.contains = function(arg) {
	return this.indexOf(arg) > -1;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  	extended: true
}));

app.use(session({
 	secret: "temporary",
  	saveUninitialized: false,
  	resave: false,
	store: new MongoStore({ mongooseConnection: mongoose.connection }),
	cookie: {maxAge: 365*24*60*60*1000}
}));


//Keep morscout-web in same directory as morscout-server
//Serves web files to browser

app.use(function(req, res, next) {
	if (req.session && req.session.user) {
    	User.findOne({
      		username: req.session.user.username
    	}, function(err, user) {
      		if (user) {
        		req.user = user;
        		delete req.user.password;
        		req.session.user = user;
      		}
      		next();
    	});
  	}
	else {
    	next();
  	}
});

app.use(function(req, res, next){
	if (req.url == "" || req.url == "/") req.url = "/index.html";
	if (req.url.contains(".html")){//allow css and js to pass
		if (!["/login.html", "/signup.html", "/createteam.html"].contains(req.url) && !req.session.user){
			res.redirect("/login.html");
		}
		else if (req.session.user && ["/login.html", "/signup.html", "/createteam.html"].contains(req.url)){
			res.redirect("/");
		}
		else {
			next();
		}
	}
	else {
		next();
	}
});

app.use(express.static(require("path").join(__dirname, "../morscout-web")));

app.post("/validateUser", util.requireLogin, function(req, res){
 	if (req.session.user._id == req.body.userID) {
		res.end("success");
 	}
 	else {
 		res.end("fail");
 	}
 });

app.post("/logout", util.requireLogin, function(req, res){
	req.session.destroy();
	res.end("success");
});

app.post("/registerTeam", function(req, res){//add on login too
	var teamNumber = parseInt(req.body.teamNumber);
	if (util.isInt(req.body.teamNumber)){
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
				res.end("Team code taken");
			}
		}));
	}
	else {
		res.end("Error");
	}
});

app.post("/signup", function(req, res) {
	var firstName = util.nameCase(req.body.firstName);//Add character restrictions!
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
				}, util.handleError(res, function(usersInTeam){
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
						res.json({username: username});//Don't send username by itself, what if your name is frank ail?
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
                        Team.findOne({
                            teamCode: user.teamCode
                        }, util.handleError(res, function(teamInfo){
							req.session.user = user;
							var userObj = {
								_id: user._id,
								username: user.username,
								firstName: user.firstName,
								lastName: user.lastName,
								admin: user.admin,//boolean
								teamCode: user.teamCode,
								teamNumber: teamInfo.teamNumber,
								teamName: teamInfo.teamName
							}
                            res.json(userObj);
                        }));
                    }
                    else{
                        res.end("inc_password");
                    }
                }
            });
        }
        else{
            res.end("inc_username");
        }
    }));
});

app.post("/getRegionalsForTeam", util.requireLogin, function(req, res) {
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/team/frc" + team.teamNumber + "/" + req.body.year + "/events", function(events){
				if (events) res.json(events);
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
				if (typeof(events) == "object" && events.length > 0) {//array
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

app.post("/getCurrentRegionalInfo", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		var currentRegionalKey = team.currentRegional;
		util.request("/event/" + currentRegionalKey, function(eventInfo){
			res.json(eventInfo);
		});
	});
});

app.post("/getMatchesForCurrentRegional", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/event/" +  team.currentRegional + "/matches", function(matches){
				if (typeof(matches) == "object") {
					res.end(JSON.stringify(matches));//array
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

app.post("/submitReport", util.requireLogin, function(req, res){ //Check all middleware
    var report = req.body; //req.body contains data(array), team, context, match(if needed), isPrivate, and images([Object]): NOT scouter info
	DataPoint.find({
        teamCode: req.session.user.teamCode,
		context: report.context
    }).sort("pointNumber").exec(function(err, dataPoints){
		var orderValid = true;
        for (var i = 0; i < report.data.length; i++){
			if (report.data[i].name != dataPoints[i].name){
				orderValid = false;
			}
		}
		if (orderValid){
			report.scout = req.session.user._id;
		    if (!report.images || report.context == "match") report.images = [];
		    report.scoutTeamCode = req.session.user.teamCode;
			util.getTeamInfoForUser(req.session.user.teamCode, function(team){
				if (team.currentRegional){
					report.event = team.currentRegional;
					report.isPrivate = false; //team.showScoutingInfo;
					util.submitReport(report, function(didSubmit){
				        res.end(util.respond(didSubmit));
				    });
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
		        allReports.yourTeam = yourReports;
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
    var allDataPoints = req.body.dataPoints;//Array
	for (var i = 0; i < allDataPoints.length; i++){
		allDataPoints[i].teamCode = req.session.user.teamCode;
		allDataPoints[i].context = req.body.context;
		allDataPoints[i].pointNumber = i;
	}
    Report.count({
        scoutTeamCode: req.session.user.teamCode,
		context: req.body.context
    }, function(err, count){
        if (!err && count == 0){
            util.addDataPoints(allDataPoints, req.session.user.teamCode, req.body.context, function(formSet){//also removes previous data points
                res.end(util.respond(formSet));
            });
        }
        else {
            res.end("fail");
        }
    });

});

app.post("/getTeamListForRegional", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/event/" + team.currentRegional + "/teams", function(teams){
				if (typeof(teams) == "object"){//arr
					res.end(JSON.stringify(teams));
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
//Consider merging ^ and v
app.post("/getRankingsForRegional", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/event/" + team.currentRegional + "/rankings", function(rankings){
				if (typeof(rankings) == "object"){//arr
					res.end(JSON.stringify(rankings));
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

app.post("/sendFeedback", function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.sendEmail("support@morscout.com", "Feedback from team " + team.teamNumber, req.body.content, function(didSend){
				res.end(util.respond(didSend));
			});
		}
		else {
			res.end("fail");
		}
	});
});

app.post("/getSortedTeamAvgs", util.requireLogin, function(req, res){
	util.getTeamInfoForUser(req.session.user.teamCode, function(team){
		if (team){
			util.request("/event/" + team.currentRegional + "/teams", function(teams){
				if (typeof(teams) == "object"){
					var sortValid = true;
					var sortBy = req.body.sortBy; //Goals, Blocks, etc.
					var teamAvgs = {};
					for (var i = 0; i < teams.length; i++) {
						if (sortValid) (function() {
							var teamNumber = teams[i].team_number;
							Report.find({
								team: teamNumber,
								scoutTeamCode: req.session.user.teamCode,
								event: team.currentRegional
							}, function(err, reports){
								var val;
								var valIndex;
								if (reports.length != 0){
									for (var k = 0; k < reports[0].data.length; k++){
										if (reports[0].data[k].name == sortBy){
											valIndex = k;
											val = parseFloat(reports[0].data[k].value);
										}
									}
								}
								if (!err && (reports.length == 0 || typeof(val) == "number")){//checks if that data point is number
									var teamTotal = 0;
									for (var j = 0; j < reports.length; j++){
										teamTotal += parseFloat(reports[j].data[valIndex].value);
									}
									if (reports.length != 0) teamAvgs[teamNumber] = teamTotal/reports.length;
									else teamAvgs[teamNumber] = 0;

									if (Object.keys(teamAvgs).length == teams.length){
										res.end(JSON.stringify(util.sortObject(teamAvgs)));
									}
								}
								else {
									sortValid = false;
								}
							});
						})();
						else {
							res.end("cannot sort by non-numerical value, and/or error");
							break;
						}
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

app.post("/getTeamPrevEventStats", util.requireLogin, function(req, res){
	util.request("/team/frc" + req.body.teamNumber + "/" + req.body.year + "/events", function(events){
		var eventStats = {};
		var eventDone = 0;
		for (var i = 0; i < events.length; i++){
			var eventKey = events[i].key;
			util.request("/event/" + eventKey + "/stats", function(stats){
				for (var stat in stats){
					eventStats[eventKey][stat] = stats[stat][req.body.teamNumber];//this creates the objects needed right?
				}
				eventDone++;
				if (eventDone == events.length){
					res.end(JSON.stringify(eventStats));//The presence of updated stats is dependant upon bluealliance
				}
			});
		}
	});
});

app.post("/clearScoutingData", util.requireAdmin, function(req, res){
	Report.remove({
		scoutTeamCode: req.session.user.teamCode,
		context: req.body.context
	}, function(err){
		res.end(util.respond(!err));
	});
});

app.post("/setDataStatus", util.requireAdmin, function(req, res){
	var isPrivate = (req.body.status == "private");
	Report.update({
		scoutTeamCode: req.session.user.teamCode
	}, {
		isPrivate: isPrivate
	}, function(err){
		res.end(util.respond(!err));
	});
});

app.post("/getTeamPrevEventAwards", util.requireLogin, function(req, res){
	util.request("/team/frc" + req.body.teamNumber + "/" + req.body.year + "/events", function(events){
		var eventAwards = {};
		var eventDone = 0;
		for (var i = 0; i < events.length; i++){
			util.request("/team/frc" + req.body.teamNumber + "/event/" + events[i].key + "/awards", function(awards){
				eventAwards[events[i].key] = awards;
				eventDone++;
				if (eventDone == events.length){
					res.end(JSON.stringify(eventAwards));
				}
			});
		}
	});
});

app.post("/getTeamPrevEventRank", util.requireLogin, function(req, res){
	util.request("/team/frc" + req.body.teamNumber + "/" + req.body.year + "/events", function(events){
		var eventRanks = {};
		var eventDone = 0;
		for (var i = 0; i < events.length; i++){
			util.request("/event/" + events[i].key + "/rankings", function(rankings){
				for (var j = 0; j < rankings.length; j++){
					if (rankings[j][1] == (req.body.teamNumber + "")){
						eventRanks[events[i].key] = rankings[j][0];
						eventDone++;
						if (eventDone == events.length){
							res.end(JSON.stringify(eventRanks))
						}
					}
				}
			});
		}
	});
});

app.post("/getScoutForm", util.requireLogin, function(req, res){//get?
    DataPoint.find({
        teamCode: req.session.user.teamCode,
		context: req.body.context
    }).sort("pointNumber").exec(function(err, dataPoints){//Gets match and pit forms
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
