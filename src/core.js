import Post from './models/Post';
import Utils from './utils';

export default {
	/**
		Add a post to Jarndyce
		@param {Object} payload
			* body {String}
			* created {Date}
			* format {'markdown'|'html'}
			* slug {String}
			* title {String}
		@returns {Promise}
	*/
	add: (payload) {
		try {
			Utils.validate(payload, 'addOptions');
		} catch (error) {
			// If validation fails return a rejected promise
			return Promise.reject(error);
		}
		const post = new Post({
			body: payload.type === 'html' ? payload.body : Marked(payload.body),
			title: payload.title,
			slug: payload.slug || Utils.sluggify(payload.title)
		});

		return post.save()
			.then((doc) => {
				return doc;
			}, (err) => {
				return err;
			});
	},

	remove: (slug) {
		if (typeof slug !== 'string') {
			return Promise.reject(new Error("Argument to Core.remove() must be a String"));
		}
		return Post.find({slug}).remove().exex()
			.then((doc) => {
				return doc;
			}, (err) => {
				return err;
			});
	}
}
