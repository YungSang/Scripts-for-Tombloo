/**
 * Model.Twitter Upload for Tombloo
 *
 * @version : 1.3
 * @date    : 2013-08-11
 * @author  : YungSang (http://yungsang.com/+)
 *
 * [Tombloo]: https://github.com/to/tombloo/wiki
 */
(function() {
	var TWITTER_MODEL_NAME = 'Twitter';

	addAround(models[TWITTER_MODEL_NAME], 'check', function(proceed, args) {
		var ps = args[0], result = proceed(args);
		if (!result && ps) {
			result = /(?:regular|photo|quote|link|conversation|video)/.test(ps.type);
		}
		return result;
	});

	addAround(models[TWITTER_MODEL_NAME], 'post', function(proceed, args, self) {
		var ps = args[0];
		if (ps.type === 'photo') {
			return self.download(ps).addCallback(function(file) {
				return self.upload(ps, file);
			});
		}
		return proceed(args);
	});

	update(models[TWITTER_MODEL_NAME], {
		download : function(ps) {
			return (ps.file ? succeed(ps.file) : download(ps.itemUrl, getTempDir()));
		},
		upload : function(ps, file) {
			var self = this;
			var POST_URL = 'https://upload.twitter.com/i/tweet/create_with_media.iframe';

			var status = joinText([ps.description, (ps.body)? '"' + ps.body + '"' : '', ps.item, ps.pageUrl], ' ');

			return maybeDeferred((status.length < 140) ?
				status : shortenUrls(status, models[this.SHORTEN_SERVICE])
			).addCallback(function(shortend) {
				status = shortend;
				return self.getToken();
			}).addCallback(function(token) {
				var bis = new BinaryInputStream(IOService.newChannelFromURI(createURI(file)).open());

				return request(POST_URL, {
					sendContent : {
						status                  : status,
						'media_data[]'          : btoa(bis.readBytes(file.fileSize)),
						iframe_callback         : 'window.top.swift_tweetbox_tombloo',
						post_authenticity_token : token.authenticity_token
					},
					headers : {
						Referer : self.URL
					}
				}).addCallback(function(res) {
					var html = res.responseText;
					var json = html.extract(/window.top.swift_tweetbox_tombloo\((\{.+\})\);/);
					json = JSON.parse(json);
				}).addErrback(function(e) {
					var res  = e.message;
					var html = res.responseText;
					var json = html.extract(/window.top.swift_tweetbox_tombloo\((\{.+\})\);/);
					json = JSON.parse(json);
					throw new Error(json.error);
				});
			});
		}
	});
})();