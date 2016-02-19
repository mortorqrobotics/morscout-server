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

exports.isInt = function(value) {
    return !isNaN(value) && (function(x) {
        return (x | 0) === x;
    })(parseFloat(value))
}

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

function clearDataPoints(teamCode, context, cb) {
    DataPoint.remove({
        teamCode: teamCode,
        context: context
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

function isNum(str) {
    return /^-?\d+$/.test(str);
}
//^v How to merge?
exports.isNum = function(str){
    return isNum(str);
}


//Useful functions that have NOT been tested
exports.addDataPoints = function(dataPoints, teamCode, context, cb) {
    var done = 0;
    var allPointsValid = true;
    var ended = false;
    clearDataPoints(teamCode, context, function() { //clear current data points
        for (var i = 0; i < dataPoints.length; i++) {
            if (allPointsValid) {
                var dataPoint = dataPoints[i];
                var type = dataPoint.type;
                var allNames = []; //name is unique
                if ((!~["checkbox", "radio", "dropdown", "text", "number", "label"].indexOf(type)) ||
                    (~["radio", "dropdown"].indexOf(type) && !dataPoint.options) ||
                    (!~["radio", "dropdown"].indexOf(type) && dataPoint.options) ||
                    (type == "number" && !(isNum(dataPoint.min) && isNum(dataPoint.start) && isNum(dataPoint.start))) ||
                    (type != "number" && (isNum(dataPoint.min) || isNum(dataPoint.max) || isNum(dataPoint.start))) ||
                    (dataPoint.context != "match" && dataPoint.context != "pit") ||
                    (~allNames.indexOf(dataPoint.name)) ||
                    (type == "label" && (dataPoint.min || dataPoint.max || dataPoint.start || dataPoint.options))) { //This was a switch-case but ben did not want that //Names must be unique
                    allPointsValid = false;
                    clearDataPoints(teamCode, context, function() { //if one data point is corrupt the form is rejected and all points are cleared
                    });
                } else {
                    allNames.push(dataPoint.name);
                    DataPoint.create(dataPoint, function(err) {
                        if (!err) {
                            done++;
                            if (done == dataPoints.length) {
                                ended = true;
                                cb(true);
                            }
                        } else {
                            allPointsValid = false;
                            clearDataPoints(teamCode, context, function() { //if one data point is corrupt the form is rejected and all points are cleared
                            });
                        }
                    });
                }
            } else {
                ended = true;
                cb(false);
                break;
            }
        }
        if (!ended && !allPointsValid) {
            ended = true;
            cb(false);
        }
    });
}

exports.sendEmail = function(to, subject, text, cb) { //TEMPORARY, make this work with Mailgun, it is a placeholder
    var transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", //Use mailgun later
        secure: true,
        port: 465,
        auth: {
            user: "", //Add valid email
            pass: "" //Add valid pass -config file?
        }
    });
    transporter.sendMail({
        from: "support@morscout.com",
        to: to,
        subject: subject,
        html: text
    }, function(err, response) {
        if (err) {
            cb(false);
        } else {
            cb(true);
        }
        transporter.close();
    });
}

String.prototype.replaceAll = function(t, r) {
    return this.split(t).join(r);
};

exports.request = function(path, cb) { //I will make this function better using express later
    http.request({
        host: "www.thebluealliance.com",
        path: "/api/v2" + path,
        headers: {
            "X-TBA-App-Id": "frc1515:MorScout:2.0"
        }
    }, function(res) {
        var data = "";
        res.on("data", function(chunk) {
            data += chunk;
        });
        res.on("end", function() {
            //Added error handling
            if (data.substring(0, 10) == "{'Errors':" || data.substring(0, 7) == '{"404":' || data.substring(0, 3) == "404") cb(null, "Error");
            else cb(JSON.parse(data.split("'").join("")));
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
    delete report.images; //so you dont pass all that data to validateReport
    validateReport(report, function(isValid) {
        if (isValid) {
            var done = 0;
            for (var i = 0; i < images.length; i++) {
                var image = images[i];
                var imageExt = image.name.split(".")[image.name.split(".").length - 1];
                var imageBuffer = image.buffer;
                var newImageName = randomStr(32) + "." + imageExt;
                fs.writeFile("pitImages/" + newImageName, imageBuffer, function(err) { //err right?, use later
                    done++;
                    imagePaths.push("pitImages/" + newImageName);
                    if (done == images.length) {
                        report.imagePaths = imagePaths;
                        Report.create(report, function(err) {
                            cb(!err);
                        });
                    }
                });
            }
            if (images.length == 0){
                report.imagePaths = [""];
                Report.create(report, function(err, report) {
                    cb(!err);
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

function validateReport(report, cb) {//CHECK for empty values and such
    var context = report.context;
    var isValid = true;
    if (context == "pit" || context == "match") {
        DataPoint.find({
            context: context,
            teamCode: report.scoutTeamCode
        }, function(err, dataPoints) {
            for(var i = 0; i < dataPoints.length; i++) {
                var dataPoint = dataPoints[i];
                var pointName = dataPoint.name;
                var value; //
                for (var i = 0; i < report.data.length; i++) {
                    if (report.data[i].name == pointName) {
                        value = report.data[i].value;
                        break;
                    }
                }
                var type = dataPoint.type;
                if((typeof(value) == "undefined" && type != "label") ||
                    (type == "checkbox" && (value != "true" && value != "false")) ||
                    (type == "text" && typeof(value) != "string") ||
                    (type == "number" && typeof(parseInt(value)) != "number") ||
                    (type == "number" && parseInt(value) % 1 != 0 && value < parseInt(dataPoint.min)) ||
                    (type == "number" && (typeof(parseInt(value)) != "undefined" && value > parseInt(value))) ||
                    ((type == "dropdown" || type == "radio") && ((typeof(value) != "string") || (dataPoint.options.indexOf(value) == -1))) ||
                    (type == "label" && typeof(value) != "undefined")) {
                        isValid = false;
                        break;
                }
            }
            if (isValid || (report.context == "pit" && report.match) || (report.context == "match" && !report.match) /*||*/ ) {
                cb(true);
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

//exports.validateReport = validateReport();

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
                    // Report.find({//no work?
                    //     scout: userID//only at current regional?
                    // }).distinct("team").count(function(err, count) { //Test, i have seen this work, however.
                    //     if (!err) {
                    //         stats.teamsScouted = count;
                    //         cb(null, stats);
                    //     } else {
                    //         cb(err, null);
                    //     }
                    // });
                    Report.find({
                        scout: userID
                    }, function(err, reports){
                        if (!err) {
                            var allTeams = [];
                            reports.forEach(function(report){
                                if (allTeams.indexOf(report.team) < 0) allTeams.push(report.team);
                            });
                            stats.teamsScouted = allTeams.length;
                            cb(null, stats);
                        } else {
                            cb(err, null);
                        }
                    });
                    //cb(null, stats);
                } else {
                    cb(err, null);
                }
            });
        } else {
            cb(err, null);
        }
    });
}

exports.getTeamReports = function(scoutTeamCode, teamNumber, reportContext, cb) {
    var allReports = {
        yourTeam: [],
        otherTeams: []
    };
    if (reportContext == "match" || reportContext == "pit") {
        Report.find({
            team: teamNumber,
            context: reportContext,
            isPrivate: false,
            scoutTeamCode: {
                $ne: scoutTeamCode
            }
        }, "data scout team match event imagePaths", function(err, otherTeamReports) {
            if (!err) {
                addImagesToReports(otherTeamReports, function(newOtherTeamReports) {
                    allReports.otherTeams = newOtherMatchReports;
                    Report.find({
                        team: teamNumber,
                        context: reportContext,
                        scoutTeamCode: scoutTeamCode
                    }, "data scout team match event imagePaths", function(err, yourTeamReports) {
                        if (!err) {
                            addImagesToReports(yourTeamReports, function(newYourTeamReports) {
                                allReports.yourTeam = newYourTeamReports;
                                cb(allReports);
                            });
                        } else {
                            cb(false);
                        }
                    });
                });
            } else {
                cb(false);
            }
        });
    } else {
        cb(false);
    }
}

exports.addImagesToReports = function(reports, cb) {
    for (var i = 0; i < reports.length; i++) {
        var report = reports[i];
        var imageBuffers = [];
        var imagesDone = 0;
        if (report.imagePaths.length == 0) { //if it has no images
            delete report.imagePaths;
            report.imageBuffers = [];
            reportDone++;
            if (reportDone == reports.length) {
                cb(reports);
            }
        }
        for (var j = 0; j < report.imagePaths; j++) { //if it has images
            var imagePath = imagePaths[j];
            fs.readFileSync(imagePath, function(err, buffer) { //check cb args
                imagesDone++;
                imageBuffers.push(buffer);
                if (imagesDone == imagePaths.length) {
                    delete report.imagePaths;
                    report.imageBuffers = imageBuffers;
                    reportDone++;
                    if (reportDone == reports.length) {
                        cb(reports);
                    }
                }
            });
        }
    }
}

exports.getTeamInfoForUser = function(teamCode, cb) {
    Team.findOne({
        teamCode: teamCode
    }, function(err, team) {
        cb(team);
    });
}

exports.getUser = function(id, cb) { //.populate maybe?
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

exports.sortObject = function(obj) { //nm, greatest to least
    var arr = [];
    var prop;
    for (prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            arr.push({
                'key': prop,
                'value': obj[prop]
            });
        }
    }
    arr.sort(function(a, b) {
        return b.value - a.value;
    });
    return arr;
}

exports.nameCase = function(str) {
    str = str.trim().toLowerCase();
    return str.charAt(0).toUpperCase() + str.substring(1);
};
