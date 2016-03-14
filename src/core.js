import Marked from 'marked';
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
	add: (payload) => {
		try {
			payload = Utils.validate(payload, 'addOptions');
		} catch (error) {
			// If validation fails return a rejected Promise
			return Promise.reject(error);
		}

		const post = new Post({
			body: payload.type === 'html' ? payload.body : Marked(payload.body),
			title: payload.title,
			slug: payload.slug || Utils.sluggify(payload.title)
		});

		return post.save();
	},

	getOne: (slug) => {
		if (typeof slug !== 'string') {
			return Promise.reject(new Error("Argument to Core.remove() must be a String"));
		}
		const query = Post.where({slug}).findOne();
		return query.exec();
	},

	getPage: (options) => {
		try {
			options = Utils.validate(options, 'pageQueryOptions');
		} catch (error) {
			// If validation fails, return a rejected Promise
			return Promise.reject(error);
		}
		const {offset, pageSize} = options;

		const query = Post.where({})
			.sort({created: -1})
			.skip(pageSize * offset)
			.limit(pageSize);
		return query.exec();
	},

	remove: (slug) => {
		if (typeof slug !== 'string') {
			return Promise.reject(new Error("Argument to Core.remove() must be a String"));
		}
		const query = Post.where({slug}).findOneAndRemove();
		return query.exec();
	}
};
