/*global Buffer */

var http  = require('http'),
    https = require('https'),
    Url   = require('url'),
    EventEmitter = require('events').EventEmitter,
    querystring = require('querystring');


// Handles changes made in node v0.3.0
var NOT_FOUND_ERR_NO = process.ENOENT ? process.ENOENT : require('constants').ENOENT;
var MAX_DOCS = 1000; // The maximum number of docs to send in a single batch

function noOp(err) { if (err) { throw err; } }

var CONNECTION_DEFAULTS = {
  host: '127.0.0.1:5984',
  port: 5984,
  hostname: '127.0.0.1',
  pathname: "/"
};

function CouchClient(url) {
  var uri = Url.parse(url);
  uri.secure = uri.protocol == 'https:';
  uri.protocolHandler = uri.secure ? https : http;
  uri.__proto__ = CONNECTION_DEFAULTS;
  var revCache = {};
  var customHeaders;

  // A simple wrapper around node's http(s) request.
  function request(method, path, body, callback) {
    var stream;
	var customHeaders = undefined;
    // Body is optional
    if (typeof body === 'function' && typeof callback === 'undefined') {
      callback = body;
      body = undefined;
    }

	// Let's check if body contains headers and put them in customHeaders, if present
	if (typeof(body) !== 'undefined' && body !== null){
		if (isArray(body)){
			  customHeaders = body[1];
			  body = body[0];
			}
	}
	// if user only wants to specify headers but not body
	if (body === {}){
		body = undefined;
	}
    // Return a stream if no callback is specified
    if (!callback) {
      stream = new EventEmitter();
      stream.setEncoding = function () {
        throw new Error("This stream is always utf8");
      };
    }

    function errorHandler(err) {
      if (callback) { callback(err); }
      if (stream) { stream.emit('error', err); }
    }

    var headers = {
      "Host": uri.hostname
    };
    // add the authorization header if provided and using https
    if (uri.auth) {
      headers["Authorization"] = "Basic " + new Buffer(uri.auth, "ascii").toString("base64");
    }
	// default headers for body
    if (body) {
      body = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(body);
	  headers["Content-Type"] = "application/json";
    }
	// custom headers, can override default headers
	if (customHeaders){
		for (var i in customHeaders){
			headers[i] = customHeaders[i];
		}
	}

    var options = {
      host: uri.hostname,
      method: method,
      path: path,
      port: uri.port,
      headers: headers
    };
    var request = uri.protocolHandler.request(options, function (response) {
      response.setEncoding('utf8');
      var body = "";
      response.on('data', function (chunk) {
        if (callback) { body += chunk; }
        if (stream) { stream.emit('data', chunk); }
      });
      response.on('end', function () {
        if (callback) {
          try {
            var parsedBody = JSON.parse(body);
            callback(null, parsedBody);
          } catch(err) {
            callback(err);
          }
        }
        if (stream) { stream.emit('end'); }
      });
      response.on('error', errorHandler);
    });
    request.on('error', errorHandler);

    if (body){request.write(body, 'utf8');}
    request.end();

    return stream;
  }

  // Requests UUIDs from the couch server in tick batches
  var uuidQueue = [];
  function getUUID(callback) {
    uuidQueue.push(callback);
    if (uuidQueue.length > 1) { return; }
    function consumeQueue() {
      var pending = uuidQueue.splice(0, MAX_DOCS);
      if (uuidQueue.length) { process.nextTick(consumeQueue); }
      // console.log("Bulk getting UUIDs %s", pending.length);
      request("GET", "/_uuids?count=" + pending.length, function (err, result) {
        if (err) {
          pending.forEach(function (callback) {
            callback(err);
          });
          return;
        }
        if (result.uuids.length !== pending.length) {
          throw new Error("Wrong number of UUIDs generated " + result.uuids.length + " != " + pending.length);
        }
        result.uuids.forEach(function (uuid, i) {
          pending[i](null, uuid);
        });
      });
    }
    process.nextTick(consumeQueue);
  }

  // Saves documents in batches
  var saveValues = [];
  var saveQueue = [];
  function realSave(doc, callback) {
    // Put key and rev on the value without changing the original
    saveValues.push(doc);
    saveQueue.push(callback);
    if (saveQueue.length > 1) { return; }
    function consumeQueue() {
      var pending = saveQueue.splice(0, MAX_DOCS);
      var body = saveValues.splice(0, MAX_DOCS);
      if (saveQueue.length) { process.nextTick(consumeQueue); }
      // console.log("Bulk saving %s", body.length);
      request("POST", uri.pathname + "/_bulk_docs", {docs: body}, function (err, results) {
        if (results.error) {
          err = new Error("CouchDB Error: " + JSON.stringify(results));
          if (results.error === 'not_found') { err.errno = NOT_FOUND_ERR_NO; }
        }
        if (err) {
          pending.forEach(function (callback) {
            callback(err);
          });
          return;
        }
        results.forEach(function (result, i) {
          var doc = body[i];
          doc._id = result.id;
          doc._rev = result.rev;
          revCache[result.id] = result.rev;
          pending[i](null, doc);
        });
      });
    }
    process.nextTick(consumeQueue);
  }

  var getQueue = [];
  var getKeys = [];
  function realGet(key, includeDoc, callback) {
    getKeys.push(key);
    getQueue.push(callback);
    if (getQueue.length > 1) { return; }
    function consumeQueue() {
      var pending = getQueue.splice(0, MAX_DOCS);
      var keys = getKeys.splice(0, MAX_DOCS);
      if (getQueue.length) { process.nextTick(consumeQueue); }
      var path = uri.pathname + "/_all_docs";
      if (includeDoc) { path += "?include_docs=true"; }
      // console.log("Bulk Getting %s documents", keys.length);
      request("POST", path, {keys: keys}, function (err, results) {
        if (!results.rows) {
          err = new Error("CouchDB Error: " + JSON.stringify(results));
        }
        if (err) {
          pending.forEach(function (callback) {
            callback(err);
          });
          return;
        }
        results.rows.forEach(function (result, i) {
          var err;
          if (includeDoc) {
            if (result.error) {
              err = new Error("CouchDB Error: " + JSON.stringify(result));
              if (result.error === 'not_found') { err.errno = NOT_FOUND_ERR_NO; }
              pending[i](err);
              return;
            }
            if (!result.doc) {
              err = new Error("Document not found for " + JSON.stringify(result.key));
              err.errno = NOT_FOUND_ERR_NO;
              pending[i](err);
              return;
            }
            pending[i](null, result.doc);
            return;
          }
          pending[i](null, result.value);
        });
      });
    }
    process.nextTick(consumeQueue);
  }


  function save(doc, callback) {
    if (!callback) { callback = noOp; }
    if (doc._id) {
      if (!doc._rev) {
        if (!revCache.hasOwnProperty(doc._id)) {
          realGet(doc._id, false, function (err, result) {
            if (err) { return callback(err); }
            if (result) {
              revCache[doc._id] = result.rev;
              doc._rev = result.rev;
            }
            realSave(doc, callback);
          });
          return;
        }
        doc._rev = revCache[doc._id];
      }
    }
    realSave(doc, callback);
  }

  function get(key, callback) {
    realGet(key, true, callback);
  }

  function remove(doc, callback) {
    if (typeof doc === 'string') {
      doc = {_id: doc};
    }
    doc._deleted = true;
    save(doc, callback);
  }

  function changes(since, callback) {
    var stream = request("GET", uri.pathname + "/_changes?feed=continuous&heartbeat=1000&since=" + since);
    var data = "";
    function checkData() {
      var p = data.indexOf("\n");
      if (p >= 0) {
        var line = data.substr(0, p).trim();
        data = data.substr(p + 1);
        if (line.length) {
          callback(null, JSON.parse(line));
        }
        checkData();
      }
    }
    stream.on('error', callback);
    stream.on('data', function (chunk) {
      data += chunk;
      checkData();
    });
    stream.on('end', function () {
      throw new Error("Changes feed got broken!");
    });
  }

  function isArray(object) {
   if (object.constructor.toString().indexOf("Array") == -1)
      return false;
   else
      return true;
  }

  function view(viewName, obj, callback) {
	var method = "GET";
	var body = null;
    if (typeof obj === 'function') {
      callback = obj;
      obj = null;
    }

    if ( viewName.substr(0,1) != '/' ) {
		// assume viewname is designdocname/viewname
		var parts = viewName.split("/",2);
		if ( parts.length == 2 ) {
			viewName = uri.pathname+"/_design/"+parts[0]+"/_view/"+parts[1];
		}
	}

    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(function(key){
		if ( key === 'keys' ) {
			body = { keys: obj[key] }; // body is json stringified in request fn
			method='POST';
		} else {
			obj[key] = JSON.stringify(obj[key]);
		}
      });
      var getParams = querystring.stringify(obj);
      if (getParams){
        viewName = viewName + '?' + getParams;
      }
    }
    request(method, viewName, body, callback);
  }

  // Expose the public API
  return {
    get: get,
    save: save,
    remove: remove,
    changes: changes,
    request: request,
    uri: uri,
    view: view
  };
}

module.exports = CouchClient;
