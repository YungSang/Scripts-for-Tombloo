models.register({
	name     : 'Google+',
	ICON     : 'http://ssl.gstatic.com/s2/oz/images/favicon.ico',
	HOME_URL : 'https://plus.google.com/',
	POST_URL : 'https://plus.google.com/u/0/_/sharebox/post/',
	sequence : 0,
	OZDATA_REGEX  : /<script>[\s\S]*?\bvar\s+OZ_initData\s*=\s*([{](?:(?=[\s\S]*?(?![}]\s*;[\s\S]*?<\/script>))[\s\S]*?[}]\s*;))[\s\S]*?<\/script>/i,
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
			var sandbox = Components.utils.Sandbox(self.HOME_URL);
			var result = Components.utils.evalInSandbox('var OZ_initData = ' + OZ_initData + ';', sandbox);
			return sandbox.OZ_initData;
		});
	},

	post : function(ps) {
		var self = this;

		if (!this.getAuthCookie()) {
			throw new Error(getMessage('error.notLoggedin'));
		}

		return this.getOZData().addCallback(function(oz) {
			self._post(ps, oz);
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

	_post : function(ps, oz) {
		var self = this;

		var spar = [];
		spar.push(ps.description);
		spar.push(this.getToken(oz));
		spar.push(null,null,null,null);

		var link = [];
		link.push(null,null,null);
		link.push(ps.item || ps.page);
		link.push(null);
		if (ps.type == 'video' && ps.itemUrl.match('youtube.com')) {
			var videoUrl = ps.itemUrl.replace(this.YOUTUBE_REGEX,
				'http://www.youtube.com/v/$1&hl=en&fs=1&autoplay=1');
			link.push([null,videoUrl,385,640]);
		}
		else {
			link.push(null);
		}
		link.push(null,null,null);
		if (ps.type == 'video' && ps.itemUrl.match('youtube.com')) {
			link.push([[null,ps.author,"uploader"]]);
		}
		else {
			link.push([]);
		}
		link.push(null,null,null,null,null);
		link.push(null,null,null,null,null,null);
		link.push(ps.body);
		link.push(null,null);
		if (ps.type == 'video') {
			link.push([null,ps.pageUrl,null,"application/x-shockwave-flash","video"]);
		}
		else {
			link.push([null,ps.pageUrl,null,"text/html","document"]);
		}
		link.push(null,null,null,null,null);
		link.push(null,null,null,null,null);
		link.push(null,null,null,null,null,null);
		if (ps.type == 'video' && ps.itemUrl.match('youtube.com')) {
			var imageUrl = ps.itemUrl.replace(this.YOUTUBE_REGEX,
				'http://ytimg.googleusercontent.com/vi/$1/default.jpg');
			link.push([[null,imageUrl,null,null],[null,imageUrl,null,null]]);
		}
		else {
			var imageUrl = '//s2.googleusercontent.com/s2/favicons?domain=' + createURI(ps.pageUrl).host
			link.push([[null,imageUrl,null,null],[null,imageUrl,null,null]]);
		}
		link.push(null,null,null,null,null);
		if (ps.type == 'video' && ps.itemUrl.match('youtube.com')) {
			link.push([[null,"youtube","http://google.com/profiles/media/provider"]]);
		}
		else {
			link.push([[null,"","http://google.com/profiles/media/provider"]]);
		}
		link = JSON.stringify(link);
		if (ps.type == 'photo') {
			var photo = [];
			photo.push(null,null,null,null,null);
			photo.push([null,ps.itemUrl]);
			photo.push(null,null,null);
			photo.push([]);
			photo.push(null,null,null,null,null);
			photo.push(null,null,null,null,null);
			photo.push(null,null,null,null);

			var mime = this.getMIMEType(ps.itemUrl);
			photo.push([null,ps.pageUrl,null,mime,"photo",null,null,null,null,null,null,null,null,null]);
			photo.push(null,null,null,null,null);
			photo.push(null,null,null,null,null);
			photo.push(null,null,null,null,null,null);
			photo.push([[null,ps.itemUrl,null,null],[null,ps.itemUrl,null,null]]);
			photo.push(null,null,null,null,null);
			photo.push([[null,"images","http://google.com/profiles/media/provider"]]);
			photo = JSON.stringify(photo);
			spar.push(JSON.stringify([link,photo]));
		}
		else {
			spar.push(JSON.stringify([link]));
		}

		spar.push(null);
		spar.push("{\"aclEntries\":[{\"scope\":{\"scopeType\":\"anyone\",\"name\":\"Anyone\",\"id\":\"anyone\",\"me\":true,\"requiresKey\":false},\"role\":20},{\"scope\":{\"scopeType\":\"anyone\",\"name\":\"Anyone\",\"id\":\"anyone\",\"me\":true,\"requiresKey\":false},\"role\":60}]}");
		spar.push(true,[],true,true,null,[],false,false);

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
	},

	getMIMEType : function(url) {
		switch (createURI(url).fileExtension) {
		case 'bmp' : return("image/bmp");
		case 'gif' : return("image/gif");
		case 'jpeg': return("image/jpeg");
		case 'jpg' : return("image/jpeg");
		case 'png' : return("image/png");
		}
		return("image/jpeg");
	}
});
