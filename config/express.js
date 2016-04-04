var express = require('express');
var bodyParser = require('body-parser');

// export NODE_ENV=production
var ENV = require('./env/' + process.env.NODE_ENV);

var port = ENV.port;

module.exports = function(){
	var app = express();

	//enabling cors
	app.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});

	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: true }));

	app.use(express.static('public'));
	
	require('../routes/routes.js')(app);



	app.listen(port);
	console.log('Server listen on : ' + port);
}
