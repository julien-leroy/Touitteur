var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var uuid = require('uuid');
var async = require('async');

var client = require("../models/redisConnection");

module.exports = function (app) {
	app.post('/login', urlencodedParser, function(req, res){
		if(req.body.login !='' && req.body.passwd != ''){
			//on récupére l'id du l'user à partir de son login
			client.hget('users', req.body.login, function(err, reply) {
				var id = reply;
				if(reply){
					client.hget('user:'+id, 'password', function(err, reply){
						var password = reply;
						if(reply && password == req.body.passwd){
							//création d'un cookie pour l'utilisateur qui vient de se logger
							cookieid = uuid.v4();
							//stocke le cookie
							client.hset('user:'+ id, 'auth', cookieid);
							//client.hset('cookie', cookieid, 'user:' +id);
							//on renvoie que loggin à reussi
							res.json({result: true, cookieuuid : cookieid, userid: id, username: req.body.login, msg: 'success login'});
						}else{
							res.json({result: false, msg: 'Connection failed'});
						}
					});
				}else{
					res.json({result: false, msg: 'Connection failed'});
				}
			});
		}
	});

	//enregistrement d'un nouvel utilisateur
	app.post('/newuser', urlencodedParser, function(req, res){
		console.log(req.body);
		//On verifie que le formulaire n'est pas vide
		if(req.body.newlogin !='' && req.body.newpasswd != '' && req.body.newpasswd2 != ''){

			//on verfifie que la confirmation du password est juste
			if(req.body.newpasswd != req.body.newpasswd2){
				//si elle ne l'est pas en renvoie à l'accueil (prévoir msg erreur)
				res.json({result: false, msg : "Not the same password"});
			}else{
				client.hget('users', req.body.newlogin, function(err, reply){
					if(reply==null){
						var id = uuid.v4();
						//ensuite on crée un hmset avec pour intitulé l'id et contenant le login et le mot de passe de l'utilisateur
						client.hmset('user:'+id, 'username', req.body.newlogin, 'password', req.body.newpasswd);
						//on crée un hset pour pouvoir retrouvé l'id de l'utilisateur à partir de son login
						client.hset('users', req.body.newlogin, id);
						//on redirige vers l'accueil (prévoir msg de confirmation)
						res.json({result : true, msg: 'You can now you connect :)'});
					}else{
						res.json({result : false, msg: 'Username not available'});
					}
				});
			}

		}

	});

	//retourne l'userid correspondant au login
	app.get('/login/:login', function(req, res){
		client.hget('users', req.params.login, function (err, response) {
			if(err){
				console.log(err);
				res.json({result : false, msg : 'Failed to reach database'});	
			}else{ 
				res.json({result : true, userid : response, login : req.params.login});
			}
		});
	});

	//récupére les followers d'un l'utilisateur (trie du plus ancien au plus recent)
	app.get('/followers/:userid', function(req, res){
		if(req.params.userid != '' && typeof req.params.userid != 'undefined') {
			//on recherche les id des followers
			client.zrange('followers:' + req.params.userid, 0, -1, function (err, response) {
				if(err){
					throw err;
					console.log(err);
				}else{
					//on stocke le resultat dans un tableau
					var idList = response;
					//tableau qui va contenir le nom des followers
					var followersNames = [];
					//Comme les requêtes sont asynchrones, j'utilise async.each pour attendre la fin de toutes le requête hget avant d'envoyer le tableau dûement rempli
					async.each(idList,
						function(id, callback){
							client.hget('user:'+ id, 'username', function(err, reply){
								if(err){
									throw err;
									console.log(err);
								}else{
									followersNames.push(reply);
									callback();
								}
							});

						},
						//quand les requetes sont fini, je recherche le nom de l'utilisateur et je construit ma reponse json
						function(err){
							if(err){
								console.log(err);
								res.json({result : false, msg : 'Failed to reach database'});
							}else{
								//on récupére le nom de lutilisateur
								client.hget('user:'+ req.params.userid, 'username', function(err, reply){
									if(err){
										console.log(err);
										res.json({result : false, msg : 'Failed to reach database'});
									}else{
										//reponse json
										res.json({result : true, userid : reply, followers : followersNames});
									}
								});
							}
						}
					);
				}
			});
		}//ajouter msg erreur

	});

	//ajoute un utilisateur à suivre
	app.post('/followings/', urlencodedParser, function(req, res){
		if(req.body.userid != '' && req.body.followid != ''
			&& typeof req.body.userid != 'undefined'
			&& typeof req.body.followid != 'undefined'){
			client.hget('user:' + req.body.userid, 'auth', function (err, response) {

				console.log('serv : ' + response + '   body : ' + req.body.cookieuuid);
				if(response == req.body.cookieuuid){	
					var date = Date.now();
					client.zadd( 'following:' + req.body.userid, date, req.body.followid, function (err, response) {
						if(err){
							console.log(err);
							res.json({result : false, msg : 'Failed to reach database'});
						}else{
							client.zadd( 'followers:' + req.body.followid, date, req.body.userid, function (err, response) {
								if(err){
									throw err;
									console.log(err);
									res.json({result : false, msg : 'Failed to reach database'});
								}else{
									res.json({result: true, msg : 'Success'});
								}
							});
						}
					});
				}
			});
		}//ajouter msg erreur
	});
	//récupére ceux qu'un utilisateur suit (trie du plus ancien au plus recent)
	app.get('/followings/:userid', function(req, res){
		if(req.params.userid != '' && typeof req.params.userid != 'undefined') {
			client.zrange('following:' + req.params.userid, 0, -1, //'withscores',
				function (err, response) {
					if(err){
						console.log(err);
						res.json({result : false, msg : 'Failed to reach database'});
					}else{
					//on stocke le resultat dans un tableau
					var idList = response;
					//tableau qui va contenir le nom des followers
					var followingsNames = [];
					//Comme les requêtes sont asynchrones, j'utilise async.each pour attendre la fin de toutes le requête hget avant d'envoyer le tableau dûement rempli
					async.each(idList,
						function(id, callback){
							client.hget('user:'+ id, 'username', function(err, reply){
								if(err){
									throw err;
									console.log(err);
								}else{
									followingsNames.push(reply);
									callback();
								}
							});
						},
						//quand les requetes sont fini, je recherche le nom de l'utilisateur et je construit ma reponse json
						function(err){
							if(err){
								console.log(err);
								throw err;
							}else{
								//on récupére le nom de lutilisateur
								client.hget('user:'+ req.params.userid, 'username', function(err, reply){
									if(err){
										console.log(err);
										res.json({result : false, msg : 'Failed to reach database'});
									}else{
										//reponse json
										res.json({result : true, userid : reply, followings : followingsNames});
									}
								});
							}
						}
					);
				}
			});
		}//ajouter msg erreur
	});

	//ajoute le post d'un utilisateur
	app.post('/posts', urlencodedParser, function(req, res){
		if(req.body.userid != '' && req.body.msg != '' && req.body.cookieuuid !='' && 
			typeof req.body.userid != 'undefined' && typeof req.body.msg != 'undefined' && typeof req.body.cookieuuid != 'undefined'){
			
			client.hget('user:' + req.body.userid, 'auth', function (err, response) {
				if(response == req.body.cookieuuid){
					client.zadd( 'posts:' + req.body.userid, Date.now(), req.body.msg, function (err, response) {
						if(err){
							console.log(err);
							res.json({result : false, msg : 'Failed to reach database'});
						}else{
							res.json({result: true, msg : 'Post add successfully'});
						}
					});
				}
			})
		}else{
			res.json({result : false, msg : 'Bad Query'});
		}
	});

	//récupére les poste d'un utilisateur (trie du plus recent au plus ancien)
	app.get('/posts/:userid', function(req, res){
		if(req.params.userid != '' && typeof req.params.userid != 'undefined') {
			client.zrevrange('posts:' + req.params.userid, 0, -1, function (err, response) {
					if(err){
						console.log(err);
						res.json({result : false, msg : 'Failed to reach database'});
					}else{
						//on récupére le nom de lutilisateur
						client.hget('user:'+ req.params.userid, 'username', function(err, reply){
							if(err){
								console.log(err);
								res.json({result : false, msg : 'Failed to reach database'});
							}else{
								//reponse json
								res.json({result : true, userid : reply, posts : response});
							}
						});
					}
			});
		}
	});

	app.get('/users', function(req, res){
		client.hgetall('users', function (err, response){
			if(err){
				console.log(err);
				res.json({result : false, msg : 'Failed to reach database'});
			}else{
				res.json(response);
			}
		});
	});

	app.post('/checkcookie', urlencodedParser, function(req, res){
		if(req.body.cookieuuid != '' && req.body.userid != ''){
			client.hget('user:' + req.body.userid, 'auth', function (err, response){
				if(err){
					console.log(err);
					res.json({result : false, msg : 'Failed to reach database'});
				}else{
					if(response == req.body.cookieuuid){
						res.json({result : true, msg : 'Cookie valid'});
					}else{
						res.json({result : false, msg : 'Bad cookie'});
					}
				}
			});
		}
	});

	app.use(function(req, res, next){
		res.setHeader('Content-Type', 'text/plain');
		res.status(404).send('Page not found');
	});
}
