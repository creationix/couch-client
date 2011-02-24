var CouchClient = require('./lib/couch-client');

var Meetings = CouchClient("http://hack:me@localhost:5984/meetings");

// Meetings.changes(54, function (err, change) {
//   if (err) throw err;
//   console.dir(change);
// });
// 
// setInterval(function () {
//   Meetings.save({FOO:false});
// }, 500);
// 
// Meetings.save({name:"Tim2",hacker:true}, function (err, result) {
//   if (err) throw err;
// });
// var Step = require('step');
// Step(
//   function () {
//     Meetings.save({_id: "creationix", name:"Tim",age:28}, this);
//   },
//   function (err, doc) {
//     if (err) throw err;
//     console.log("Saved %s", JSON.stringify(doc));
//     doc.age = 100;
//     Meetings.save(doc, this);
//   },
//   function (err, doc) {
//     if (err) throw err;
//     Meetings.remove(doc._id, this);
//   },
//   function (err, doc) {
//     if (err) throw err;
//     Meetings.get(doc._id, this);
//   },
//   function (err, doc) {
//     if (err) throw err;
//     console.dir(doc);
//   }
// )


// Meetings.get("creationix", function (err, doc) {
//   console.dir(arguments);
// });
// Meetings.get("creationix", function (err, doc) {
//   console.dir(arguments);
// });
// 
const NUM = 1000;
const LOOPS = 1000;
var start = Date.now();
var value = {Foo:"Bar"};
// var interval = setInterval(function () {
//   console.log("Tick");
// }, 500);


count = NUM * LOOPS;
function test() {
  var i = NUM;
  while (i--) {
    Meetings.save(value, function (err, doc) {
      // console.log(doc);
      if (err) throw err;
      if (!--count) {
        console.log("Inserted %s items in %sms", NUM * LOOPS, Date.now() - start);
        // clearInterval(interval);
      }
    });
  }
}
for (var i = 0; i < LOOPS; i++) {
  setTimeout(test, i*30);
}


