(function() {
	const YOUTUBE_VIDEO_NAME = 'Video - YouTube';
	const YOUTUBE_URL_REGEXP = /http:\/\/(?:.*\.)?youtube.com\/watch\?v=([a-zA-Z0-9_-]+)[-_.!~*'()a-zA-Z0-9;\/?:@&=+\$,%#]*/;

	update(Tombloo.Service.extractors[YOUTUBE_VIDEO_NAME], {
		check : function(ctx) {
			return ctx.href.match(YOUTUBE_URL_REGEXP);
		},
		extract : function(ctx) {
			ctx.title = ctx.title.replace(/[\n\r\t]+/gm, ' ').trim();
			var author_anchor = $x('id("watch-username")', ctx.document);
			return {
				type      : 'video',
				item      : $x('//meta[@property="og:title"]/@content') || ctx.title,
				itemUrl   : $x('//meta[@property="og:url"]/@content') || ctx.href,
				author    : author_anchor.textContent || '',
				authorUrl : author_anchor.href || ''
			};
		}
	});
})();