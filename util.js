var mongoose = require("mongoose");
var session = require("express-session");//needed?

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
  		if(err) {
   			res.end("fail");
  		}
  		else {
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

exports.clearDataPoints = function(cb){
	DataPoint.remove({}, function(){
		cb();
	});
}


//Middleware (Do these work?)
exports.requireAdmin = function(req, res, next){
	if (req.session.user.admin) next();
	else res.end("fail");
}

exports.requireLogin = function(req, res, next){
	if (req.session.user) next();
	else res.end("fail");
}
//^^^^^


//Useful functions that have NOT been tested
exports.addDataPoints = function(dataPoints, cb) {
	var done = 0;
	for (var i = 0; i < dataPoints.length; i++){
		var dataPoint = dataPoints[i];
		var type = dataPoint.type;
		if ((!~["checkbox", "radiobuttons", "dropdown", "text", "number"].indexOf(type)) ||
			(~["radiobuttons", "dropdown"].indexOf(type) && !dataPoint.options) ||
			(!~["radiobuttons", "dropdown"].indexOf(type) && dataPoint.options) ||
			(type == "number" && !(typeof(dataPoint.min) == "number" && typeof(dataPoint.start) == "number")) ||
			(type != "number" && (typeof(dataPoint.min) == "number" || typeof(dataPoint.max) == "number" || typeof(dataPoint.start) == "number")) ||
			(typeof(dataPoint.context) != "string")){ //This was a switch-case but ben did not want that
				clearDataPoints(function(){ //if one data point is corrupt the form is rejected and all points are cleared
					cb(false);
					break;
				});
		}
		else {
			DataPoint.create(dataPoint, function(err) {
				if (!err){
					done++;
					if (done == dataPoints.length){
						cb(true);
					}
				}
				else {
					clearDataPoints(function(){ //if one data point is corrupt the form is rejected and all points are cleared
						cb(false);
						break;
					});
				}
	   	});
		}
	}
}


exports.submitReport = function(report, cb){
	validateReport(report, function(isValid){
		if (isValid){
			delete report.scout.password; //important
			Report.create(report, function(err){
				cb(!err);
			});
		}
		else {
			cb(false);
		}
	});
}

exports.respond = function(success){
	if (success) return "success";
	else return "fail";
}

exports.validateReport = function(report, cb) {
	DataPoint.count({
		context: report.context,
		$where: function(dataPoint) {
			var pointID = dataPoint._id;
			var value = report.data[pointID];
			if(typeof(value) == "undefined") return true;
			var type = dataPoint.type;
			if(type == "checkbox") {
				if(typeof(value) != "boolean") return true;
			}
			else if(type == "text") {
				if(typeof(value) != "string") return true;
			}
			else if(type == "number") {
				if(typeof(value) != "number") return true;
				else if(value % 1 != 0) return true;
				else if(value < dataPoint.min) return true;
				else if(typeof(dataPoint.max) != "undefined" && value > dataPoint.max) return true;
			}
			else if(type == "checkbox" || type == "radiobutton") {
				if(typeof(value) != "string") return true;
				if(dataPoint.options.indexOf(value) == -1) return true;
			}
		}
	}, function(err, count) {
		if (err || (report.context == "pit" && report.match) || (report.context == "match" && !report.match)){
			cb(false);
		}else{
			cb(count == 0);
		}
	});
}

exports.getTeammatesInfo = function(cb){//right now, team is same, later it won't be
	User.find({}, "_id firstName lastName username admin", function(err, users){
		if (!err) {
			cb(null, users);
		}else{
			cb(err, null);
		}
	});
}

exports.getUserStats = function(userID, cb){
	var stats = {};
	Report.count({
		_id: userID,
		context: "match"
	}, function(err, matchesScouted){
		if (!err) {
			stats.matchesScouted = matchesScouted;
			Report.count({
				_id: userID,
				context: "pit"
			}, function(err, pitsScouted){
				if (!err) {
					stats.pitsScouted = pitsScouted;
					cb(null, stats);
				}
				else {
					cb(err, null);
				}
			});
		}
		else {
			cb(err, null);
		}
	});
}

exports.getUser = function(id, cb){
	User.findOne({
		_id: id
	}, "_id firstName lastName username admin", function(err, user){
		if(err){
			cb(err, null);
		}else{
			cb(null, user);
		}
	})
}

exports.nameCase = function(str) {
	str = str.trim().toLowerCase();
	return str.charAt(0).toUpperCase() + str.substring(1);
};
