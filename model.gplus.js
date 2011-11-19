/**
 * Model.Google+ for Tombloo
 *
 * @version : 3.1
 * @date    : 2011-11-17
 * @author  : YungSang (http://yungsang.com/+)
 *
 * [Tombloo]: https://github.com/to/tombloo/wiki
 *
 * Special Thanks to polygon planet (https://github.com/polygonplanet)
 */
(function() {
	var GOOGLE_PLUS_MODEL_NAME = 'Google+';

	models.register({
		name     : GOOGLE_PLUS_MODEL_NAME,
		ICON     : 'http://ssl.gstatic.com/s2/oz/images/favicon.ico',
		HOME_URL : 'https://plus.google.com/',
		INIT_URL : 'https://plus.google.com/u/0/_/initialdata',
		POST_URL : 'https://plus.google.com/u/0/_/sharebox/post/',
		sequence : 0,
		YOUTUBE_REGEX : /http:\/\/(?:.*\.)?youtube.com\/watch\?v=([a-zA-Z0-9_-]+)[-_.!~*'()a-zA-Z0-9;\/?:@&=+\$,%#]*/g,

		check : function(ps) {
			return (/(regular|photo|quote|link|video)/).test(ps.type);
		},

		getAuthCookie : function() {
			return getCookieString('plus.google.com', 'SSID').split('=').pop();
		},

		getOZData : function() {
			var self = this;
			return this.getInitialData(1).addCallback(function(oz1) {
				return self.getInitialData(2).addCallback(function(oz2) {
					return {'1': oz1, '2': oz2};
				});
			});
		},

		getInitialData : function(key) {
			var self = this;
			return request(this.INIT_URL + '?' + queryString({
				key    : key,
				_reqid : this.getReqid(),
				rt     : 'j'
			})).addCallback(function(res) {
				var initialData = res.responseText.substr(4).replace(/(\\n|\n)/g, '');
				var data = evalInSandbox('(' + initialData + ')', self.HOME_URL);
				data = self.getDataByKey(data[0], 'idr');
				if (!data) return null;
				var data = evalInSandbox('(' + data[1] + ')', self.HOME_URL);
				return data[key];
			});
		},

		getDataByKey : function(arr, key) {
			for (var i = 0, len = arr.length ; i < len ; i++) {
				var data = arr[i];
				if (data[0] === key) {
					return data;
				}
			}
			return null;
		},

		getDefaultScope : function(oz) {
			var self = this;
			return this.getInitialData(11).addCallback(function(data) {
				data = evalInSandbox('(' + data[0] + ')', self.HOME_URL);

				var aclEntries = [];

				for (var i = 0, len = data['aclEntries'].length ; i < len ; i+=2) {
					var scope = data.aclEntries[i].scope;

					if (scope.scopeType == 'anyone') {
						aclEntries.push({
							scopeType   : "anyone",
							name        : "Anyone",
							id          : "anyone",
							me          : true,
							requiresKey : false
						});
					}
					else if (scope.scopeType != 'user') {
						aclEntries.push({
							scopeType   : scope.scopeType,
							name        : scope.name,
							id          : scope.id,
							me          : false,
							requiresKey : scope.requiresKey,
							groupType   : scope.groupType
						});
					}
				}

				return JSON.stringify(aclEntries);
			});
		},

		post : function(ps) {
			var self = this;

			if (!this.getAuthCookie()) {
				throw new Error(getMessage('error.notLoggedin'));
			}

			return this.getOZData().addCallback(function(oz) {
				return (ps.file ? self.upload(ps.file) : succeed(null)).addCallback(function(upload) {
					ps.upload = upload;
					return (ps.scope ? succeed(ps.scope) : self.getDefaultScope(oz)).addCallback(function(scope) {
						ps.scope = scope;
						return self._post(ps, oz);
					});
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
			if (ps.upload) {
				imageUrl = ps.upload.url;
			}

			var link = [];
			link.push(
				null, null, null,
				ps.upload ? '' : ps.item || ps.page,
				null,
				isYoutube ? [null, videoUrl, 385, 640] :
					ps.upload ? [null, ps.upload.url, ps.upload.height, ps.upload.width] : null,
				null, null, null,
				isYoutube ? [[null, ps.author || '', 'uploader']] : [],
				null, null, null, null, null,
				null, null, null, null, null, null,
				ps.body ? '&ldquo;' + toPlainText(getFlavor(ps.body, 'html')) + '&rdquo;' : '',
				null, null
			);
			switch (ps.type) {
			case 'video':
				link.push([null, ps.pageUrl, null, 'application/x-shockwave-flash', 'video']);
				break;
			case 'photo':
				if (ps.upload) {
					link.push([null, ps.upload.photoPageUrl, null, ps.upload.mimeType, 'image']);
				}
				else {
					link.push([null, ps.pageUrl, null, 'text/html', 'document']);
				}
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
				null, null, null, null, null
			);
			if (ps.upload) {
				link.push([
					[null, 'picasa', 'http://google.com/profiles/media/provider'],
					[
						null,
						queryString({
							albumid : ps.upload.albumid,
							photoid : ps.upload.photoid
						}),
						'http://google.com/profiles/media/onepick_media_id'
					]
				]);
			}
			else {
				link.push([
					[
						null,
						isYoutube ? 'youtube' : '',
						'http://google.com/profiles/media/provider'
					]
				]);
			}

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

		createScopeSpar : function(ps) {
			var aclEntries = [];

			var scopes = JSON.parse(ps.scope);

			for (var i = 0, len = scopes.length ; i < len ; i++) {
				aclEntries.push({
					scope : scopes[i],
					role  : 20
				});
				aclEntries.push({
					scope : scopes[i],
					role  : 60
				});
			}

			return JSON.stringify({
				aclEntries : aclEntries
			});
		},

		_post : function(ps, oz) {
			var self = this;

			var spar = [];
			spar.push(
				(ps.type != 'regular') ? ps.description : joinText([ps.item, ps.description], "\n\n"),
				this.getToken(oz),
				null,
				ps.upload ? ps.upload.albumid : null,
				null, null
			);

			var link = this.createLinkSpar(ps);

			if (ps.type == 'photo' && !ps.upload) {
				var photo = this.craetePhotoSpar(ps);
				spar.push(JSON.stringify([link, photo]));
			}
			else {
				spar.push(JSON.stringify([link]));
			}

			spar.push(null);
			spar.push(this.createScopeSpar(ps));
			spar.push(true, [], true, true, null, [], false, false);
			if (ps.upload) {
				spar.push(null, null, oz[2][0]);
			}

			spar = JSON.stringify(spar);

			return request(this.POST_URL + '?' + queryString({
				_reqid : this.getReqid(),
				rt     : 'j'
			}), {
				sendContent : {
					spar : spar,
					at   : oz[1][15]
				},
				headers : {
					Origin : self.HOME_URL
				}
			});
		},

		UPLOAD_URL : 'https://plus.google.com/_/upload/photos/resumable',

		openUploadSession : function(file) {
			var self = this;

			var data = {
				protocolVersion      : '0.8',
				createSessionRequest : {
					fields : [
						{
							external : {
								name     : 'file',
								filename : file.leafName,
								put      : {},
								size     : file.fileSize
							}
						},
						{
							inlined : {
								name        : 'batchid',
								content     : String(Date.now()),
								contentType : 'text/plain'
							}
						},
						{
							inlined : {
								name        : 'disable_asbe_notification',
								content     : 'true',
								contentType : 'text/plain'
							}
						},
						{
							inlined : {
								name        : 'streamid',
								content     : 'updates',
								contentType : 'text/plain'
							}
						},
						{
							inlined : {
								name        : 'use_upload_size_pref',
								content     : 'true',
								contentType : 'text/plain'
							}
						}
					]
				}
			};

			return request(this.UPLOAD_URL + '?authuser=0', {
				sendContent : JSON.stringify(data)
			}).addCallback(function(res) {
				var session = JSON.parse(res.responseText);
				if (session.sessionStatus) {
					return session;
				}
				return null;
			});
		},

		upload : function(file) {
			return this.openUploadSession(file).addCallback(function(session) {
				if (!session) return null;

				var bis = new BinaryInputStream(IOService.newChannelFromURI(createURI(file)).open());

				return request(session.sessionStatus.externalFieldTransfers[0].putInfo.url, {
					sendContent : bis.readBytes(file.fileSize)
				}).addCallback(function(res) {
					var session = JSON.parse(res.responseText);
					if (session.sessionStatus) {
						return session.sessionStatus
							.additionalInfo['uploader_service.GoogleRupioAdditionalInfo']
							.completionInfo.customerSpecificInfo;
					}
					return null;
				});
			});
		}
	});

	var circles = [];
	var presets = [];

	models[GOOGLE_PLUS_MODEL_NAME].getOZData().addCallback(function(oz) {
		models[GOOGLE_PLUS_MODEL_NAME].getInitialData(12).addCallback(function(data) {
			if (data) {
				data[0].forEach(function(circle) {
					let code, id, name, has;
					code = circle[0][0];
					id   = [oz[2][0], code].join('.');
					name = circle[1][0];
					if (code && name) {
						has = false;
						circles.forEach(function(c) {
							if (!has && c[0].id === id) {
								has = true;
							}
						});
						if (!has) {
							circles.push([{
								scopeType   : 'focusGroup',
								name        : name,
								id          : id,
								me          : false,
								requiresKey : false,
								groupType   : 'p'
							}]);
						}
					}
				});
			}

			presets.push([{
				scopeType   : 'focusGroup',
				name        : 'Your circles',
				id          : [oz[2][0], '1c'].join('.'),
				me          : false,
				requiresKey : false,
				groupType   : 'a'
			}]);
			presets.push([{
				scopeType   : 'focusGroup',
				name        : 'Extended circles',
				id          : [oz[2][0], '1f'].join('.'),
				me          : false,
				requiresKey : false,
				groupType   : 'e'
			}]);
			presets.push([{
				scopeType   : 'anyone',
				name        : 'Anyone',
				id          : 'anyone',
				me          : true,
				requiresKey : false
			}]);
		});
	});

	QuickPostForm.show = function(ps, position, message) {
		var winQuickPostForm = openDialog(
			'chrome://tombloo/content/quickPostForm.xul',
			'chrome,alwaysRaised=yes,resizable=yes,dependent=yes,titlebar=no', ps, position, message);

		if (!models[GOOGLE_PLUS_MODEL_NAME].check(ps)) return;

		winQuickPostForm.onload = function() {
			var doc = winQuickPostForm.document;
			var selectBox = SELECT({name : 'scope', style: 'font-size:1em'});

			appendChildNodes(selectBox, OPTION({value: ''}, 'Select Google+ Stream (or same as last one)'));

			for (var i = 0, len = presets.length ; i < len ; i++) {
				var preset = presets[i];
				appendChildNodes(selectBox, OPTION({value: JSON.stringify(preset)}, preset[0].name));
			}

			var optGroup = OPTGROUP({label : 'Stream'});
			for (var i = 0, len = circles.length ; i < len ; i++) {
				var circle = circles[i];
				appendChildNodes(optGroup, OPTION({value: JSON.stringify(circle)}, circle[0].name));
			}
			appendChildNodes(selectBox, optGroup);
			appendChildNodes(doc.getElementById('form'), selectBox);

			var formPanel = winQuickPostForm.dialogPanel.formPanel;
			formPanel.dialogPanel.sizeToContent();
			formPanel.fields['scope'] = selectBox;
		};
	};

/**
 * The following functions are adopted
 * from polygon planet (https://github.com/polygonplanet)
 */
/**
 * HTMLテキストをプレーンテキストに変換 (一部のタグは残す)
 *
 * ポスト時に殆どのタグは除去されるため改行を合わせる
 *
 * @param  {String}   text   対象のテキスト
 * @return {String}          変換したテキスト
 *
 */
function toPlainText(text) {
    let s, p, tags, restores, re, br, indent;
    s = stringify(text);
    if (s) {
        re = {
            nl    : /(\r\n|\r|\n)/g,
            bold  : /<strong\b([^>]*)>([\s\S]*?)<\/strong>/gi,
            space : /^[\u0009\u0020]+/gm,
            split : /\s+/
        };
        br = function(a) {
            return a.trim().replace(re.nl, '<br />$1');
        };
        indent = function(a) {
            return a.trim().replace(re.space, function(m) {
                return new Array(m.length + 1).join('&nbsp;');
            });
        };
        // <strong>は無視されるため <b> に変換
        s = indent(s).replace(re.bold, '<b$1>$2</b>');
        tags = stringify(<>
            a b strong s strike kbd em acronym
            q blockquote ins del sub sup u dfn
            i abbr cite font img ruby rb rt rp
        </>).trim().split(re.split);
        p = '';
        do {
            p += '~' + Math.random().toString(36).slice(-1);
        } while (~s.indexOf(p));
        restores = [];
        tags.forEach(function(tag) {
            let re;
            if (~s.indexOf(tag)) {
                re = new RegExp('</?' + tag + '\\b[^>]*>', 'gi');
                s = s.replace(re, function(match) {
                    let len = restores.length, from = p + len + p;
                    restores[len] = {
                        from : from,
                        to   : match
                    };
                    return from;
                });
            }
        });
        // リスト(<li>)などを整形するためconvertToPlainTextを使用する
        s = convertToPlainText(s);
        // 保持したタグを元に戻す
        if (restores && restores.length) {
            restores.forEach(function(o) {
                s = s.split(o.from).join(o.to);
            });
        }
        s = br(indent(s));
    }
    return s;
}

// ----- Helper functions -----
/**
 * スカラー型となりうる値のみ文字列として評価する
 *
 * @param  {Mixed}   x   任意の値
 * @return {String}      文字列としての値
 */
function stringify(x) {
    let result = '', c;
    if (x !== null) {
        switch (typeof x) {
            case 'string':
            case 'number':
            case 'xml':
                result = x;
                break;
            case 'boolean':
                result = x ? 1 : '';
                break;
            case 'object':
                if (x) {
                    c = x.constructor;
                    if (c === String || c === Number) {
                        result = x;
                    } else if (c === Boolean) {
                        result = x ? 1 : '';
                    }
                }
                break;
            default:
                break;
        }
    }
    return result.toString();
}

})();