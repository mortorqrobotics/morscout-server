var http = require("http");

var db = require("./db.js");

function dgid(id) {
	return document.getElementById(id);
}

var server = http.createServer(function(req, res) {
	res.end("hello");
});

dgid("start").onclick = function() {
	server.listen(8080);
	dgid("status").innerHTML = "Enabled";
};

dgid("stop").onclick = function() {
	server.close();
	dgid("status").innerHTML = "Disabled";
};