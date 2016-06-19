"use strict";

module.exports = function(imports) {

	// initialize default config file if it does not exist
	let fs = require("fs");
	// config contains password and sensitive information
	let configPath = require("path").join(__dirname, "config.json");
	if (fs.existsSync(configPath)) {
		imports.config = require(configPath);
	} else {
		imports.config = {
			"mailgunUser": "user@morteam.com",
			"malgunPass": "password",
			"dbName": "morteam"
		};
		fs.writeFileSync(configPath, JSON.stringify(imports.config, null, "\t"));
		console.log("Generated default config.json");
	}

	// mongoose comes from mornetwork
	imports.modules.express = require("express");

	// User, Team, and Subdivision come from mornetwork
	imports.models.Assignment = require("./models/Assignment.js")(imports);
	imports.models.DataPoint = require("./models/DataPoint.js")(imports);
	imports.models.Image = require("./models/Image.js")(imports);
	imports.models.Report = require("./models/Report.js")(imports);
	imports.models.Strategy = require("./models/Strategy.js")(imports);

	imports.util = require("./util.js")(imports);

	// TODO: add config here

	return imports;

};
