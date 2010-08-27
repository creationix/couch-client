var CouchClient = require('./lib/couch-client');
process.title = "couch-client saveTest"
var db = CouchClient("/test");

// Insert 100,000 documents with specified ids in a single sync block of code
// The driver should automatically chunk these into parallel requests for best
// performance.
db.request("PUT", "/test", function (err, result) {
  console.dir(arguments);
  var i = 100000;
  while (i--) {
    db.save({_id:(i+1).toString()}, function (err, result) {
      if (err) throw err;
    });
  }
});
