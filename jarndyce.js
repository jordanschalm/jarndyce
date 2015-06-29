/* Copyright Jordan Schalm 2015
 *
 * This program is distributed under the terms of the GNU General Public License.
 * 
 * This file is part of Jarndyce.
 *
 * Jarndyce is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Jarndyce is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Jarndyce.  If not, see <http://www.gnu.org/licenses/>.
 */

/*************/
/* CONSTANTS */ 
/*************/

var STATIC_ROOT = './static/';
var RESOURCE_ROOT = './static/resources/';
var BLOG_PATH_ROOT = './blog/';
var METADATA_ROOT = './metadata/';
var BLOG_TEMPLATE = './templates/blog.jade';
var STATIC_TEMPLATE = './templates/static.jade';

var BLOG_URL_ROOT = '/blog/';
var BLOG_PAGE_URL_ROOT = '/blog/page/';

var TITLE_REGEX = /#\s*?(\b.*?)\n/;
var BLOG_IMAGE_REGEX = /\/blog\/(.*?\.)(jpg|jpeg|png|tiff|gif|bmp)/i;

var VERBOSE = false;
var ALT_PORT = 3030;
var POSTS_PER_PAGE = 5;
var POSTS_IN_RSS = 25;
var MAX_CACHE_SIZE = 500;
var CATEGORY_APPEARANCE_THRESHOLD = 1 / 100; // 1% of words

/******************/
/* INITIALIZATION */
/******************/

var fs = require('fs');
var rss = require('rss');
var http = require('http');
var mime = require('mime');
var jade = require('jade');
var marked = require('marked').setOptions({
	smartypants: true
});
var express = require('express');
var jarndyce = require('./package.json');

// Find and cache templates
var blogTemplate, staticTemplate;
cacheTemplates();
// Create an array that holds all blog posts in order from newest (0) to oldest (n-1).
var numArchivedPosts, numNewPosts;
var blogCache = [];
populateBlogCache(function(archived, added) {
	numArchivedPosts = archived;
	numNewPosts = added;
});
// Create a reference for static pages (path, page)
var staticCache = {};
var staticCacheSize = populateStaticCache();
// Set up RSS
var feed = setupRSS();
var rssXML = feed.xml();

logStatus();

// Add an HTTP header to all responses							
var app = express();
app.use(function (request, response, next) {
	response.header('X-powered-by', 'Jarndyce v' + jarndyce.version);
	next();
});
// Listen on the port assigned by Heroku or command line argument or ALT_PORT
var server = http.createServer(app).listen(process.env.PORT || process.argv[2] || ALT_PORT, function() {
	console.log('Jarndyce v' + jarndyce.version + ' running on port: %s', server.address().port);
}).on('error', function(err) {
	if(err.code === 'EADDRINUSE') {
		console.log('Port ' + (process.env.PORT || process.argv[2] || ALT_PORT) + ' is in use. Exiting...');
	}
});

if(VERBOSE) {
	server.addListener('request', function(request) {
		console.log('Request received for ' + request.url + ' from UA ' + request.headers['user-agent']);
	});
}

/*****************/
/* SERVING PAGES */
/*****************/

/*	Sends a 404 HTTP response.
 */
function send404(response, message) {
	response.writeHead(404, {"Content-type" : "text/plain"});
	response.write(("Error 404: " + message) || "Error 404: Resource not found.");
	response.end();
}

/*	Generic function to serve some data to a client.
 *
 *	data, mimeType (String)
 */
function serveData(response, data, mimeType) {
	response.writeHead(200, {"Content-type" : mimeType});
	response.end(data);
}

/*	Serves a file from the STATIC_ROOT folder or the cache, if
 *	posible. Sends a 404 response if the requested file does not
 *	exist or if an error occurs while reading the file.
 *
 *	path (String)
 */
function servePage(response, path) {
	// If it's in the static cache, render and serve a Jade template
	if(isInStaticCache(path)) {
		var page = staticCache[path]
		var jadeOptions = { 
			filename : page.title, 
			pretty : true,
			cache : true 
		};	
		var render = jade.compile(staticTemplate, jadeOptions);
		var jadeLocals = { 
			title : page.title,
			content : page.content
		};	
		var html = render(jadeLocals);
		serveData(response, html, "text/html");
	}
	// Otherwise, read and serve the required file.
	else {
		readFile(path, function(err, data) {
			if(err) {
				console.log(err);
				send404(response);
			}
			else {
				serveData(response, data, mime.lookup(path));
			}
		});
	}
}

/*	Serves an image from a blog post. Sends a 404 response
 *	if an error occurs while reading the file.
 *
 *	path (String)
 */
function serveBlogImage(response, path) {
	readFile(path, function(err, data) {
		if(err) {
			console.log(err);
			send404(response);
		}
		else {
			serveData(response, data, mime.lookup(path));
		}
	});
}

/*	Serves an individual blog post with standard header and 
 *	footer. Sends a 404 response if post is not defined.
 *	
 *	title (String)
 */
function serveBlogPost(response, title) {
	try {
		var post = lookupPostByTitle(title);
	}
	catch(err) {
		console.log(err);
		send404(response, 'No blog post with title ' + title + ' could be found.');
	}
	if(post) {
		var posts = [post];
		var html = renderBlog(posts, false);
		serveData(response, html, "text/html");
	}
}

/*	Serves a blog page with the given page number. If an
 *	invalid page number is given, sends a 404 response.
 *	
 *	path (String)
 */
function serveBlogPage(response, page) {
	// Check that the requested page is valid
	if((page - 1) * POSTS_PER_PAGE >= blogCache.length && blogCache.length > 0) {
		var message = 'Requested blog page ' + page + ' is invalid.'
		if(VERBOSE) {
			console.log(message);
		}
		send404(response, message);
	}
	else {
		var posts = [];
		var start = (page - 1) * POSTS_PER_PAGE;
		var end = Math.min(page * POSTS_PER_PAGE, blogCache.length);
		for(var index = start; index < end; index++) {
			posts.push(blogCache[index]);
		}
		var html = renderBlog(posts, page);
		serveData(response, html, "text/html");
	}
}

/************************/
/* CACHE INITIALIZATION */
/************************/

/*	First, searches the METADATA_ROOT directory non-recursively and 
 *	loads any pre-existing blog posts into the blog cache. Second,
 *	searches the BLOG_PATH_ROOT directory recursivle and loads any 
 *	new blog posts into the cache and creates an entry for the new
 *	blog post in the archive.
 *
 *	callback (function(Number, Number)) - passes the number of
 *		archived and new posts to the caller
 */
function populateBlogCache(callback) {
	try {
		var archive = readDirectory(METADATA_ROOT, false);
		var blog = readDirectory(BLOG_PATH_ROOT, true);
	}
	catch(err) {
		console.log(err);
	}
	var metadata = loadMetadata(archive);
	loadBlog(blog, metadata, function(err, numArchivedPosts, numNewPosts) {
		if(err) {
			console.log(err);
		}
		callback(numArchivedPosts, numNewPosts);
	});
}

/*	Searches the STATIC_ROOT directory NON-recursively and
 *	populates the staticCache with any HTML files found.
 *	Returns the number of static pages cached.
 */
function populateStaticCache() {
	var staticCacheSize = 0;
	try {
		var pages = readDirectory(STATIC_ROOT, false);
	}
	catch(err) {
		console.log(err);
	}
	for(var index = 0; index < pages.length; index++) {
		if(pages[index].match(/.*\.md/)) {
			var page = {};
			try {
				data = readFileSync(pages[index]);
			} 
			catch(err) {
				console.log(err);
			}
			page.content = String(data);
			page.title = page.content.match(TITLE_REGEX)[1];
			page.content = marked(page.content.replace(TITLE_REGEX, ''));
			staticCache[pages[index]] = page;
			staticCacheSize++;
		}
	}	
	return staticCacheSize;
}

/*	Caches all relevant template files in memory
 */
function cacheTemplates() {
	try {
		blogTemplate = String(readFileSync(BLOG_TEMPLATE));
		staticTemplate = String(readFileSync(STATIC_TEMPLATE));
	} 
	catch (err) {
		console.log(err);
	}
}

/********************/
/* HELPER FUNCTIONS */
/********************/

/*	Renders a blog page or blog post using the global template
 *	variables and returns a client-ready string in HTML.
 *	
 *	posts (Array<Post>) - an array of post objects that are to be
 *		rendered on the page
 *	page (Number) - the page number or false, if we are serving a
 *		single post
 */
function renderBlog(posts, page) {
	var olderBlogLink = false;
 	var newerBlogLink = false;
	if(page) {
		if(page > 1) {
			newerBlogLink = BLOG_PAGE_URL_ROOT + String(page - 1);
		}
		if(page * POSTS_PER_PAGE < blogCache.length) {
			olderBlogLink = BLOG_PAGE_URL_ROOT + String(page + 1);
		}
	}
	var jadeOptions = {
		filename: page || posts[0].title,
		pretty: true,
		cache: true
	};
	var render = jade.compile(blogTemplate, jadeOptions);
	var jadeLocals = {
		page: page,
		olderBlogLink: olderBlogLink,
		newerBlogLink: newerBlogLink,
		posts: posts
	}
	return render(jadeLocals);
}

/*	Adds POSTS_IN_RSS blog posts in the cache to the site's RSS feed
 *	All RSS info is pulled from the package.json file.
 */
function setupRSS() {
	var feed = new rss({
		title : jarndyce.rss.title,
		description : jarndyce.rss.description,
		feed_url : jarndyce.rss.feedURL,
		site_url : jarndyce.rss.siteURL,
		managingEditor : jarndyce.rss.managingEditor || jarndyce.rss.author,
		webMaster : jarndyce.rss.webMaster || jarndyce.rss.author,
		copyright : jarndyce.rss.copyright,
		language : jarndyce.rss.language,
		categories : jarndyce.rss.categories,
		pubDate : String(Date.now()),
		ttl : jarndyce.rss.ttl
	});
	var size = Math.min(POSTS_IN_RSS, blogCache.length);
	for(var index = 0; index < size; index++) {
		feed.item({
			title : blogCache[index].title,
			description : blogCache[index].content,
			url : blogCache[index].url,
			date : blogCache[index].date,
			categories : blogCache[index].categories,
			author : jarndyce.rss.author
		});
	}
	if(VERBOSE) {
		console.log('Added ' + size + ' most recent posts to RSS feed');
	}
	return feed;
}

/*	Creates a metadata object for each file. Returns a dictionary
 *	Object<String : Object> that matches post titles to an object
 *	containing their metadata.
 *
 *	archive (Array<String>) - an array of paths to all files in 
 *		the METADATA_ROOT directory
 */
function loadMetadata(archive) {
	var metadata = {};
	if(archive) {
		for(var index = 0; index < archive.length; index++) {
			var path = archive[index];
			if(path.match(/.*\.JSON$/)) {
				try {
					var data = readFileSync(path)
				}
				catch(err) {
					console.log(err);
				}
				var postMetadata = JSON.parse(String(data));
				metadata[postMetadata.title] = postMetadata;
			}
		}
	}
	return metadata;
}

/*	Loads all blogs into the blog cache. If a blog post does not have
 *	a metadata file associated with it, creates the metadata file.
 *
 *	blog( Array<String> ) - an array of paths to all files in the 
 *		BLOG_PATH_ROOT directory and sub-directories
 *	metadata( Object<String : Object> ) - a dictionary matching post
 *		titles to objects containing post metadata
 */
function loadBlog(blog, metadata, callback) {
	var numArchivedPosts = 0;
	var numNewPosts = 0;
	for(var index = 0; index < blog.length; index++) {
		var path = blog[index];
		if(path.match(/.*\.md$/)) {
			try {
				var data = readFileSync(path);
			}
			catch(err) {
				console.log(err);
			}
			var content = String(data);
			var title = content.match(TITLE_REGEX)[1];
			// If we have metadata for the post, load it.
			if(metadata[title]) {
				blogCache.push(loadPost(content, metadata[title]));
				numArchivedPosts++;
			}
			// Otherwise, first create the post, then load it.
			else {
				blogCache.push(createPost(content, title, path));
				numNewPosts++;
			}
		}
	}
	var err = null;
	if(numArchivedPosts < metadata.length) {
		err = new Error("One or more metadata files were found without matching post files.");
	}
	else if(numArchivedPosts > metadata.length) {
		err = new Error("Two or more posts with the same title were detected.");
	}
	// Sort the blog cache in chronological order
	blogCache.sort(function(a,b) {
		if(a.timeStamp && b.timeStamp)
			return b.timeStamp - a.timeStamp;
		else
			return Date.parse(b.date) - Date.parse(a.date);
	});
	callback(err, numArchivedPosts, numNewPosts);
}

/*	Creates a post object with metadata, saves the metadata to the
 *	archive, and returns the post object.
 *
 *	content, title, path (String)
 */
function createPost(content, title, path) {
	var post = {};
	var postContent = content.replace(TITLE_REGEX, '');
	post.title = title;
	post.timeStamp = Date.now();
	post.date = prettyDate(post.timeStamp);
	post.path = path;
	post.url = BLOG_URL_ROOT + post.title;
	post.categories = inferCategories(postContent);
	// Write metadata (not content) to the archive
	try {
		writeFile(METADATA_ROOT + post.title + '.JSON', JSON.stringify(post, null, ' '));
	}
	catch(err) {
		console.log(err);
	}
	post.content = marked(postContent);
	if(VERBOSE) 
		console.log("Created a new post with title " + post.title);
	return post;
}

/*	Loads a post object that already has metadata and returns it.
 *
 *	content (String)
 *	metadata (Object)
 */
function loadPost(content, metadata) {
	var post = metadata;
	post.content = marked(content.replace(TITLE_REGEX, ''));
	if(VERBOSE)
		console.log("Loaded an archived post with title " + post.title);
	return post;
}

/*	Determines which of the global category keywords the given 
 *	post contains often enough to justify the post listing the
 *	category.
 *
 *	postContent (String)
 */
function inferCategories(postContent) {
	var categories = [];
	var words = postContent.split(' ').length;
	var globalCategories = jarndyce.rss.categories;
	for(var index = 0; index < globalCategories.length; index++) {
		var appearances = postContent.match(globalCategories[index]);
		if(appearances && (appearances.length / words < CATEGORY_APPEARANCE_THRESHOLD)) {
			categories.push(globalCategories[index]);
		}
	}
	return categories;
}

/*	Checks whether or not a file in the ./static/ directory is
 *	in the static cache. Returns true if the file with the given
 *	path is in the static cache, false otherwise.
 *
 *	path (String)
 */
function isInStaticCache(path) {
	if(staticCache[path] != null) {
		return true;
	}
	return false;
}

/*	Returns a nice-looking date string of the form “Month Day, Year”. 
 *	For example, “January 4, 2015”.
 *
 *	timeStamp (Number) - number of milliseconds since Jan. 1 1970
 */
function prettyDate(timeStamp) {
	var months = ["January", "February", "March", "April", "May", "June", 
								"July", "August", "September", "October", "November", "December"];	
	var date = new Date(timeStamp);
	var year = date.getFullYear();
	var month = date.getMonth();
	var day = date.getDate();
	return months[month] + ' ' + String(day) + ', ' + String(year);
}

/*	Searches the cache of blog posts and returns the one with the
 *  given title.
 *
 *	title (String)
 */
function lookupPostByTitle(title) {
	for(var i = 0; i < blogCache.length; i++) {
		if(blogCache[i].title === title) {
			return blogCache[i];
		}
	}
	throw new Error('No blog post with title ' + title + ' could be found.');
}

/*	Prints a series of messages to the console indicating the number
 *	of blog posts and pages that have been cached.
 */
function logStatus() {
	if(VERBOSE) {
		if(numArchivedPosts === 1)
			console.log('Jarndyce has cached 1 archived blog post.');
		else
			console.log('Jarndyce has cached ' + numArchivedPosts + ' archived blog posts.');
		if(numNewPosts === 1) 
			console.log('Jarndyce has cached 1 new blog post.');
		else
			console.log('Jarndyce has cached ' + numNewPosts + ' new blog posts.');
	}
	if(blogCache.length === 1)
		console.log('Jarndyce has cached 1 total blog post.');
	else 
		console.log('Jarndyce has cached ' + blogCache.length + ' total blog posts.');
	if(staticCacheSize === 1) 
		console.log('Jarndyce has cached 1 static page.');
	else
		console.log('Jarndyce has cached ' + staticCacheSize + ' static pages.');
}

/**********************/
/* FILE I/O FUNCTIONS */
/**********************/

/*	Searchs the directory at the given path and returns the paths
 *	of all non-hidden files. If recursive = true, it will return 
 *	the paths of all non-hidden files in any subdirectories as well.
 *
 *	path (String)
 *	recursive (Boolean)
 */
function readDirectory(path, recursive) {
	var files = [];
	try {
		files = fs.readdirSync(path);
	}	
	catch (err) {
			throw err;
	}
	if(files.length > 0) {
		var notHidden = [];
		for(var index = 0; index < files.length; index++) {
			// Filter out hidden files
			if(!files[index].match(/^\..*/)) {
				if(fs.statSync(path + files[index]).isDirectory()) {
					if(recursive) {
						notHidden = notHidden.concat(readDirectory(path + files[index] + '/', true));
					}
				}
				else {
					notHidden.push(path + files[index]);
				}
			}
		}
		return notHidden;
	}
	else {
		throw new Error("The directory at path " + path + " is empty.");
	}
}

/*	Reads the file at the specified path, if it exists, and returns
 *	the contents of the file. This function is used for initialization
 *	when we want things to happen synchronously.
 *
 *	path (String)
 */
function readFileSync(path) {
	if(fs.existsSync(path)) {
		try {
			var data = fs.readFileSync(path);
			return data;
		} 
		catch (err) {
			throw err;
		}
	}
	else {
		throw new Error("The file at path " + path + " does not exist.");
	}
}

/*	Reads the file at the specified path, if it exists, and returns
 *	the contents of the file. This function is used after
 *	initialization is complete when we want things to happen
 *	asynchronously.
 *
 *	path (String)
 *	callback (function(err, data))
 */
function readFile(path, callback) {
	fs.exists(path, function(exists) {
		if(exists) {
			fs.readFile(path, function(err, data) {
				if(err) {
					callback(err, data);
				}
				else {
					callback(null, data);
				}
			});
		}
		else {
			callback(new Error("The file at path " + path + " does not exist."));
		}
	});
}

/*	Writes a file to disk.
 *
 *	path, data (String)
 */
function writeFile(path, data) {
	fs.open(path, 'w', function(err, fd) {
		fs.write(fd, data, function(err, written, string) {
			if(err) {
				callback(err, written, string);
			}
			else {
				callback(null, written, string);
			}
		});
	});
}

/*******************/
/* EXPRESS ROUTING */
/*******************/

app.get('/', function(request, response) {
	// Serve page 1 of the blog
	serveBlogPage(response, 1);
});

app.get(BLOG_IMAGE_REGEX, function(request, response) {
	var path = BLOG_PATH_ROOT + request.params[0] + request.params[1];
	serveBlogImage(response, path);
});

app.get('/blog', function(request, response) {
	// Serve page 1 of the blog
	serveBlogPage(response, 1);
});

app.get('/blog/page/:page', function(request, response) {
	serveBlogPage(response, request.params.page);
});

app.get('/blog/:title', function(request, response) {
	var title = request.params.title;
	serveBlogPost(response, title);
});

app.get('/rss', function(request, response) {
	serveData(response, rssXML, "text/xml");
});

app.get('/:slug', function(request, response) {
	var path;
	if(request.params.slug.match(/.*\..*/)) {
		// The path already has a suffix
		path = STATIC_ROOT + request.params.slug;
	}
	else {
		// If necessary, append a '.md' suffix
		path = STATIC_ROOT + request.params.slug + '.md';
	}
	servePage(response, path);
});

app.get('/resources/:res', function(request, response) {
	servePage(response, RESOURCE_ROOT + request.params.res);
});