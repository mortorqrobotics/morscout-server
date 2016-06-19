module.exports = function(app, imports) {

	var util = imports.util;

	app.get("/exportMatchData", util.requireLogin, function(req, res) {
		sendCsv("match", req, res);
	});

	app.get("/exportPitData", util.requireLogin, function(req, res) {
		sendCsv("pit", req, res)
	});

	function sendCsv(context, req, res) {
		imports.models.Report.find({
	        scoutTeamCode: req.session.user.current_team.id,
	        context: context
	    }, function(err, reports) {
			if(err) {
				console.log(err)
				// what to do here?
				return;
			}
			res.setHeader("Content-type", "text/csv");
			res.setHeader(
				"Content-disposition",
				"attachment; filename=morscout-" + context + "-data.csv"
			);
			res.end(getCsv(reports, context));
		});
	}

	function getCsv(reports, context) {
		var data = [];
		var metaKeys = [
			"event",
			"team"
		];
		if(context == "match") {
			metaKeys.push("match");
		}
		var keys = [];
		for(var report of reports) {
			var row = Array(keys.length).fill("");
			for(var obj of report.data) {
				if(!("value" in obj)) {
					continue;
				}
				var index = keys.indexOf(obj.name);
				var entry = getCsvEntry(obj.value);
				if(index == -1) {
					keys.push(obj.name);
					row.push(entry);
				} else {
					row[index] = entry;
				}
			}
			var metaData = [
				report.event,
				report.team
			];
			if(context == "match") {
				metaData.push(report.match);
			}
			data.push(metaData.concat(row));
		}
		for(var row of data) {
			for(var i = row.length; i < keys.length; i++) {
				row.push("");
			}
		}
		var keyStr = metaKeys.concat(keys).map(getCsvEntry).join(",");
		var dataStr = data.map(row => row.join(",")).join("\n");
		return keyStr + "\n" + dataStr + "\n";
	}

	function getCsvEntry(input) {
		var str = input.toString();
		// contains double quote, comma, or line break
		if(["\"", "\n", ","].every(chr => str.indexOf(chr) == -1)) {
			return str;
		} else {
			// enclose in double quotes
			// put an extra double quote in frnnt of all double quotes
			// compliant with RFC4180
			return '"' + str.replace(/\"/g, '""') + '"';
		}
	}

};
