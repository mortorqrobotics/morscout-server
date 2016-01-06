var mongoose = require("mongoose");

var DataPoint = require("./schemas/DataPoint.js");
var Report = require("./schemas/Report.js");
var User = require("./schemas/User.js");

mongoose.connect("mongodb://localhost:27017/morscout");

exports.handleError = function(cb){
	return function(err) {
  		if(err) {
   			console.log("fail");
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


//Useful functions that have NOT been tested
exports.addDataPoint = function(dataPoint, cb) { //addDataPoints
	var type = dataPoint.type;
	if ((!~["checkbox", "radiobuttons", "dropdown", "text", "number"].indexOf(type)) ||
		(~["radiobuttons", "dropdown"].indexOf(type) && !dataPoint.options) ||
		(!~["radiobuttons", "dropdown"].indexOf(type) && dataPoint.options) ||
		(type == "number" && !(typeof(dataPoint.min) == "number" && typeof(dataPoint.start) == "number")) ||
		(type != "number" && (typeof(dataPoint.min) == "number" || typeof(dataPoint.max) == "number" || typeof(dataPoint.start) == "number")) ||
		(typeof(dataPoint.context) != "string")){ //This was a switch-case but ben did not want that
			cb(false);
	}
	else {
		DataPoint.create(dataPoint, function(err) {
    		cb(!err);
   		});
	}
}

exports.submitReport = function(report, cb){
	validateReport(report, function(isValid){
		if (isValid){
			Report.create(report, function(err){
				cb(!err);
			});
		}
		else {
			cb(false);
		}
	});
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
	}, handleError(function(count) {
		cb(count == 0);
	});
}
