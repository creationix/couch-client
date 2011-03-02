# Couch Client

Couch Client is a simple wrapper around CouchDB's http interface.

> "CouchDB is a document-oriented, Non-Relational Database Management Server (NRDBMS)."

This wrapper/driver implements some nice things like request batching and automatic revision and key generation. Usage should be simple and straight-forward. For anything advanced, a simple http client is exposed that already connected to the couch server.

## `CouchClient(url)` - A client factory

This module exports a single factory function called `CouchClient`.  Usage is simple, it takes a single url for the connection to the database.

    var CouchClient = require('couch-client');
    var Users = CouchClient("http://username:password@yourhost:5984/users");

Since this assumes many defaults, for local testing on a stock CouchDB build, you can connect with simply `CouchCLient("/users")`.

This object will internally keep track of revisions it's seen before and batches http requests that happen in the same "tick" to go out at the same time using CouchDB's batch processing APIs.

The resulting object has the following four functions (`save`, `get`, `remove`, `request`);

The default port is 5984.

### `CouchClient.save(doc, callback)` - Save a document

Pass in a document and it will save it to the database.  If the document happens to have a `_id` property that that will be used as the key.  Also if the document has a `_rev` property, that will be passed to the server.  If they are missing, CouchClient will provide an automatic UUID using CouchDB's services and look up the latest revision.  Revisions are remembered.

    Users.save({_id: "creationix", name: "Tim Caswell", age: 28}, function ( err, doc) {
      // You know know if there was an error and have an updated version
      // of the document (with `_id` and `_rev`).
    });

### `CouchClient.get(key, callback)` - Load a document

Once you put data in the database, it's nice to be able to load it back out.  The `.get()` function takes a key as a string and returns the document in a callback.

    Users.get("creationix", function (err, doc) {
      // Now you have the document or error if there was trouble
    });

### `CouchClient.view(path, obj, callback)` - Call a view

`view` takes a path to a view, an object containing GET parameters, and a callback

    Users.view('/users/_design/design_name/_view/usernames', {key: "creationix"}, function(err, doc) {
        // Now you have the document(s) or error if there was trouble
    });

If `obj` is missing then it returns all the items in the view.

### `CouchClient.remove(key/doc, callback)` - Remove a document

Sometimes you want to remove documents from the database.  This function takes either a key as a string or a document with an `_id` property.  It will tell couch to delete it and give you back the modified document with the `_deleted` property.

    Users.remove("creationix", function (err, doc) {
      // If there was no error, it's gone
    });

### `CouchClient.request(method, path, body, callback)` - Arbitrary HTTP request.

This is the helper used internally to execute HTTP requests against the CouchDB database.  It's exposed here because CouchDB provides a very rich interface, and it can't all be easily wrapped.  The `body` parameter is optional and should be passed in as a raw JavaScript object.

    Users.request("GET", "/some_database/_design/company/_view/all", function (err, result) {
      // result is a javascript object of CouchDB's response JSON
    });

    // Manually insert a single document
    Users.request("PUT", "/foo/bar", {Foo:"Bar"}, function (err, result) {
      // result is a javascript object of CouchDB's response JSON
    });

Also if you omit the callback an `EventEmitter` object that emits `"data"`, `"end"`, and `"error"` events.  Note that the data events are not parsed.  They are raw `utf8` strings.

### `CouchClient.changes(since, callback)` - Watch for changes to the database.

CouchDB provides a neat feature known as the `_changes` feed.  This allows you do watch a database and be notified when it's changed.  The `changes()` function is a wrapper.  You give it the `since` parameter and a callback.  The callback is called once per JSON document in the response stream.


## Testing

The basicTests file currently tests a;
* local couchdb instance, with no authorization setup. 
* couchone instance with authorization at https://couch-client.couchone.com/_utils couch-client:testingonly


### Adding Tests

Add tests to the basicTests.js file. Test function names need to start with 'test'.
    
	testSomething:function() {
		// testing something
	},


## Contributing

* please include tests with your pull requests.


## Changes from 0.0.3 -> 0.0.4

* view improvements / fixes
* basic auth support


### Contributors

flashingpumpkin
dready92
devioustree
hij1nx
steelThread
candland
