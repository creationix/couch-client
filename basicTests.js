var CouchClient = require('./lib/couch-client');
var assert = require('assert');

({
	run:function() {
		for (name in this) {
			if (name.slice(0,4) == 'test')
			{
				console.log("Running: " + name + '\r');
				this[name]();
			}
		}
	},

	testLocalDefaults:function() 
	{
		var db = CouchClient('/test');
		
		db.request("PUT", "/test", function (err, result) {
			if (err) throw err;
			db.save({_id:'testid0', testvalue:'atest'}, function (err, result) {
				if (err) throw err;
				db.get('testid0', function (err, result) {
					if (err) throw err;
					
					if (!result || !(result.testvalue === 'atest'))
						throw 'Value does not match';

					db.save({_id:'testid0', testvalue:'btest'}, function(err, result) {
						if (err) throw err;
						
						console.log(result);

						if (!result || !(result.testvalue === 'btest'))
							throw 'Value does not match';

						db.remove('testid0', function(err, result) {
							if (err) throw err;
						});
					});
				});
			});
		});
	},

	testRemoveObject:function() 
	{
		var db = CouchClient('/test');
		
		db.request("PUT", "/test", function (err, result) {
			if (err) throw err;
			db.save({_id:'testid3', testvalue:'atest'}, function (err, result) {
				if (err) throw err;
				db.get('testid3', function (err, result) {
					if (err) throw err;
					
					if (!result || !(result.testvalue === 'atest'))
						throw 'Value does not match';

					console.log(result);

					db.remove(result, function(err, result) {
						if (err) throw err;

						db.get('testid3', function(err, result) {
							if (result) throw "should be removed";
							if (!err && err.errno != 2) throw err;
						});
					});
				});
			});
		});
	},

	testCouchOne:function() 
	{
		var db = CouchClient('http://couch-client.couchone.com:80/test');
		
		db.request("PUT", "/test", function (err, result) {
			if (err) throw err;
			db.save({_id:'testid1', testvalue:'atest'}, function (err, result) {
				if (err) throw err;
				db.get('testid1', function (err, result) {
					if (err) throw err;
					
					if (!result || !(result.testvalue === 'atest'))
						throw 'Value does not match';

					db.save({_id:'testid1', testvalue:'btest'}, function(err, result) {
						if (err) throw err;
						
						console.log(result);

						if (!result || !(result.testvalue === 'btest'))
							throw 'Value does not match';

						db.remove('testid1', function(err, result) {
							if (err) throw err;
						});
					});
				});
			});
		});
	},


	testCouchOneSSL:function() 
	{
		var db = CouchClient('https://couch-client.couchone.com:443/test');
		
		db.request("PUT", "/test", function (err, result) {
			if (err) throw err;
			db.save({_id:'testid2', testvalue:'atest'}, function (err, result) {
				if (err) throw err;
				db.get('testid2', function (err, result) {
					if (err) throw err;
					
					if (!result || !(result.testvalue === 'atest'))
						throw 'Value does not match';

					db.save({_id:'testid2', testvalue:'btest'}, function(err, result) {
						if (err) throw err;

						console.log(result);

						if (!result || !(result.testvalue === 'btest'))
							throw 'Value does not match';

						db.remove('testid2', function(err, result) {
							if (err) throw err;
						});
					});
				});
			});
		});
	},
	
	testBasicAuthWorksWhenUsingHttp: function() {
		var db = CouchClient('http://couch-client:testingonly@couch-client.couchone.com:80/');
		db.view('/secure/does/not/exist', function (err, result) {
			if (err) throw err;
			assert.deepEqual(
			   {error: 'not_found', reason: 'missing'}, 
			   result
			);
		});
	},

	testBasicAuthWorksWhenUsingHttps: function()  {
		var db = CouchClient('https://couch-client:testingonly@couch-client.couchone.com:443/');
		db.view('/secure/does/not/exist', function (err, result) {
			if (err) throw err;
			assert.deepEqual(
			   {error: 'not_found', reason: 'missing'}, 
			   result
			);
		});
	}	
}).run();
