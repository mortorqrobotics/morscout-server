var mongoose = require("mongoose");
var session = require("express-session"); //needed?
var fs = require("fs");
var http = require("http");

var Team = require("./schemas/Team.js");
var DataPoint = require("./schemas/DataPoint.js");
var Report = require("./schemas/Report.js");
var User = require("./schemas/User.js");
var Assignment = require("./schemas/Assignment.js");


/* usage:

asyncFunc(args, function(err, result) {
	if(err) res.end("fail");
	else {
		use(result);
	}
});

replaced by

asyncFunc(args, util.handleError(res, function(result) {
	use(result);
}));

*/

exports.handleError = function(res, cb) {
    return function(err) {
        if (err) {
            res.end("fail");
        } else {
            var args = Array.prototype.slice.call(arguments, 1, arguments.length);
            cb.apply(null, args);
        }
    };
}

exports.validateSession = function(user, token, cb) {
    User.findOne({
        username: user
    }, function(err, person) {
        //TODO: later
    });
};

exports.clearDataPoints = function(teamCode, cb) {
    DataPoint.remove({
        teamCode: teamCode
    }, function() {
        cb();
    });
}


//Middleware (Do these work?)
exports.requireAdmin = function(req, res, next) {
    if (req.session.user.admin) next();
    else res.end("fail");
}

exports.requireLogin = function(req, res, next) {
        if (req.session.user) next();
        else res.end("fail");
    }
    //^^^^^


//Useful functions that have NOT been tested
exports.addDataPoints = function(dataPoints, teamCode, cb) {
    var done = 0;
    var allPointsValid = true;
    clearDataPoints(teamCode, function() { //clear current data points
        for (var i = 0; i < dataPoints.length; i++) {
            if (allPointsValid){
                var dataPoint = dataPoints[i];
                dataPoint.teamCode = teamCode;
                var type = dataPoint.type;
                var allNames = [];
                if ((!~["checkbox", "radiobuttons", "dropdown", "text", "number"].indexOf(type)) ||
                    (~["radiobuttons", "dropdown"].indexOf(type) && !dataPoint.options) ||
                    (!~["radiobuttons", "dropdown"].indexOf(type) && dataPoint.options) ||
                    (type == "number" && !(typeof(dataPoint.min) == "number" && typeof(dataPoint.start) == "number")) ||
                    (type != "number" && (typeof(dataPoint.min) == "number" || typeof(dataPoint.max) == "number" || typeof(dataPoint.start) == "number")) ||
                    (dataPoint.context != "match" && dataPoint.context != "pit") ||
                    (~allNames.indexOf(dataPoint.name))) { //This was a switch-case but ben did not want that //Names must be unique
                        clearDataPoints(teamCode, function() { //if one data point is corrupt the form is rejected and all points are cleared
                            allPointsValid = false;
                        });
                } else {
                    allNames.push(dataPoint.name);
                    DataPoint.create(dataPoint, function(err) {
                        if (!err) {
                            done++;
                            if (done == dataPoints.length) {
                                cb(true);
                            }
                        } else {
                            clearDataPoints(teamCode, function() { //if one data point is corrupt the form is rejected and all points are cleared
                                allPointsValid = false;
                            });
                        }
                    });
                }
            }
            else {
                cb(false);
                break;
            }
        }
    });
}

exports.request = function request(path, cb) {//I will make this function better using express later
    http.request({
        host : "www.thebluealliance.com",
        path : "/api/v2" + path,
        headers : {"X-TBA-App-Id" : "frc1515:MorScout:2.0"}
    }, function(res) {
        var data = "";
        res.on("data", function(chunk) {
            data += chunk;
        });
        res.on("end", function() {
            cb(JSON.parse(data));
        });
    }).end();
}

exports.randomStr = function(length) {
    var token = "";
    for (var i = 0; i < length; i++) {
        var rand = Math.floor(Math.random() * 62);
        token += String.fromCharCode(rand + ((rand < 26) ? 97 : ((rand < 52) ? 39 : -4)));
    }
    return token;
}


exports.submitReport = function(report, cb) {
    var images = report.images;
	var imagePaths = [];
    delete report.images;//so you dont pass all that data to validateReport
    validateReport(report, function(isValid) {
        if (isValid) {
			var done = 0;
            for (var i = 0; i < images.length; i++) {
                var image = images[i];
                var imageExt = image.name.split(".")[image.name.split(".").length - 1];
				var imageBuffer = image.buffer;
                var newImageName = randomStr(32) + "." + imageExt;
				fs.writeFile("pitImages/" + newImageName, imageBuffer, function(err){//err right?, use later
					done++;
					imagePaths.push("pitImages/" + newImageName);
					if (done == images.length){
						report.imagePaths = imagePaths;
						Report.create(report, function(err) {
			                cb(!err);
			            });
					}
				});
            }
        } else {
            cb(false);
        }
    });
}

exports.respond = function(success) {
    if (success) return "success";
    else return "fail";
}

exports.validateReport = function(report, cb) {
    if (context == "pit" || context == "match"){
        DataPoint.count({
            context: report.context,
            teamCode: report.scoutTeamCode,
            $where: function(dataPoint) {
                var pointName = dataPoint.name;
                var value = report.data[pointName];
                if (typeof(value) == "undefined") return true;
                var type = dataPoint.type;
                if (type == "checkbox") {
                    if (typeof(value) != "boolean") return true;
                } else if (type == "text") {
                    if (typeof(value) != "string") return true;
                } else if (type == "number") {
                    if (typeof(value) != "number") return true;
                    else if (value % 1 != 0) return true;
                    else if (value < dataPoint.min) return true;
                    else if (typeof(dataPoint.max) != "undefined" && value > dataPoint.max) return true;
                } else if (type == "checkbox" || type == "radiobutton") {
                    if (typeof(value) != "string") return true;
                    if (dataPoint.options.indexOf(value) == -1) return true;
                }
            }
        }, function(err, count) {
            if (err || (report.context == "pit" && report.match) || (report.context == "match" && !report.match) /*||*/ ) {
                cb(false);
            } else {
                cb(count == 0);
            }
        });
    }
    else {
        cb(false);
    }

}

exports.getTeammatesInfo = function(teamCode, cb) { //right now, team is same, later it won't be
    User.find({
        teamCode: teamCode
    }, "_id firstName lastName teamCode username admin", function(err, users) {
        if (!err) {
            cb(null, users);
        } else {
            cb(err, null);
        }
    });
}

exports.getUserStats = function(userID, cb) {
    var stats = {};
    Report.count({
        scout: userID,
        context: "match"
    }, function(err, matchesScouted) {
        if (!err) {
            stats.matchesScouted = matchesScouted;
            Report.count({
                scout: userID,
                context: "pit"
            }, function(err, pitsScouted) {
                if (!err) {
                    stats.pitsScouted = pitsScouted;
                    Report.find({
                        scout: userID
                    }).distinct("team").count(function(err, count) { //Test, i have seen this work, however.
                        if (!err) {
                            stats.teamsScouted = count;
                            cb(null, stats);
                        } else {
                            cb(err, null);
                        }
                    });
                    cb(null, stats);
                } else {
                    cb(err, null);
                }
            });
        } else {
            cb(err, null);
        }
    });
}

exports.getTeamReports = function(scoutTeamCode, teamNumber, reportContext, cb){
	var allReports = {yourTeam:[], otherTeams:[]};
    if (reportContext == "match" || reportContext == "pit"){
        Report.find({
            team: teamNumber,
            context: reportContext,
            isPrivate: false,
            scoutTeamCode: {$ne: scoutTeamCode}
        }, "data scout team match event imagePaths", function(err, otherTeamReports){
            if (!err){
                addImagesToReports(otherTeamReports, function(newOtherTeamReports){
                    allReports.otherTeams = newOtherMatchReports;
                    Report.find({
                        team: teamNumber,
                        context: reportContext,
                        scoutTeamCode: scoutTeamCode
                    }, "data scout team match event imagePaths", function(err, yourTeamReports){
                        if (!err){
                            addImagesToReports(yourTeamReports, function(newYourTeamReports){
                                allReports.yourTeam = newYourTeamReports;
                                cb(allReports);
                            });
                        }
                        else {
                            cb(false);
                        }
                    });
                });
            }
            else {
                cb(false);
            }
        });
    }
    else {
        cb(false);
    }
}

exports.addImagesToReports = function(reports, cb){
    for (var i = 0; i < reports.length; i++){
        var report = reports[i];
        var imageBuffers = [];
        var imagesDone = 0;
        if (report.imagePaths.length == 0){//if it has no images
            delete report.imagePaths;
            report.imageBuffers = [];
            reportDone++;
            if (reportDone == reports.length){
                cb(reports);
            }
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
                    if (reportDone == reports.length){
                        cb(reports);
                    }
                }
            });
        }
    }
}

exports.getTeamInfoForUser = function(teamCode, cb){
    Team.findOne({
        teamCode: teamCode
    }, function(err, team){
        cb(team);
    });
}

exports.getUser = function(id, cb) {//.populate maybe?
    User.findOne({
        _id: id
    }, "_id firstName lastName username admin", function(err, user) {
        if (err) {
            cb(err, null);
        } else {
            cb(null, user);
        }
    })
}

exports.nameCase = function(str) {
    str = str.trim().toLowerCase();
    return str.charAt(0).toUpperCase() + str.substring(1);
};
