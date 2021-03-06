module.exports = function(imports) {
var exports = {};

var mongoose = imports.modules.mongoose;
var fs = require("fs");
var http = require("http");

var DataPoint = imports.models.DataPoint;
var Report = imports.models.Report;
var Assignment = imports.models.Assignment;
var Strategy = imports.models.Strategy;
var Image = imports.models.Image;
var User = imports.models.User;
var Team = imports.models.Team;
var Subdivision = imports.models.Subdivision;
var config = imports.config;

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

exports.sec = function(str){
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//Merge ^v
function sec(str){
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
exports.average = function(arr) {
    return arr.reduce(function(a,b){return a+b;}) / arr.length;
};
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

function clearDataPoints(team, context, cb) {
    DataPoint.remove({
        team: team,
        context: context
    }, function() {
        cb();
    });
}


//Middleware (Do these work?)
exports.requireAdmin = function(req, res, next) {
    if (req.user && (req.user.position == "leader" || req.user.position == "mentor" || req.user.scoutCaptain == true)) next();
    else res.end("fail");
}

exports.requireLogin = function(req, res, next) {
        if (req.user) next();
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
exports.addDataPoints = function(dataPoints, team, context, cb) {
    var done = 0;
    var allPointsValid = true;
    var ended = false;
    clearDataPoints(team, context, function() { //clear current data points
        for (var i = 0; i < dataPoints.length; i++) {
            if (allPointsValid) {
                var dataPoint = dataPoints[i];
                var type = dataPoint.type;
                var allNames = []; //name is unique
                if ((!~["checkbox", "radio", "dropdown", "text", "number", "label"].indexOf(type)) ||
                    (~["radio", "dropdown"].indexOf(type) && !dataPoint.options) ||
                    (type == "number" && !(isNum(dataPoint.min) && isNum(dataPoint.start) && isNum(dataPoint.start))) ||
                    (type != "number" && (isNum(dataPoint.min) || isNum(dataPoint.max) || isNum(dataPoint.start))) ||
                    (dataPoint.context != "match" && dataPoint.context != "pit") ||
                    (~allNames.indexOf(dataPoint.name))) {
                    allPointsValid = false;
                    clearDataPoints(team, context, function() { //if one data point is corrupt the form is rejected and all points are cleared
                    });
                } else {
                    allNames.push(dataPoint.name);
                    dataPoint.name = sec(dataPoint.name);//Protects HTML
                    DataPoint.create(dataPoint, function(err) {
                        if (!err) {
                            done++;
                            if (done == dataPoints.length) {
                                ended = true;
                                cb(true);
                            }
                        } else {
                            allPointsValid = false;
                            clearDataPoints(team, context, function() { //if one data point is corrupt the form is rejected and all points are cleared
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
    require("https").request({
        host: "www.thebluealliance.com",
        path: "/api/v3" + path,
        headers: {
            "X-TBA-Auth-Key": config.tbaApiKey
        }
    }, function(res) {
        var data = "";
        // var err = false;
        res.on("data", function(chunk) {
            data += chunk;
        });
        // res.on("error", function(err){
        //     err = true;
        //     cb(null, "Error");
        // });
        res.on("end", function() {
            //Added error handling
            if (data.substring(0 , 1) == "<" || data.substring(0, 10) == "{'Errors':" || data.substring(0, 7) == '{"404":' || data.substring(0, 3) == "404") cb(null, "Error");
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
    //var images = report.images;
    //var imagePaths = [];
    //delete report.images; //so you dont pass all that data to validateReport
    validateReport(report, function(isValid) {
        if (isValid) {
            // var done = 0;
            // for (var i = 0; i < images.length; i++) {
            //     var image = images[i];
            //     var imageExt = image.name.split(".")[image.name.split(".").length - 1];
            //     var imageBuffer = .buffer;
            //     var newImageName = randomStr(32) + "." + imageExt;
            //     fs.writeFile("pitImages/" + newImageName, imageBuffer, function(err) { //err right?, use later
            //         done++;
            //         imagePaths.push("pitImages/" + newImageName);
            //         if (done == images.length) {
            //             report.imagePaths = imagePaths;
                        Report.create(report, function(err) {
                            cb(!err);
                        });
            //         }
            //     });
            // }
            // if (images.length == 0){
            //     report.imagePaths = [""];
            //     Report.create(report, function(err, report) {
            //         cb(!err);
            //     });
            // }
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
            team: report.scoutTeam
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

exports.getTeammatesInfo = function(team, cb) { //right now, team is same, later it won't be
    User.find({
        team: team
    }, "-password", function(err, users) {
        if (!err) {
            cb(null, users);
        } else {
            cb(err, null);
        }
    });
}

exports.getUserStats = function(userID, currentRegional, cb) {
    var stats = {};
    Report.count({
        scout: userID,
        context: "match",
        event: currentRegional
    }, function(err, matchesScouted) {
        if (!err) {
            stats.matchesScouted = matchesScouted;
            Report.count({
                scout: userID,
                context: "pit",
                event: currentRegional
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
                        scout: userID,
                        event: currentRegional
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

function getPublicTeams(selfteam, cb){
    Team.find({
        isPrivate: false,
        _id: {$ne: selfteam}
    }, function(err, teams){
        if (!err){
            var teams = [];
            teams.forEach(function(team){
                teams.push(team._id);
            });
            cb(teams);
        }
        else {
            cb(false);
        }
    });
}
//Merge ^^vv
exports.getPublicTeams = function(selfteam, cb){
    getPublicTeams(selfteam, function(teams){
        cb(teams);
    });
}


exports.getTeamReports = function(scoutTeam, teamNumber, reportContext, query, cb) {//careful, this reveals scoutTeam on its own
    var allReports = {
        yourTeam: [],
        otherTeams: []
    };
    if (reportContext == "match" || reportContext == "pit") {
        getPublicTeams(scoutTeam, function(teams){
            Report.find({
                team: teamNumber,
                context: reportContext,
                //isPrivate: false,
                event: query,
                scoutTeam: {$in: teams}
            }, "data scout team match event scoutTeam", function(err, otherTeamReports) {
                if (!err) {
                    //addImagesToReports(otherTeamReports, function(newOtherTeamReports) {
                        allReports.otherTeams = otherTeamReports;
                        Report.find({
                            team: teamNumber,
                            context: reportContext,
                            event: query,
                            scoutTeam: scoutTeam
                        }, " _id data scout team match event").populate("scout", "firstname lastname").exec(function(err, yourTeamReports) {
                            if (!err) {
                                //addImagesToReports(yourTeamReports, function(newYourTeamReports) {
                                    allReports.yourTeam = yourTeamReports;
                                    cb(allReports);
                                //});
                            } else {
                                cb(false);
                            }
                        });
                    //});
                } else {
                    cb(false);
                }
            });
        });
    } else {
        cb(false);
    }
}

exports.addImagesToReports = function(reports, cb) {//don't use
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

function isDef(v){
    return (v !== null && typeof(v) != "undefined");
}

exports.getTeamInfoForUser = function(team, cb) {
    Team.findOne({
        _id: team
    }, function(err, team) {
        if (isDef(team) && (!isDef(team.currentRegional) || team.currentRegional.trim() == "")){
            var date = new Date();
            var year = date.getFullYear();
            exports.request("/team/frc" + team.number + "/events/" + year, function(events) {
                if (events.length > 0) {
                    var defKey = events[0].key;
                    if (isDef(defKey)){
                        Team.update({
                            _id: team
                        },{
                            currentRegional: defKey
                        }, function(err, newTeam){
                            if (!err) cb(newTeam);
                            else cb(team);
                        });
                    }
                    else {
                        cb(team);
                    }
                }
            });
        }
        else {
            cb(team);
        }
    });
}

exports.getUser = function(id, cb) { //.populate maybe?
    User.findOne({
        _id: id
    }, "-password", function(err, user) {
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


return exports;
}
