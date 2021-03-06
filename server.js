module.exports = function(imports) {

    imports = require("./initImports")(imports);

    var mongoose = imports.modules.mongoose;
    var util = imports.util;
    var fs = require("fs");
    var express = imports.modules.express;

    var app = express();

    // var db = mongoose.createConnection('mongodb://localhost:27017/morscout');

    var DataPoint = imports.models.DataPoint;
    var Report = imports.models.Report;
    var Assignment = imports.models.Assignment;
    var Strategy = imports.models.Strategy;
    var Image = imports.models.Image;
    var User = imports.models.User;
    var Team = imports.models.Team;
    var Subdivision = imports.models.Subdivision;

    // what is wrong with this v
    //TODO: FIX THIS MESS
    if (!fs.existsSync("pitImages")) {
        fs.mkdirSync("pitImages");
    }

    String.prototype.contains = function(arg) {
        return this.indexOf(arg) > -1;
    };

    Array.prototype.contains = function(arg) {
        return this.indexOf(arg) > -1;
    }

    app.use(function(req, res, next) {
        if (req.url == "" || req.url == "/") req.url = "/index.html";
        if (req.url.contains(".html")) { //allow css and js to pass
            if (!req.user) {
                res.redirect("http://morteam.com/login?scout");
            } else if (!req.user.team) {
                res.redirect("http://morteam.com/void");
            } else if (["/login.html", "/signup.html", "/createteam.html"].contains(req.url)) {
                res.redirect("/");
            } else {
                next();
            }
        } else {
            next();
        }
    });

    app.use(express.static(require("path").join(__dirname, "../morscout-web")));

    app.post("/validateUser", util.requireLogin, function(req, res) {
        if (req.user._id == req.body.userID) {
            res.end("success");
        } else {
            res.sendStatus(400);
        }
    });

    require("./export.js")(app, imports);

    app.post("/logout", util.requireLogin, function(req, res) {
        req.session.destroy();
        res.end("success");
    });

    app.post("/getRegionalsForTeam", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/team/frc" + team.number + "/events/" + req.body.year, function(events) {
                    if (events) res.json(events);
                    else res.end("fail")
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getInfo", util.requireLogin, function(req, res) {
        User.findOne({
            _id: req.user._id
        }, "-password", function(err, user) {
            util.getTeamInfoForUser(req.user.team, function(team) {
                if (!err && user) {
                    res.end(JSON.stringify({
                        user: user,
                        team: team
                    }));
                } else {
                    res.sendStatus(400);
                }
            });
        });
    });

    app.post("/chooseCurrentRegional", util.requireAdmin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) { //FIX
            if (team && typeof(req.body.eventCode) == "string") {
                var year = req.body.eventCode.substring(0, 4);
                util.request("/team/frc" + team.number + "/events/" + year, function(events) {
                    if (events && typeof(events) == "object" && events.length > 0) { //array
                        for (var i = 0; i < events.length; i++) {
                            var registeredForRegional = false;
                            if (req.body.eventCode == events[i].key) {
                                registeredForRegional = true;
                                break;
                            }
                        }
                        if (registeredForRegional) {
                            Team.update({
                                _id: req.user.team
                            }, {
                                currentRegional: req.body.eventCode
                            }, util.handleError(res, function() {
                                res.end("success");
                            }));
                        } else {
                            res.end("not registered for this regional");
                        }
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getCurrentRegionalInfo", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                var currentRegionalKey = team.currentRegional;
                util.request("/event/" + currentRegionalKey, function(eventInfo) {
                    res.json(eventInfo);
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getMatchesForCurrentRegional", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/event/" + team.currentRegional + "/matches", function(matches) {
                    if (matches !== null && typeof(matches) == "object") {
                        var done = 0;
                        for (var index = 0; index < matches.length; index++)(function() {
                            var i = index;
                            var matchNumber = matches[i].match_number;
                            Report.find({
                                scoutTeam: req.user.team,
                                match: matchNumber,
                                event: team.currentRegional
                            }, function(err, reports) {
                                var teamsReported = [];
                                reports.forEach(function(report) {
                                    var team = report.team;
                                    if (teamsReported.indexOf(team) < 0) teamsReported.push(team);
                                });
                                done++;
                                matches[i].progress = teamsReported.length;
                                if (done == matches.length) {
                                    var matchesFiltered = matches.filter(function(match) {
                                        if (match.comp_level == "qm") {
                                            return true;
                                        }
                                        return false;
                                    });
                                    res.end(JSON.stringify(matchesFiltered)); //array
                                }
                            });
                        })();
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getProgressForPit", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/event/" + team.currentRegional + "/teams", function(teams) {
                    if (Array.isArray(teams)) {
                        var isValid = true;
                        var numTeams = teams.length;
                        var progress = {};
                        var year = team.currentRegional.substring(0, 4);
                        query = new RegExp("^" + year + "[a-zA-Z]+\\d*$", "i");
                        for (var index = 0; index < teams.length; index++)(function() {
                            var i = index;
                            var teamNum = parseInt(teams[i].team_number);
                            Report.find({
                                scoutTeam: req.user.team,
                                team: teamNum,
                                event: query,
                                context: "pit"
                            }, function(err, reports) {
                                if (!err) {
                                    var num = reports.length;
                                    progress[teamNum] = num;
                                    if (Object.keys(progress).length == numTeams) {
                                        res.end(JSON.stringify(progress));
                                    }
                                } else if (isValid) {
                                    res.sendStatus(400);
                                    isValid = false;
                                }
                            });
                        })();
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getBAImageLinks", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                var year = team.currentRegional.substring(0, 4);
                var teamNumber = req.body.teamNumber;
                var links = [];
                util.request("/team/frc" + teamNumber + "/media/" + year, function(sources) {
                    for (var i = 0; i < sources.length; i++) {
                        if (sources[i].type == "imgur") {
                            links.push("http://i.imgur.com/" + sources[i].foreign_key + ".png");
                        } else if (sources[i].type == "cdphotothread") {
                            links.push("http://www.chiefdelphi.com/media/img/" + sources[i].details.image_partial);
                        }
                    }
                    res.end(JSON.stringify(links));
                });
            } else {
                res.end("[]");
            }
        });

    });

    app.post("/getProgressForMatches", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                var matchesLength = parseInt(req.body.matchesLength);
                var done = 0;
                var progress = {};
                if (util.isNum(matchesLength)){
                     for (var index = 1; index <= matchesLength; index++)(function() {
                        var i = index;
                        var matchNumber = index;
                        Report.find({
                            scoutTeam: req.user.team,
                            match: matchNumber,
                            event: team.currentRegional
                        }, function(err, reports) {
                            var teamsReported = [];
                            reports.forEach(function(report) {
                                var team = report.team;
                                if (teamsReported.indexOf(team) < 0) teamsReported.push(team);
                            });
                            done++;
                            progress[i] = teamsReported.length;
                            if (done == matchesLength) {
                                res.end(JSON.stringify(progress));
                            }
                        });
                    })();
                }
                else {
                    res.sendStatus(400);
                }
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/deleteReport", util.requireAdmin, function(req, res) {
        Report.remove({
            _id: req.body.id
        }, function(err) {
            res.end(err ? 403 : 200);
        });
    });
    app.use(require('body-parser').json());
    app.post("/submitReport", util.requireLogin, function(req, res) { //Check all middleware
        console.log(req.body);

        var report = JSON.parse(JSON.stringify(req.body)); //req.body contains data(array), team, context, match(if needed), isPrivate, and images([Object]): NOT scouter info
        if (typeof(report.data) == "string") {
            report.data = JSON.parse(report.data);
        }
        DataPoint.find({
            team: req.user.team,
            context: report.context
        }).sort("pointNumber").exec(function(err, dataPoints) {
            var orderValid = true;
            if (report.data) {
                for (var i = 0; i < report.data.length; i++) {
                    if (!(report.data[i].name && dataPoints[i].name) || (report.data[i].name != dataPoints[i].name)) {
                        orderValid = false;
                    }
                }
            } else {
                orderValid = false;
            }
            if (orderValid) {
                report.scout = req.user._id;
                //if (!report.images || report.context == "match") report.images = [];
                report.scoutTeam = req.user.team;
                util.getTeamInfoForUser(req.user.team, function(team) {
                    if (team.currentRegional && (req.body.regional == team.currentRegional)) {
                        report.event = team.currentRegional;
                        //report.isPrivate = false; //team.showScoutingInfo;
                        // Report.find({
                        //     scoutTeam: req.user.team
                        // }, function(err, reports) {
                        //     if (err) {
                        //         res.sendStatus(400);
                        //     } else {
                        //         if (reports.length == 0) {
                        //             report.isPrivate = false;
                        //         }
                        //         else {
                        //             report.isPrivate = (reports[0].isPrivate.toString() == "true");
                        //         }
                        for (var i = 0; i < report.data.length; i++) {
                            if (typeof(report.data[i].value) == "string") report.data[i].value = util.sec(report.data[i].value);
                        }
                        util.submitReport(report, function(didSubmit) {
                            res.sendStatus(didSubmit ? 200 : 400);//proper HTTP eroor code (will return 400 if not submitted)
                        });
                        //     }
                        // });
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });

    });

    app.post("/getMatchInfo", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            var currentRegional = team.currentRegional;
            util.request("/match/" + currentRegional + "_qm" + req.body.match, function(matchInfo) {
                if (matchInfo) res.end(JSON.stringify(matchInfo));
                else res.sendStatus(400);
            });
        });
    });

    app.post("/setSC", util.requireAdmin, function(req, res) {
        var isSC = (req.body.isSC == "true");
        User.update({
            _id: req.body.userID
        }, {
            scoutCaptain: isSC
        }, function(err) {
            res.sendStatus(err ? 500 : 200);
        });
    });

    app.post("/getSC", util.requireLogin, function(req, res) {
        User.findOne({
            _id: req.body.userID
        }, function(err, user) {
            if (user && !err) {
                if (user.scoutCaptain) res.end("true");
                else res.end("false");
            } else {
                res.sendStatus(400);
            }

        });
    });

    app.post("/getAllReports", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                Report.find({
                    scoutTeam: req.user.team,
                    event: team.currentRegional
                }, "_id data scout team match event context").populate("scout", "firstname lastname").exec(function(err, reports) {
                    if (!err) {
                        res.end(JSON.stringify(reports));
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });


    app.post("/getMatchReports", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            var allReports = {
                yourTeam: [],
                otherTeams: []
            };
            if (team) {
                util.getPublicTeams(req.user.team, function(teams) {
                    Report.find({
                        context: "match",
                        match: req.body.match,
                        team: req.body.team,
                        event: team.currentRegional,
                        scoutTeam: req.user.team
                    }, "_id data scout team match event").populate("scout", "firstname lastname").exec(util.handleError(res, function(yourReports) {
                        allReports.yourTeam = yourReports;
                        Report.find({
                            context: "match",
                            match: req.body.match,
                            team: req.body.team,
                            event: team.currentRegional,
                            //isPrivate: false,
                            scoutTeam: {
                                $in: teams
                            }
                        }, "data scout team match event", util.handleError(res, function(otherReports) {
                            allReports.otherTeams = otherReports;
                            res.end(JSON.stringify(allReports));
                        }));
                    }));
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getTeamReports", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            var regional = team.currentRegional;
            var query = regional;
            if (req.body.reportContext == "pit") {
                var year = regional.substring(0, 4);
                query = new RegExp("^" + year + "[a-zA-Z]+\\d*$", "i");
            }
            util.getTeamReports(req.user.team, req.body.teamNumber, req.body.reportContext, query, function(allReports) {
                if (allReports) {
                    var otherReports = allReports.otherTeams;
                    var numDone = 0;
                    if (otherReports.length > 0){
                        for (var index = 0; index < otherReports.length; index++)(function(){
                            var i = index;
                             util.getTeamInfoForUser(otherReports[i].scoutTeam, function(team){
                                 otherReports[i].scoutTeam = team.number;//not technically scoutTeam, but i needed to get rid of the real one
                                 numDone++;
                                 if (numDone == otherReports.length){
                                     allReports.otherTeams = otherReports;
                                     res.end(JSON.stringify(allReports));
                                 }
                             });
                         })();
                     }
                     else {
                         res.end(JSON.stringify(allReports));
                     }
                } else {
                    res.sendStatus(400);
                }
            });
        });
    });

    /*app.post("/getPitReports", util.requireLogin, function(req, res){
    	util.getTeamInfoForUser(req.user.team, function(team){
    		if (team){
    		    Report.find({
    		        context: "pit",
    		        team: req.body.team,
    		        scoutTeam: req.user.team
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
    			res.sendStatus(400);
    		}
    });*/

    app.post("/setScoutForm", util.requireAdmin, function(req, res) { //Set and edit scout form
        var allDataPoints = req.body.dataPoints; //Array
        for (var i = 0; i < allDataPoints.length; i++) {
            allDataPoints[i].team = req.user.team;
            allDataPoints[i].context = req.body.context;
            allDataPoints[i].pointNumber = i;
        }
        // Report.count({
        //     scoutTeam: req.user.team,
        //     context: req.body.context
        // }, function(err, count) {
        //     if (!err) {
        util.addDataPoints(allDataPoints, req.user.team, req.body.context, function(formSet) { //also removes previous data points
            res.sendStatus(formSet ? 200 : 500);
        });
        // } else {
        //     res.sendStatus(400);
        // }
        // });
    });

    app.post("/getTeamListForRegional", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/event/" + team.currentRegional + "/teams", function(teams) {
                    if (Array.isArray(teams)) { //arr
                        res.end(JSON.stringify(teams));
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });
    //Consider merging ^ and v
    app.post("/getRankingsForRegional", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/event/" + team.currentRegional + "/rankings", function(rankings) {
                    if (typeof(rankings) == "object") { //arr
                        res.end(JSON.stringify(rankings));
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/sendFeedback", function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.sendEmail("support@morscout.com", "Feedback from team " + team.number, req.body.content, function(didSend) {
                    res.sendStatus(didSend ? 200 : 500);
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getSortedTeamAvgs", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/event/" + team.currentRegional + "/teams", function(teams) {
                    if (Array.isArray(teams)) {
                        var sortBy = req.body.sortBy; //Goals, Blocks, etc.
                        var teamAvgs = {};
                        for (var i = 0; i < teams.length; i++)(function() {
                            var teamNumber = teams[i].team_number;
                            Report.find({
                                team: teamNumber,
                                scoutTeam: req.user.team,
                                event: team.currentRegional
                            }, function(err, reports) {
                                var values = [];
                                if (reports.length != 0) {
                                    for (var l = 0; l < reports.length; l++) {
                                        for (var k = 0; k < reports[l].data.length; k++) {
                                            if (reports[l].data[k].name == sortBy) {
                                                var val = parseFloat(reports[l].data[k].value);
                                                var isNum = util.isNum(val);
                                                if (isNum) values.push(val);
                                            }
                                        }
                                    }
                                }
                                if (values.length == 0 || reports.length == 0) values.push(0);
                                var teamAvg = util.average(values);
                                teamAvgs[teamNumber] = teamAvg;
                                if (Object.keys(teamAvgs).length == teams.length) {
                                    res.end(JSON.stringify(util.sortObject(teamAvgs)));
                                }
                            });
                        })();
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getTeamPrevEventStats", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            util.request("/team/frc" + req.body.teamNumber + "/events/" + team.currentRegional.substring(0, 4), function(allEvents) {
                var eventStats = {};
                var events = [];
                if (allEvents) events = allEvents;
                for (var i = 0; i < events.length; i++)(function() {
                    var eventKey = events[i].key;
                    var eventObj = {};
                    util.request("/event/" + eventKey + "/oprs", function(stats, err) {
                        var statDone = 0;
                        if (stats === null) {
                            eventStats[eventKey] = {};
                        } else {
                            for (var stat in stats) {
                                statDone++;
                                eventObj[stat] = stats[stat][req.body.teamNumber];
                                if (statDone == Object.keys(stats).length) {
                                    eventStats[eventKey] = eventObj;
                                    if (Object.keys(eventStats).length == allEvents.length) {
                                        res.end(JSON.stringify(eventStats)); //The presence of updated stats is dependant upon bluealliance
                                    }
                                }
                            }
                        }
                    });
                })();
                if (events.length == 0) {
                    res.sendStatus(400);
                }
            });
        });
    });

    app.post("/getOPRSort", util.requireLogin, function(req, res){
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team){
                util.request("/event/" + team.currentRegional + "/oprs", function(stats, err) {
                    var oprs = stats.oprs;
                    if (!err) res.end(JSON.stringify(util.sortObject(oprs)));
                    else res.sendStatus(400);
                });
            }
            else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/clearScoutingData", util.requireAdmin, function(req, res) {
        Report.remove({
            scoutTeam: req.user.team,
            context: req.body.context
        }, function(err) {
            res.sendStatus(err ? 500 : 200);
        });
    });

    app.post("/setDataStatus", util.requireAdmin, function(req, res) {
        var isPrivate = (req.body.status == "private");
        Team.update({
            _id: req.user.team
        }, {
            isPrivate: isPrivate
        }, function(err) {
            res.end(err ? 500 : 200);
        });
    });

    app.post("/getDataStatus", util.requireAdmin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                res.end(team.isPrivate.toString());
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getTeamPrevEventAwards", util.requireLogin, function(req, res) {
        util.request("/team/frc" + req.body.teamNumber + "/events/" + req.body.year, function(events) {
            var eventAwards = {};
            var eventDone = 0;
            for (var i = 0; i < events.length; i++) {
                util.request("/team/frc" + req.body.teamNumber + "/event/" + events[i].key + "/awards", function(awards) {
                    eventAwards[events[i].key] = awards;
                    eventDone++;
                    if (eventDone == events.length) {
                        res.end(JSON.stringify(eventAwards));
                    }
                });
            }
        });
    });

    app.post("/getTeamPrevEventRank", util.requireLogin, function(req, res) {
        util.request("/team/frc" + req.body.teamNumber + "/events/" + req.body.year, function(events) {
            var eventRanks = {};
            var eventDone = 0;
            for (var i = 0; i < events.length; i++) {
                util.request("/event/" + events[i].key + "/rankings", function(rankings) {
                    for (var j = 0; j < rankings.length; j++) {
                        if (rankings[j][1] == (req.body.teamNumber + "")) {
                            eventRanks[events[i].key] = rankings[j][0];
                            eventDone++;
                            if (eventDone == events.length) {
                                res.end(JSON.stringify(eventRanks))
                            }
                        }
                    }
                    if (rankings.length == 0) {
                        res.sendStatus(400);
                    }
                });
            }
        });
    });

    app.post("/getScoutForm", util.requireLogin, function(req, res) { //get?
        DataPoint.find({
            team: req.user.team,
            context: req.body.context
        }).sort("pointNumber").exec(function(err, dataPoints) { //Gets match and pit forms
            if (!err && dataPoints.length != 0) {
                res.end(JSON.stringify(dataPoints));
            } else if (!err) {
                fs.readFile(require("path").join(__dirname, "defaultForms/2016.json"), function(err, forms) {
                    var allDataPoints = JSON.parse(forms.toString())[req.body.context];
                    for (var i = 0; i < allDataPoints.length; i++) {
                        allDataPoints[i].team = req.user.team;
                        allDataPoints[i].context = req.body.context;
                        allDataPoints[i].pointNumber = i;
                    }
                    util.addDataPoints(allDataPoints, req.user.team, req.body.context, function(formSet) {
                        if (formSet) res.end(JSON.stringify(JSON.parse(forms.toString())[req.body.context]));
                        else res.sendStatus(400);
                    });
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/removeTask", util.requireAdmin, function(req, res) {
        Assignment.remove({
            _id: req.body.id
        }, function(err) {
            res.sendStatus(err ? 500 : 200);
        });
    });

    app.post("/assignTask", util.requireAdmin, function(req, res) {
        //req.body.scoutID is the _id of the user assigned the task
        util.getTeamInfoForUser(req.user.team, function(team) {
            var teamSection = parseInt(req.body.teamSection);
            if (team && parseInt(req.body.startMatch) > 0 && parseInt(req.body.endMatch) > 0 && parseInt(req.body.startMatch) <= parseInt(req.body.endMatch) && teamSection >= 1 && teamSection <= 3 && (req.body.alliance == "blue" || req.body.alliance == "red")) {
                Assignment.find({
                    scout: req.body.scoutID,
                    eventCode: team.currentRegional
                }, "startMatch endMatch", function(err, assignments) {
                    var allMatchesAssigned = [];
                    var isValid = true;
                    for (var i = 0; i < assignments.length; i++) {
                        var startMatch = assignments[i].startMatch;
                        var endMatch = assignments[i].endMatch;
                        var newStart = parseInt(req.body.startMatch);
                        var newEnd = parseInt(req.body.endMatch);
                        if (!((newStart < startMatch && newEnd < startMatch) || (newStart > endMatch && newEnd > endMatch))) { //checks overlap
                            isValid = false;
                            break;
                        }
                    }
                    if (isValid) {
                        Assignment.create({
                            scout: req.body.scoutID,
                            startMatch: parseInt(req.body.startMatch),
                            endMatch: parseInt(req.body.endMatch),
                            alliance: req.body.alliance,
                            teamSection: teamSection,
                            eventCode: team.currentRegional,
                            assignedBy: req.user._id
                        }, function(err) {
                            res.sendStatus(err ? 500 : 200);
                        });
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/showTasks", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                Report.find({
                    scout: req.body.scoutID,
                    event: team.currentRegional,
                    context: "match",
                }, "match team -_id", function(err, reports) {
                    if (!err) {
                        util.request("/event/" + team.currentRegional + "/matches", function(matches) {
                            Assignment.find({
                                scout: req.body.scoutID,
                                eventCode: team.currentRegional
                            }, function(err, assignments) {
                                var allMatchesAssigned = [];
                                for (var i = 0; i < assignments.length; i++) {
                                    var startMatch = assignments[i].startMatch;
                                    var endMatch = assignments[i].endMatch;
                                    for (var j = startMatch; j <= endMatch; j++) {
                                        var teamSection = assignments[i].teamSection;
                                        if (assignments[i].alliance == "blue") {
                                            teamSection += 3;
                                        }
                                        var obj = {
                                            matchNumber: j,
                                            teamSection: teamSection
                                        };
                                        allMatchesAssigned.push(obj);
                                    }
                                }
                                var allMatchesAssignedObj = [];
                                for (var i = 0; i < allMatchesAssigned.length; i++) {
                                    var match = {};
                                    if (matches !== null && typeof(matches) == "object") {
                                        for (var j = 0; j < matches.length; j++) {
                                            if (matches[j].match_number == allMatchesAssigned[i].matchNumber && matches[j].comp_level == "qm") {
                                                var ba = matches[j].alliances.blue.teams;
                                                var ra = matches[j].alliances.red.teams;
                                                match.team = ra.concat(ba)[allMatchesAssigned[i].teamSection - 1];
                                                match.matchNumber = allMatchesAssigned[i].matchNumber;
                                            }
                                        }
                                    } else {
                                        break;
                                    }
                                    allMatchesAssignedObj.push(match);
                                }
                                var matchesNotDone = [];
                                var matchesDone = [];
                                for (var i = 0; i < allMatchesAssignedObj.length; i++) {
                                    var assignmentDone = false;
                                    for (var j = 0; j < reports.length; j++) {
                                        if (allMatchesAssignedObj[i].matchNumber == reports[j].match && parseInt(allMatchesAssignedObj[i].team.substring(3)) == reports[j].team) {
                                            assignmentDone = true;
                                            break;
                                        }
                                    }
                                    if (!assignmentDone) {
                                        matchesNotDone.push(allMatchesAssignedObj[i].matchNumber);
                                    } else {
                                        matchesDone.push(allMatchesAssignedObj[i].matchNumber);
                                    }
                                }
                                var data = {};
                                data.matchesNotDone = matchesNotDone.sort(function(a, b) {
                                    return a - b;
                                });
                                data.assignments = assignments;
                                data.matchesDone = matchesDone.sort(function(a, b) {
                                    return a - b;
                                });;
                                res.end(JSON.stringify(data))
                            });
                        });
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getTeammatesInfo", util.requireLogin, function(req, res) {
        util.getTeammatesInfo(req.user.team, function(err, users) { //will be team specific soon
            res.end(JSON.stringify(users));
        });
    });

    app.post("/getTeamInfo", util.requireLogin, function(req, res) {
        util.request("/team/frc" + req.body.teamNumber, function(team, err) {
            if (!err) {
                res.end(JSON.stringify(team));
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/setMatchStrategy", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            Strategy.remove({
                eventCode: team.currentRegional,
                team: req.user.team,
                matchNumber: parseInt(req.body.match)
            }, function(err) {
                if (!err) {
                    Strategy.create({
                        eventCode: team.currentRegional,
                        team: req.user.team,
                        matchNumber: parseInt(req.body.match),
                        strategy: util.sec(req.body.strategy)
                    }, function(err) {
                        res.sendStatus(err ? 500 : 200);
                    });
                } else {
                    res.sendStatus(400);
                }
            });
        });
    });

    app.post("/getMatchStrategy", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            Strategy.findOne({
                eventCode: team.currentRegional,
                team: req.user.team,
                matchNumber: parseInt(req.body.match)
            }, function(err, strategy) {
                if (!err) res.end(JSON.stringify(strategy));
                else res.sendStatus(400);
            });
        });
    });

    app.post("/getAllMatchStrategies", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            Strategy.find({
                eventCode: team.currentRegional,
                team: req.user.team
            }, function(err, strategies) {
                if (!err) res.end(JSON.stringify(strategies));
                else res.sendStatus(400);
            });
        });
    });

    app.post("/addImage", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                var imagePath = util.randomStr(32) + image.name.split(".")[image.name.split(".").length - 1];
                var imageBuffer = image.buffer;
                Image.create({
                    imagePath: imagePath,
                    year: parseInt(team.currentRegional.substring(0, 4)),
                    scoutTeam: req.user.team,
                    team: parseInt(req.body.team)
                }, function(err) {
                    if (!err) {
                        fs.writeFile("pitImages/" + imagePath, imageBuffer, function(err) {
                            if (!err) {
                                res.end("success");
                            } else {
                                res.sendStatus(400);
                            }
                        })
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getImages", util.requireLogin, function(req, res) {
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                var imageBuffers = [];
                Image.find({
                    year: parseInt(team.currentRegional.substring(0, 4)),
                    scoutTeam: req.user.team,
                    team: parseInt(req.body.team)
                }, function(err, images) {
                    var done = 0;
                    for (var i = 0; i < images.length; i++) {
                        var imagePath = images[i].imagePath;
                        fs.readFile(imagePath, function(err, imageBuffer) {
                            imageBuffers.push(imageBuffer);
                            done++;
                            if (done == images.length) {
                                res.end(JSON.stringify(imageBuffers));
                            }
                        });
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getPastRegionalResults", function(req, res) { //try to fix speed
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.request("/team/frc" + req.body.teamNumber + "/events/" + team.currentRegional.substring(0, 4), function(events, err) {
                    if (!err) {
                        var done = 0;
                        var allAwards = {};
                        for (var k = 0; k < events.length; k++)(function() {
                            var event = events[k].key;
                            util.request("/team/frc" + req.body.teamNumber + "/event/" + event + "/awards", function(awards) {
                                var eventAwards = [];
                                if (awards) {
                                    for (var i = 0; i < awards.length; i++) {
                                        eventAwards.push(awards[i].name);
                                    }
                                    allAwards[event] = eventAwards;
                                }
                                done++;
                                if (done == events.length) {
                                    res.end(JSON.stringify(allAwards))
                                }
                            });
                        })();
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        });
    });

    app.post("/getUserStats", util.requireLogin, function(req, res) { //add for whole team at once too
        util.getTeamInfoForUser(req.user.team, function(team) {
            if (team) {
                util.getUserStats(req.body.userID, team.currentRegional, function(err, stats) {
                    if (stats != {}) {
                        res.end(JSON.stringify(stats));
                    } else {
                        res.sendStatus(400);
                    }
                });
            } else {
                res.sendStatus(400);
            }
        })
    });

    app.use('/testConnection', function(req, res){
        res.sendStatus(200);
    });

    app.use(function(req,res){
        res.sendStatus(404);//Send 404 if not found
    });

    return app;

}
