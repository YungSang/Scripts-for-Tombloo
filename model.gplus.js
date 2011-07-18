/**
 * Model.Google+ for Tombloo
 *
 * @version : 2.0.2
 * @date    : 2011-07-18
 * @author  : YungSang (http://topl.us/yungsang)
 *
 * [Tombloo]: https://github.com/to/tombloo/wiki
 */
models.register({
	name     : 'Google+',
	ICON     : 'http://ssl.gstatic.com/s2/oz/images/favicon.ico',
	HOME_URL : 'https://plus.google.com/',
	INIT_URL : 'https://plus.google.com/u/0/_/initialdata',
	POST_URL : 'https://plus.google.com/u/0/_/sharebox/post/',
	sequence : 0,
	OZDATA_REGEX : /<script\b[^>]*>[\s\S]*?\btick\b[\s\S]*?\bvar\s+OZ_initData\s*=\s*([{]+(?:(?:(?![}]\s*;[\s\S]{0,24}\btick\b[\s\S]{0,12}<\/script>)[\s\S])*)*[}])\s*;[\s\S]{0,24}\btick\b[\s\S]{0,12}<\/script>/i,
	YOUTUBE_REGEX : /http:\/\/(?:.*\.)?youtube.com\/watch\?v=([a-zA-Z0-9_-]+)[-_.!~*'()a-zA-Z0-9;\/?:@&=+\$,%#]*/g,

	check : function(ps) {
		return (/(regular|photo|quote|link|video)/).test(ps.type) && !ps.file;
	},

	getAuthCookie : function() {
		return getCookieString('plus.google.com', 'SSID').split('=').pop();
	},

	getOZData : function() {
		var self = this;
		return request(this.HOME_URL).addCallback(function(res) {
			var OZ_initData = res.responseText.match(self.OZDATA_REGEX)[1];
			return evalInSandbox('(' + OZ_initData + ')', self.HOME_URL);
		});
	},

	getInitialData : function(oz) {
		var self = this;
		return request(this.INIT_URL + '?_reqid=' + this.getReqid() + '&rt=j', {
			method : 'POST',
			redirectionLimit : 0,
			sendContent : {
				key : 11,
				at  : oz[1][15]
			}
		}).addCallback(function(res) {
			var initialData = res.responseText.substr(4).replace(/(\\n|\n)/g, '');
			return evalInSandbox('(' + initialData + ')', self.HOME_URL);
		});
	},

	getScopeData : function(oz) {
		var self = this;
		return this.getInitialData(oz).addCallback(function(data) {
			data = evalInSandbox('(' + data[0][0][1] + ')', self.HOME_URL);
			data = evalInSandbox('(' + data[11][0] + ')', self.HOME_URL);
			return data;
		});
	},

	post : function(ps) {
		var self = this;

		if (!this.getAuthCookie()) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		return this.getOZData().addCallback(function(oz) {
			self.getScopeData(oz).addCallback(function(scope) {
				self._post(ps, oz, scope);
			});
		});
	},

	getReqid : function() {
		var sequence = this.sequence++;
		var now = new Date;
		var seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
		return seconds + sequence * 1E5;
	},

	getToken : function(oz) {
		return 'oz:' + oz[2][0] + '.' + Date.now().toString(16) + '.' + this.sequence.toString(16);
	},

	createLinkSpar : function(ps) {
		if (ps.type == 'regular') {
			return JSON.stringify([]);
		}

		var isYoutube = (ps.type == 'video' && ps.itemUrl.match(this.YOUTUBE_REGEX));
		var videoUrl = '';
		var imageUrl = '//s2.googleusercontent.com/s2/favicons?domain=' + createURI(ps.pageUrl).host;
		if (isYoutube) {
			videoUrl = ps.itemUrl.replace(this.YOUTUBE_REGEX,
				'http://www.youtube.com/v/$1&hl=en&fs=1&autoplay=1');
			imageUrl = ps.itemUrl.replace(this.YOUTUBE_REGEX,
				'http://ytimg.googleusercontent.com/vi/$1/default.jpg');
		}

		var link = [];
		link.push(
			null, null, null,
			ps.item || ps.page,
			null,
			isYoutube ? [null, videoUrl, 385, 640] : null,
			null, null, null,
			isYoutube ? [[null, ps.author, 'uploader']] : [],
			null, null, null, null, null,
			null, null, null, null, null, null,
			ps.body,
			null, null
		);
		switch (ps.type) {
		case 'video':
			link.push([null, ps.pageUrl, null, 'application/x-shockwave-flash', 'video']);
			break;
		case 'photo':
			link.push([null, ps.pageUrl, null, 'text/html', 'document']);
			break;
		default:
			link.push([null, ps.itemUrl || ps.pageUrl, null, 'text/html', 'document']);
		}
		link.push(
			null, null, null, null, null,
			null, null, null, null, null,
			null, null, null, null, null, null,
			[
				[null, imageUrl, null, null],
				[null, imageUrl, null, null]
			],
			null, null, null, null, null,
			[[
				null,
				isYoutube ? 'youtube' : '',
				'http://google.com/profiles/media/provider'
			]]
		);

		return JSON.stringify(link);
	},

	craetePhotoSpar : function(ps) {
		var mime = this.getMIMEType(ps.itemUrl);
		return JSON.stringify([
			null, null, null, null, null,
			[null, ps.itemUrl],
			null, null, null,
			[],
			null, null, null, null, null,
			null, null, null, null, null,
			null, null, null, null,
			[
				null, ps.pageUrl, null, mime, 'photo',
				null, null, null, null, null, null, null, null, null
			],
			null, null, null, null, null,
			null, null, null, null, null,
			null, null, null, null, null, null,
			[
				[null, ps.itemUrl, null, null],
				[null, ps.itemUrl, null, null]
			],
			null, null, null, null, null,
			[
				[null, 'images', 'http://google.com/profiles/media/provider']
			]
		]);
	},

	getMIMEType : function(url) {
		switch (createURI(url).fileExtension) {
		case 'bmp' : return('image/bmp');
		case 'gif' : return('image/gif');
		case 'jpeg': return('image/jpeg');
		case 'jpg' : return('image/jpeg');
		case 'png' : return('image/png');
		}
		return('image/jpeg');
	},

	createScopeSpar : function(scope) {
		var publicScope = {
			scopeType   : "anyone",
			name        : "Anyone",
			id          : "anyone",
			me          : true,
			requiresKey : false
		};

		var aclEntries = [];

		for (var i = 2, len = scope['aclEntries'].length ; i < len ; i+=2) {
			if (scope['aclEntries'][i]['scope']['scopeType'] == 'anyone') {
				aclEntries.push({
					scope : publicScope,
					role  : 20
				});
				aclEntries.push({
					scope : publicScope,
					role  : 60
				});
			}
			else {
				var limitedScope = {
					scopeType   : scope['aclEntries'][i]['scope']['scopeType'],
					name        : scope['aclEntries'][i]['scope']['name'],
					id          : scope['aclEntries'][i]['scope']['id'],
					me          : false,
					requiresKey : scope['aclEntries'][i]['scope']['requiresKey'],
					groupType   : scope['aclEntries'][i]['scope']['groupType']
				};
				aclEntries.push({
					scope : limitedScope,
					role  : 20
				});
				aclEntries.push({
					scope : limitedScope,
					role  : 60
				});
			}
		}

		return JSON.stringify({
			aclEntries : aclEntries
		});
	},

	_post : function(ps, oz, scope) {
		var self = this;

		var spar = [];
		spar.push(
			(ps.type != 'regular') ? ps.description : joinText([ps.item, ps.description], "\n\n"),
			this.getToken(oz),
			null, null, null, null
		);

		var link = this.createLinkSpar(ps);

		if (ps.type == 'photo') {
			var photo = this.craetePhotoSpar(ps);
			spar.push(JSON.stringify([link, photo]));
		}
		else {
			spar.push(JSON.stringify([link]));
		}

		spar.push(null);
		spar.push(this.createScopeSpar(scope));
		spar.push(true, [], true, true, null, [], false, false);

		spar = JSON.stringify(spar);

		return request(this.POST_URL + '?_reqid=' + this.getReqid() + '&rt=j', {
			method : 'POST',
			redirectionLimit : 0,
			sendContent : {
				spar : spar,
				at   : oz[1][15]
			},
			headers : {
				Origin : self.HOME_URL
			}
		}).addCallback(function(res) {
			return res.responseText;
		});
	}
});
