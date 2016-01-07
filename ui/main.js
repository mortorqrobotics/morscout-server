var server = require("server.js");

function dgid(id) {
	return document.getElementById(id);
}

dgid("start").onclick = function() {
	server.start();
	dgid("status").innerHTML = "Enabled";
};

dgid("stop").onclick = function() {
	server.stop();
	dgid("status").innerHTML = "Disabled";
};