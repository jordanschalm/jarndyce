import Mongoose from 'mongoose';

/**
	Initiate an instance of Jarndyce with the given options
	@param {Object} options
		* mongoUri {String} - URI of database to connect to
*/
export default function (options) {
	if (!options) options = {};

	// Instantiate MongoDB
	const mongoUri = options.mongoUri
		|| process.env.MONGO_URI
		|| 'mongodb://localhost/jarndyce';

	Mongoose.connect(mongoUri);
	this.db = Mongoose.connection;
}
