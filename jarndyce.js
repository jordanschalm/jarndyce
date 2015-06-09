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
var BLOG_URL_ROOT = '/blog/';
var METADATA_ROOT = './metadata/';
var BLOG_PAGE_ROOT = '/blog/page/';
var BLOG_TEMPLATE = './templates/blog.jade';
var STATIC_TEMPLATE = './templates/static.jade';
var HEADER_TEMPLATE = './templates/header.html';
var FOOTER_TEMPLATE = './templates/footer.html';

var TITLE_REGEX = /#\s*?(\b.*?)\n/;
var BLOG_IMAGE_REGEX = /\/blog\/(.*\.)(jpg|jpeg|png|tiff|gif|bmp)/i;

var VERBOSE = false;
var ALT_PORT = 3030;
var POSTS_PER_PAGE = 5;
var POSTS_IN_RSS = 25;
var CATEGORY_APPEARANCE_THRESHOLD = 1 / 100; // 1% of words
var MAX_CACHE_SIZE = 500;

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
var headerTemplate, footerTemplate, blogTemplate, staticTemplate;
cacheTemplates();
// Create an array that holds all blog posts in order from newest (0) to oldest (n-1).
var blogCache = [];
populateBlogCache();
// Create a reference for static pages (path, page)
var staticCache = {};
var staticCacheSize = populateStaticCache();
// Set up RSS
var feed = setupRSS();
var rssXML = feed.xml();

if(blogCache.length === 1)
	console.log('Jarndyce has detected and cached 1 blog post.');
else 
	console.log('Jarndyce has detected and cached ' + blogCache.length + ' blog posts.');
if(staticCacheSize === 1) 
	console.log('Jarndyce has detected and cached 1 static page.');
else
	console.log('Jarndyce has detected and cached ' + staticCacheSize + ' static pages.');

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

function send404(response) {
	// TODO Change this to send a custom HTML 404 message
	response.writeHead(404, {"Content-type" : "text/plain"});
	response.write("Error 404: Resource not found.");
	response.end();
}

function serveData(response, data, mimeType) {
	response.writeHead(200, {"Content-type" : mimeType});
	response.end(data);
}

/*	Serves a file from the STATIC_ROOT folder. First checks
 *	if the page is in the cache, if it is, the cached version is
 *	sent, otherwise, the file is read from disk and sent.
 *	path (String) - The path of the file to serve.
 */
function servePage(response, path) {
	if(isInCache(path)) {
		var page = staticCache[path]
		var jadeOptions = { 
			filename : page.title, 
			pretty : true,
			cache : true 
		};	
		var renderBlog = jade.compile(staticTemplate, jadeOptions);
		var jadeLocals = { 
			title : page.title ,
			content : page.content,
			header : headerTemplate,
			footer : footerTemplate
		};	
		var html = renderBlog(jadeLocals);
		serveData(response, html, "text/html");
	}
	else {
		readFile(path, function(data, err) {
			if(err) {
				console.log(err.code);
				send404(response);
			}
			else if(!data) {
				send404(response);
			}
			else {
				serveData(response, data, mime.lookup(path));
			}
		});
	}
}

/*	Serves an image from a blog post
 *	path (String)
 */
function serveBlogImage(response, path) {
	readFile(path, function(data, err) {
		if(err) {
			console.log(err.code);
			send404(response);
		}
		else if(!data) {
			send404(response)
		}
		else {
			serveData(response, data, mime.lookup(path));
		}
	});
}

/*	Serves an individual blog post with standard header and footer. The blog
 *	navigation controls are automatically added based on whether the 
 *	blog we are serving has earlier posts, later posts or both.
 *	post ({title, date, content, path, url})
 */
function serveBlogPost(response, post) {
	if(!post) {
		send404(response);
	}
	else {
		var posts = [post];
		var index = blogCache.indexOf(post);
		var jadeOptions = { 
			filename : post.title, 
			pretty : true,
			cache : true 
		};	
		var renderBlog = jade.compile(blogTemplate, jadeOptions);
		var jadeLocals = { 
			page : false, 
			olderBlogLink : false,
			newerBlogLink : false, 
			posts : posts,
			header : headerTemplate,
			footer : footerTemplate
		};	
		var html = renderBlog(jadeLocals);
		serveData(response, html, "text/html");
	}
}

/*	Serves a blog page with at most POSTS_PER_PAGE posts in order from
 *	most recent to least recent. The first post on the page is the
 *	(POSTS_PER_PAGE * (page - 1) + 1) most recent post. The last post is
 *	the (POSTS_PER_PAGE * page) most recent post or the least recent post.
 */
function serveBlogPage(response, page) {
	// Check that the requested page is valid
	if((page - 1) * POSTS_PER_PAGE >= blogCache.length && blogCache.length > 0) {
		if(VERBOSE) {
			console.log('Requested blog page ' + page + ' is invalid.');
		}
		send404(response);	// TODO custom 404 message indicating that the page is invalid
	}
	else {
		var posts = [];
		var start = (page - 1) * POSTS_PER_PAGE;
		var end = Math.min(page * POSTS_PER_PAGE, blogCache.length);
		for(var index = start; index < end; index++) {
			posts.push(blogCache[index]);
		}
		var olderBlogLink = false;
	 	var newerBlogLink = false;
		if(page > 1) {
			newerBlogLink = BLOG_PAGE_ROOT + String(page - 1);
		}
		if(page * POSTS_PER_PAGE < blogCache.length) {
			olderBlogLink = BLOG_PAGE_ROOT + String(page + 1);
		}
		var jadeOptions = {
			filename : page, 
			pretty : true,
			cache : true 
		};
		var renderBlog = jade.compile(blogTemplate, jadeOptions);
		var jadeLocals = { 
			page : page, 
			olderBlogLink : olderBlogLink,
		  newerBlogLink : newerBlogLink, 
			posts : posts,
			header : headerTemplate,
			footer : footerTemplate
		};
		var html = renderBlog(jadeLocals);
		serveData(response, html, "text/html");
	}
}

/************************/
/* CACHE INITIALIZATION */
/************************/

/*	First, searches the METADATA_ROOT directory non-recursively and loads
 *  any pre-existing blog posts into the blog cache. Second, searches
 *	the BLOG_PATH_ROOT directory recursivle and loads any *new* blog posts
 *	into the cache and creates an entry for the new blog post in the archive.
 */
function populateBlogCache() {
	var archive = readDirectory(METADATA_ROOT, false);
	var metadata = loadMetadata(archive);
	var blog = readDirectory(BLOG_PATH_ROOT, true);
	loadBlog(blog, metadata);
}

/*	Searches the STATIC_ROOT directory NON-recursively and
 *	populates the staticCache with any HTML files found.
 *	Returns the number of static pages cached.
 */
function populateStaticCache() {
	var staticCacheSize = 0;
	var pages = readDirectory(STATIC_ROOT, false);
	for(var index = 0; index < pages.length; index++) {
		if(pages[index].match(/.*\.md/)) {
			var page = {};
			page.content = String(readFileSync(pages[index]));
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
	headerTemplate = String(readFileSync(HEADER_TEMPLATE));
	footerTemplate = String(readFileSync(FOOTER_TEMPLATE));
	blogTemplate = String(readFileSync(BLOG_TEMPLATE));
	staticTemplate = String(readFileSync(STATIC_TEMPLATE));
}

/********************/
/* HELPER FUNCTIONS */
/********************/

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
	if(VERBOSE) 
		console.log('Added ' + size + ' most recent posts to RSS feed');
	return feed;
}

/*	Loads all blogs into the blog cache. If a blog post does not have
 *	a metadata file associated with it, creates the metadata file.
 *	blog( Array[String] ) - an array of paths to all files in the 
 *		BLOG_PATH_ROOT directory and sub-directories
 *	metadata( Object{String : Object} ) - a dictionary matching post
 *		titles to objects containing post metadata
 */
function loadBlog(blog, metadata) {
	for(var index = 0; index < blog.length; index++) {
		var path = blog[index];
		if(path.match(/.*\.md$/)) {
			var content = String(readFileSync(path));
			var title = content.match(TITLE_REGEX)[1];
			// If we have metadata for the post, load it.
			if(metadata[title]) {
				blogCache.push(loadPost(content, metadata[title]));
			}
			// Otherwise, first create the post, then load it.
			else {
				blogCache.push(createPost(content, title, path));
			}
		}
	}
	// Sort the blog cache in chronological order
	blogCache.sort(function(a,b) {
		if(a.timeStamp && b.timeStamp)
			return b.timeStamp - a.timeStamp;
		else
			return Date.parse(b.date) - Date.parse(a.date);
	});
}

/*	Creates a metadata object for each file. Returns a dictionary
 *	Object{String : Object} that matches post titles to an object
 *	containing their metadata.
 *	archive (Array[String]) - an array of paths to all files in 
 *		the METADATA_ROOT directory
 */
function loadMetadata(archive) {
	var metadata = {};
	if(archive) {
		for(var index = 0; index < archive.length; index++) {
			var path = archive[index];
			if(path.match(/.*\.JSON$/)) {
				var postMetadata = JSON.parse(String(readFileSync(path)));
				metadata[postMetadata.title] = postMetadata;
			}
		}
	}
	return metadata;
}

/*	Creates a post object with metadata, saves the metadata to 
 *	the archive, and returns the post object.
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
	writeFile(METADATA_ROOT + post.title + '.JSON', JSON.stringify(post, null, ' '));
	post.content = marked(postContent);
	return post;
}

/*	Loads a post object that already has metadata and returns it.
 *	content (String)
 *	metadata (Object)
 */
function loadPost(content, metadata) {
	var post = metadata;
	post.content = marked(content.replace(TITLE_REGEX, ''));
	return post;
}

/*	Determines which of the global category keywords the given 
 *	post contains often enough to justify the post listing the
 *	category.
 *	postContent (String)
 */
function inferCategories(postContent) {
	var categories = [];
	var words = postContent.split(' ').length;
	var globalCategories = jarndyce.rss.categories;
	for(var index = 0; index < globalCategories.length; index++) {
		var appearances = postContent.match(globalCategories[index]);
		if(appearances) {
			appearances = appearances.length;
			if(appearances / words < CATEGORY_APPEARANCE_THRESHOLD) {
				categories.push(globalCategories[index]);
			}
		}
	}
	return categories;
}

/*	Checks whether or not a file in the ./static/ directory is
 *	in the static cache. Returns true if the file with the given
 *	path is in the static cache, false otherwise.
 *	path (String)
 */
function isInCache(path) {
	if(staticCache[path] != null) {
		return true;
	}
	return false;
}

/*	Returns a nice-looking date string of the form “Month Day, Year”. 
 *	For example, “January 4, 2015”.
 *	timeStamp (Integer) - number of milliseconds since Jan. 1 1970
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

/*	Searches the cache of blog posts and returns the one with
 *	the given title.
 *	title (String)
 */
function lookupPostByTitle(title) {
	for(var i = 0; i < blogCache.length; i++) {
		if(blogCache[i].title === title) {
			return blogCache[i];
		}
	}
	return false;
}

/*	Searchs the directory at the given path and returns the paths
 *	of all non-hidden files. If recursive = true, it will return 
 *	the paths of all non-hidden files in any subdirectories as well.
 *	NOTE: currently just eats any FS errors that may occur
 *	path (String)
 *	recursive (Boolean)
 */
function readDirectory(path, recursive) {
	var files = false;
	try {
		files = fs.readdirSync(path);
	}	catch (err) {
			console.log('An error occurred while reading the directory at path ' + path + '. Code: ' + err.code);
	}
	if(files) {
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
}

/*	Reads the file at the specified path, if it exists, and
 *	returns the contents of the file. This function is used
 *	for initialization when we want things to happen sync.
 *	NOTE: currently just eats any FS errors that may occur
 *	path (String)
 */
function readFileSync(path) {
	if(fs.existsSync(path)) {
		try {
			var data = fs.readFileSync(path);
			return data;
		} catch (err) {
			console.log('An error occurred while reading the file at path ' + path + '. Code: ' + err.code);
		}
	}
	else {
		console.log('The file at path: ' + path + ' does not exist');
	}
}

/*	Reads the file at the specified path, if it exists, and
 *	returns the contents of the file. This function is used
 *	after initialization is complete when we want things to
 *	happen synchronously.
 *	NOTE: Currently eats FS errors
 *	path (String)
 *	callback (function) - Has a single parameter, the data
 *	that was read from the file, and the error if one was
 *	thrown.
 */
function readFile(path, callback) {
	fs.exists(path, function(exists) {
		if(exists) {
			fs.readFile(path, function(err, data) {
				if(err) {
					callback(data, err);
				}
				else {
					callback(data);
				}
			});
		}
		else {
			callback(false);
		}
	});
}

/*	Writes a file to disk.
 *	path, data (String)
 */
function writeFile(path, data) {
	fs.open(path, 'w', function(err, fd) {
		fs.write(fd, data, function(err, written, string) {
			if(err) {
				console.log('An error occurred while archiving a new blog post. Code: ' + err.code);
			}
		});
	});
}

/***********/
/* ROUTING */
/***********/

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
	// Replace -'s in the URL with spaces
	var title = request.params.title;
	serveBlogPost(response, lookupPostByTitle(title));
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