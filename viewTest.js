var CouchClient = require('./lib/couch-client');

var Meetings = CouchClient("http://hack:me@localhost:5984/meetings");

var designDoc = {
    '_id': '_design/all'
    , 'language': 'javascript'
    , 'views': {
        'all': {
            'map': (function(doc){
                emit(doc._id, doc)
            }).toString()
        }
    }
};

Meetings.view(Meetings.uri.pathname + '/_design/all/_view/all', function(err, result){
    if(!err || result)
        throw new Error('Fail. View is not in database, should have yielded an error.');
    
    Meetings.save(designDoc, function(err, result){
        if (err)
            throw err;
        
        Meetings.save({some: 'Document'}, function(err, result){
            if (err)
                throw err;
            
            Meetings.view('/meetings/_design/all/_view/all', function(err, result){
                if (err || !result){
                    throw new Error('Fail. View is in database but didn\'t yield any results');
                }
                if(result.rows.length != 1)
                    throw new Error('Fail. Wrong number of documents.');
                process.exit(0);
            });
        });
    });
});
