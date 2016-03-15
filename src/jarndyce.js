import 'babel-polyfill';

import Core from './core';
import Marked from 'marked';
import Mongoose from 'mongoose';
import Post from './post';
import Router from './router';
import Utils from './utils';

class Jarndyce {
	init (options) {
		let _options = Object.assign({}, options);
		try {
			_options = Utils.validate(_options, 'initOptions');
		} catch (error) {
			throw error;
		}
		const {
			app,
			mongoUri,
			urlMount
		} = _options;

		Mongoose.connect(mongoUri);
		app.use(urlMount, Router(this));
	}

	add (payload) {
		let _payload = Object.assign({}, payload);
		try {
			_payload = Utils.validate(_payload, 'addOptions');
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
	}

	getOne (slug) {
		if (typeof slug !== 'string') {
			return Promise.reject(new Error("Argument to Core.remove() must be a String"));
		}
		const query = Post.where({slug}).findOne();
		return query.exec();
	}

	getPage (options) {
		let _options = Object.assign({}, options);
		try {
			_options = Utils.validate(_options, 'pageQueryOptions');
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
	}

	remove (slug) {
		if (typeof slug !== 'string') {
			return Promise.reject(new Error("Argument to Core.remove() must be a String"));
		}
		const query = Post.where({slug}).findOneAndRemove();
		return query.exec();
	}
}

exports = module.exports = new Jarndyce();
