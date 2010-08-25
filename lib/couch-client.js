var Http = require('http'),
    Url = require('url');

function CouchClient(url) {
  var uri = Url.parse(url);
  var server = Http.createClient(uri.port || 5984, uri.hostname);
  var revCache = {};
  
  // A simple wrapper around node's http client.
  function request(method, path, body, callback) {
    // Body is optional
    if (typeof body === 'function' && typeof callback === 'undefined') {
      callback = body;
      body = undefined;
    }
    var headers = {
      "Host": uri.host
    };
    if (body) {
      body = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(body);
      headers["Content-Type"] = "application/json";
    }
    var request = server.request(method, path, headers);
    if (body) {
      request.write(body, 'utf8');
    }
    request.end();

    request.on('response', function (response) {
      response.setEncoding('utf8');
      var body = "";
      response.on('data', function (chunk) {
        body += chunk;
      });
      response.on('end', function () {
        callback(null, JSON.parse(body));
      });
      response.on('error', callback);
    });
    request.on('error', callback);
  }
  
  // Requests UUIDs from the couch server in tick batches
  var uuidQueue = [];
  function getUUID(callback) {
    uuidQueue.push(callback);
    if (uuidQueue.length > 1) return;
    process.nextTick(function () {
      var pending = uuidQueue.splice(0);
      console.log("Bulk getting UUIDs %s", pending.length);
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
    });
  }
  
  // Saves documents in batches
  var saveValues = [];
  var saveQueue = [];
  function realSave(doc, callback) {
    // Put key and rev on the value without changing the original
    saveValues.push(doc);
    saveQueue.push(callback);
    if (saveQueue.length > 1) return;
    process.nextTick(function () {
      var pending = saveQueue.splice(0);
      var body = saveValues.splice(0);
      console.dir(body);
      console.log("Bulk saving %s", body.length);
      request("POST", uri.pathname + "/_bulk_docs", {docs: body}, function (err, results) {
        console.dir(results);
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
    });
  }
  
  var getQueue = [];
  var getKeys = [];
  function realGet(key, includeDoc, callback) {
    getKeys.push(key);
    getQueue.push(callback);
    if (getQueue.length > 1) return;
    process.nextTick(function () {
      var pending = getQueue.splice(0);
      var keys = getKeys.splice(0);
      var path = uri.pathname + "/_all_docs";
      if (includeDoc) path += "?include_docs=true";
      console.log("Bulk Getting %s documents", keys.length);
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
          if (includeDoc) {
            if (result.error) {
              pending[i](new Error("CouchDB Error: " + JSON.stringify(result)));
              return;
            }
            if (!result.doc) {
              var err = new Error("Document not found for " + JSON.stringify(result.key));
              err.errno = process.ENOENT;
              pending[i](err);
              return;
            }
            pending[i](null, result.doc);
            return;
          }
          pending[i](null, result.value);
        });
      });
    });
  }

  
  function save(doc, callback) {
    if (doc._id) {
      if (!doc._rev) {
        if (!revCache.hasOwnProperty(doc._id)) {
          realGet(doc._id, false, function (err, result) {
            if (err) return callback(err);
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

  // Expose the public API
  return {
    get: get,
    save: save,
    remove: remove,
    request: request
  };
}

module.exports = CouchClient;