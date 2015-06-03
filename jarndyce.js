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

// Paths
var STATIC_ROOT = './static/';
var RESOURCE_ROOT = './static/resources/';
var BLOG_ROOT = './blog/';
var BLOG_PAGE_ROOT = './blog/page/';
var BLOG_TEMPLATE = './templates/blog.jade';
var STATIC_TEMPLATE = './templates/static.jade';
// Regexes
var METADATA_SECTION_REGEX = /\{(.|\n)*?\}/
var BLOG_IMAGE_REGEX = /\/blog\/(.*\.)(jpg|jpeg|png|tiff|gif|bmp)/i;

var VERBOSE = false;
var ALT_PORT = 3030;
var POSTS_PER_PAGE = 5;
var POSTS_IN_RSS = 25;

/******************/
/* INITIALIZATION */
/******************/

var fs = require('fs');
var rss = require('rss');
var http = require('http');
var mime = require('mime');
var jade = require('jade');
var express = require('express');
var jarndyce = require('./package.json');

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

// Add a HTTP header to all responses							
var app = express();
app.use(function (request, response, next) {
	response.header('X-powered-by', 'Jarndyce v' + jarndyce.version);
	next();
});
// Listen on the port assigned by Heroku or command line argument or ALT_PORT
var server = http.createServer(app).listen(process.env.PORT || process.argv[2] || ALT_PORT, function() {
	console.log('Jarndyce v' + jarndyce.version + ' running on port: %s', server.address().port);
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
		var renderBlog = jade.compileFile(STATIC_TEMPLATE, jadeOptions);
		var jadeLocals = { 
			title : page.title ,
			content : page.content
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
		var renderBlog = jade.compileFile(BLOG_TEMPLATE, jadeOptions);
		var jadeLocals = { 
			page : false, 
			olderBlogLink : false,
			newerBlogLink : false, 
			posts : posts 
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
		console.log('Requested blog page ' + page + ' is invalid.');
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
		var renderBlog = jade.compileFile(BLOG_TEMPLATE, jadeOptions);
		var jadeLocals = { 
			page : page, 
			olderBlogLink : olderBlogLink,
		  newerBlogLink : newerBlogLink, 
			posts : posts 
		};
		var html = renderBlog(jadeLocals);
		serveData(response, html, "text/html");
	}
}

/************************/
/* CACHE INITIALIZATION */
/************************/

/*	Searches the BLOG_ROOT directory recursively, populates the 
 *	blog post cache array, and sorts the array from most recent 
 *	[0] to least recent [n-1].
 */
function populateBlogCache() {
	var posts = false;
	posts = readDirectory(BLOG_ROOT, true);
	if(posts) {
		for(var index = 0; index < posts.length; index++) {
			if(posts[index].match(/.*\.html/)) {
				var fileContents = String(readFileSync(posts[index]));
				var post = JSON.parse(fileContents.match(METADATA_SECTION_REGEX)[0]);
				post.path = posts[index];
				post.url = BLOG_ROOT + post.title;
				post.content = fileContents.replace(METADATA_SECTION_REGEX, '');
				if(post.title && post.date) {
					blogCache.push(post);
				}
				else {
					console.log('A post at path ' + post.path + ' did not have properly formatted metadata');
				}
			}
		}
		// After all posts have been read, sort from newest to oldest
		blogCache.sort(function(a,b) {
			if(a.timeStamp && b.timeStamp)
				return Date.parse(b.timeStamp) - Date.parse(a.timeStamp);
			else
				return Date.parse(b.date) - Date.parse(a.date);
		});
	}
}

/*	Searches the STATIC_ROOT directory NON-recursively and
 *	populates the staticCache with any HTML files found.
 *	Returns the number of static pages cached.
 */
function populateStaticCache() {
	var staticCacheSize = 0;
	var pages = readDirectory(STATIC_ROOT, false);
	for(var index = 0; index < pages.length; index++) {
		if(pages[index].match(/.*\.html/)) {
			var fileContents = String(readFileSync(pages[index]));
			var page = JSON.parse(fileContents.match(METADATA_SECTION_REGEX)[0]);
			page.content = fileContents.replace(METADATA_SECTION_REGEX, '');
			staticCache[pages[index]] = page;
			staticCacheSize++;
		}
	}	
	return staticCacheSize;
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
			author : blogCache[index].author || jarndyce.rss.author
		});
	}
	if(VERBOSE) 
		console.log('Added ' + size + ' most recent posts to RSS feed');
	return feed;
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

/*	Checks whether or not a file in the ./root/ directory is
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

/***********/
/* ROUTING */
/***********/

app.get('/', function(request, response) {
	response.redirect('/blog');
});

app.get(BLOG_IMAGE_REGEX, function(request, response) {
	var path = BLOG_ROOT + request.params[0] + request.params[1];
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
		// If necessary, append a '.html' suffix
		path = STATIC_ROOT + request.params.slug + '.html';
	}
	servePage(response, path);
});

app.get('/resources/:res', function(request, response) {
	servePage(response, RESOURCE_ROOT + request.params.res);
});