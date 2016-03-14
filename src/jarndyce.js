import 'babel-polyfill';

import Core from './core';
import Mongoose from 'mongoose';
import Router from './router';
import Utils from './utils';

class Jarndyce {
	init (options) {
		if (Utils.validate(options, 'initOptions')) {
			const {
				app,
				mongoUri
			} = options;

			Mongoose.connect(mongoUri);
			app.use('/jarndyce', Router);
		}
	}

	add (payload) {
		return Core.add(payload);
	}

	get (slug) {
		return Core.get(slug);
	}

	getPage (options) {
		return Core.getPage(options);
	}

	remove (slug) {
		return Core.remove(slug);
	}
}

exports = module.exports = new Jarndyce();
