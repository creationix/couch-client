var CouchClient = require('./lib/couch-client');
var db = CouchClient("http://localhost:5984/test");
var i = 100000;
var start;
db.request("PUT", "/test", function (err, result) {
  while (i--) {
    db.save({_id: "0x" + i.toString(16), name:"Tim", age: 28}, function (err, result) {
      if (err) throw err;
    });
  }
});

