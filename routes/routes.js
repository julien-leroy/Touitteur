var request = require('../controllers/request.controller');

var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });

module.exports = function (app) {
	app.get('/component/:name', request.getRequest);
	app.post('/component', urlencodedParser, request.postRequest);

	app.use(function(req, res, next){
		res.setHeader('Content-Type', 'text/plain');
		res.status(404).send('Page not found');
	});
}
