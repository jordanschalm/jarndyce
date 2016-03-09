import Mongoose from 'mongoose';

const Post = Mongoose.Schema({
	body: {
		type: String,
		required: true
	},
	created: {
		type: Date,
		default: Date.now()
	},
	title: String,
	url: {
		type: String,
		required: true
	}
});

export default Mongoose.Model('Post', Post);
