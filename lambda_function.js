// from https://gist.github.com/supinf/e66fd36f9228a8701706
console.log('Loading event');

var Q = require('q');
var aws = require('aws-sdk');
var cloudfront = new aws.CloudFront();

exports.handler = function (event, context) {
  //_log('Received event: ', event);

  var bucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;
  console.log('Bucket: '+bucket);
  console.log('Key: '+key);

  cloudfront.listDistributions({}, function (err, data) {
    var promises = [];
    if (err) {
      _log('Error: ', err);
      context.done('error', err);
      return;
    }

    // Find a bucket which uses the backet as a origin.
    data.Items.map(function (distribution) {
      var deferred = Q.defer();
      var exists = false;

      distribution.Origins.Items.map(function (origin) {
        if (exists) return;

        if (origin.DomainName.indexOf(bucket) === 0) {
          exists = true;
          var name = distribution.DomainName;
          if (distribution.Aliases.Quantity > 0) {
            name = distribution.Aliases.Items[0];
          }
          console.log('Distribution: ' + distribution.Id + ' ('+ name + ')');

          // Parameters for a invalidation
          var params = {
            DistributionId : distribution.Id,
            InvalidationBatch : {
              CallerReference : '' + new Date().getTime(),
              Paths : {
                Quantity : 1,
                Items : [ '/'+key ]
              }
            }
          };
          _log('Params: ', params);

          // Invalidate
          cloudfront.createInvalidation(params, function (err, data) {
            if (err) {
              _log('Error: ', err);
              deferred.reject();
              return;
            }
            _log('Success: ', data.InvalidationBatch);
            deferred.resolve();
          });
        }
      });
      if (! exists) deferred.resolve();
      promises.push(deferred.promise);
    });
    Q.all(promises).then(function() {
      context.done(null, '');
    });
  });

  function _log(caption, object) {
    console.log(caption + JSON.stringify(object, true, '  '));
  }
};
