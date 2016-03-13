import Mongoose from 'mongoose';

const Post = new Mongoose.Schema({
	body: {
		type: String,
		required: true
	},
	created: {
		type: Date,
		default: Date.now()
	},
	slug: {
		type: String,
		required: true
	},
	title: {
		type: String,
		required: true
	}
});

export default Mongoose.model('Post', Post);
