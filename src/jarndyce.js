import 'babel-polyfill';

import Mongoose from 'mongoose';
import Router from './router';

class Jarndyce {
	/**
		Initiate an instance of Jarndyce with the given options
		@param {Object} options
			* app {Object} - instance of Express
			* mongoUri {String} - URI of database to connect to
	*/
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

	remove (slug) {
		return Core.remove(slug);
}

exports = module.exports = new Jarndyce();
