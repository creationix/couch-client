var assert = require('assert');
var CouchClient = require('../lib/couch-client');
var db = CouchClient("http://127.0.0.1:5984/test");
var async = require('async');

// CouchClient#save
// --------------

// Insert 3,000 documents with specified ids in a single sync block of code
// The driver should automatically chunk these into parallel requests for best
// performance.

function testSave(callback) {
  var i = 3000;
  var fns = []
  while (i--) {
    fns.push(function(callback) {
      db.save({content: "Foo"}, function (err, result) {
        assert.ok(!err);
        callback();
      });
    });
  }
  
  async.parallel(fns, function(err, results) {
    // Conflict handling, some save operations may fail due to conflicts
    db.save({_id:"foo", content: "Foo"}, function (err, result) {
      assert.ok(!err);
      
      db.save({_id:"bar", content: "Bar"}, function (err, result) {
        assert.ok(!err); // no conflict here
        
        db.save({_id:"foo", content: "Conflicting"}, function (err, result) {
          assert.ok(err.error == 'conflict'); // detect conflict!

          // Force update (ignore conflicts and overwrite)
          db.save({_id:"foo", content: "Forced update"}, {force: true}, function (err, doc) {
            assert.ok(!err);
            assert.ok(doc);
            callback();
          });
        });
      });
    });
  });
}


// CouchClient#get
// --------------

function testGet(callback) {
  db.get('foo', function(err, doc) {
    assert.ok(!err);
    assert.ok(doc);
    
    db.get('the_doc_that_wasnt_there', function(err, doc) {
      assert.ok(err);
      assert.ok(!doc);
      callback();
    });
  });
}

// CouchClient#view
// --------------

function testView(callback) {
  var view = {
    _id: '_design/queries',
    views: {
      "by_content": {
        "map": "function(doc) { emit(doc.content, doc); }"
      }
    }
  };
  
  db.save(view, function (err, doc) {
    db.view('queries/by_content', {limit: 10}, function(err, result) {
      assert.ok(result.rows.length === 10);
      assert.ok(!err);
      
      db.view('queries/not_existing_view', function(err, result) {
        assert.ok(err);
        assert.ok(!result);
        callback();
      });
    });
  });
}

// CouchClient#remove
// ------------------

function testRemove(callback) 
{
	db.save({_id:'testid3', testvalue:'atest'}, function (err, result) {
		assert.ok(!err);
		
		db.get('testid3', function (err, result) {
			assert.ok(!err);
			assert.ok(result && result.testvalue === 'atest');

			db.remove(result, function(err, result) {
				assert.ok(!err);

				db.get('testid3', function(err, result) {
					assert.ok(!err);
					assert.ok(!result);
					callback();
				});
			});
		});
	});
}


// CouchClient#request - with basic-auth support
// --------------

function testRequest(callback) {
  db.request('PUT', '/_config/admins/couch-client', 'test', function(err, doc) {
    assert.equal('', doc);
    db.request('PUT', '/secure_test', function(err, doc) {
      assert.ok(doc.error && doc.error == 'unauthorized');
      assert.ok(doc.reason == 'You are not a server admin.')

      var securedb = CouchClient('http://couch-client:test@127.0.0.1:5984/');
      securedb.request('PUT', '/secure_test', function(err, doc) {
        assert.ok(doc.ok);

        securedb.request('DELETE', '/secure_test', function(err, doc) {
          assert.ok(doc.ok);
        });

        securedb.request('DELETE', '/_config/admins/couch-client', function(err, doc) {
          assert.ok(!err);
          callback();
        }); 
      });
    });
  }); 
}

// Test CouchOne 
// -------------

function testCouchOne(callback) 
{
	var dbOne = CouchClient('http://couch-client.couchone.com:80/test');
	
	dbOne.request("PUT", "/test", function (err, result) {
		assert.ok(!err);
		dbOne.save({_id:'testid1', testvalue:'atest'}, {force: true}, function (err, result) {
			assert.ok(!err);
			dbOne.get('testid1', function (err, result) {
				assert.ok(!err);
				assert.ok(result && result.testvalue === 'atest');
				result.testvalue = 'btest';

				dbOne.save(result, {force: true}, function(err, result) {
          assert.ok(!err);
					assert.ok(result && result.testvalue === 'btest');

					dbOne.remove('testid1', function(err, result) {
						console.log(err);
						assert.ok(!err);
					});
				});
			});
		});
	});
}

// CouchOne SSL
// ------------

function testCouchOneSSL() 
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
}


// Flush DB and perform tests
db.request("DELETE", db.uri.pathname, function (err) {
  if (err) console.log(err);
  db.request("PUT", db.uri.pathname, function(err) {
    if (err) console.log(err);
    async.series([
      testSave,
      testGet,
      testView,
      testRequest,
			testRemove,
			testCouchOne
			//testCouchOne
    ], function(err) {
      console.log('Tests completed.');
    });
  });
});
