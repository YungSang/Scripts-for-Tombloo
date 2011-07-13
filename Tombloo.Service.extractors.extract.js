update(Tombloo.Service.extractors, {
	extract : function(ctx, ext){
		var doc = ctx.document;
		var self = this;

		// ドキュメントタイトルを取得する
		var title;
		if(typeof(doc.title) == 'string'){
			title = doc.title;
		} else {
			// idがtitleの要素を回避する
			title = $x('//title/text()', doc);
		}

		if(!title)
			title = createURI(doc.location.href).fileBaseName;

		ctx.title = title.trim();

		// canonicalが設定されていれば使う
		var canonical = $x('//link[@rel="canonical"]/@href', doc);
		if(canonical)
			ctx.href = resolveRelativePath(canonical, ctx.href);

		return withWindow(ctx.window, function(){
			return maybeDeferred(ext.extract(ctx)).addCallback(function(ps){
				ps = update({
					page    : ctx.title,
					pageUrl : ctx.href,
				}, ps);

				if (!ps.body && ctx.selection) {
					ps.body  = createFlavoredString(ctx.window.getSelection());
				}

				return self.normalizeUrl(ps.itemUrl).addCallback(function(url){
					ps.itemUrl = url;
					return ps;
				});
			});
		});
	},
})
