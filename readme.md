# Jarndyce – Web Server & Blogging Engine

## Introduction
Jarndyce is a light-weight web server for sites with static pages (about, contact, etc.) and a blog. It uses Markdown for content, HTML for standard page elements like headers and footers, and Jade for templating.

## Installation
Make sure you have Node and NPM installed (http://nodejs.org)

Clone this repository into ./jarndyce:

`git clone https://github.com/jordanschalm/jarndyce.git jarndyce`

Resolve dependencies with npm:

`cd jarndyce`

`npm install`

Run vanilla Jarndyce:

`node jarndyce`

You can specify a port number, otherwise Jarndyce will default to the symbolic constant ALT_PORT:

`node jarndyce [port #]`

## Usage
To customize your site’s appearance:
* add a site.css file in /static/resources/
* alter the provided blog.jade and static.jade templates

If you are using RSS or would like to take advantage of Jarndyce’s auto-categorization (see Metadata), change the RSS settings portion of the package.json file.

To add static pages, simply place the Markdown file in the /static/ directory and add a link to it somewhere in the Jade templates, the header or the footer to make it easily accessible.

To add a blog post, simply place the blog post Markdown file in the /blog/ directory and jarndyce will automatically add it to the /blog page of your website.

Once everything looks good, it is easy to deploy to Heroku using this [tutorial](https://devcenter.heroku.com/articles/deploying-nodejs “Heroku Node.js tutorial”).

## Static Pages
Static pages are kept in the static folder and are served using the app.get(‘/:slug‘) routing method. During initialization, Markdown files found *non-recursively* in the /static/ directory will be cached as static pages. These files should contain a standard title header (see Metadata). There are a few sample static pages included as examples.

## Blog Pages
The standard home page is the most recent blog page. Blog pages are collections of blog posts arranged by date from most to least recent. The number of blog posts per page can be changed using the POSTS_PER_PAGE symbolic constant (the default is 5). Blog posts can also be accessed individually at www.yourdomain.com/blog/title. Since blog posts are accessed individually by title, if two posts are uploaded with exactly the same title, only one will be individually accessible (they will still both be accessible through page navigation).

Blog post files must be placed in the /blog/ directory. During initialization, Jarndyce will *first* search the /archive/ directory for JSON files containing previously added blogs and their respective metadata. It then adds these to the blog cache. Then Jarndyce will search the /blog/ directory for Markdown files and, if a file does not already exist in the archive, Jarndyce will create a post object from the file, add the post object to the blog cache, and add the post as a JSON file in the archive. Post objects contain:

* Title (see Metadata)
* Content (excluding the title)
* Time stamp (see Metadata)
* Date (see Metadata)
* Categories (see Metadata)
* Path on disk
* URL

When a blog page or blog post is requested, Jarndyce looks up the necessary post(s) and renders them with a Jade template which can be found at /templates/blog.jade. This template uses the standard title header and initialization time stamp (see Metadata) to create a standardized title/date header above each post.

### Syntax Highlighting
The blog.jade template includes the necessary code to perform client-side syntax highlighting in code blocks using [Highlight.js](https://highlightjs.org “Highlight.js”). A link to the default highlighting stylesheet is included in the head.

### Images
Blog post files can be placed anywhere within the /blog/ directory and so can image files, so long as they have the proper image suffix (that is how the Express routing rules decide to treat them differently).

If you want to, you can have all of blog Markdown files and all of your blog image files in the same directory, but it’s probably a good idea to keep all the files associated with each blog post in its own sub-directory of /blog/.

## Metadata
Jarndyce tries to minimize the amount of metadata required in blog posts. The only metadata you need to explicitly specify in both blog posts and static pages is the title, which is formatted as a standard Markdown title.
This at the top of a file:

\# A Blog Post Title

Is equivalent to:

post.title = “A Blog Post Title”

In addition to title, Jarndyce supports date, time-stamp, and categories metadata for blog posts. 

When a new blog post is added, Jarndyce notes the current time and adds that as a timeStamp metadata item in the post’s JSON file in the archive. The timeStamp is used to chronologically order blog posts.

The date metadata item is a nice-looking date string of the form “Month Day, Year”. For example, “January 4, 2015”. The date is parsed from the timeStamp when a blog is added to the archive.

The categories metadata is also determined when a blog post is first added. Jarndyce looks at your blog’s global categories (which are specified in the RSS section of package.json and are available with jarndyce.rss.categories) and determines which of these the current post satisfies. Specifically, Jarndyce determines whether (instances of a category keyword) / (total number of words) > CATEGORY_APPEARANCE_THRESHOLD. If a given global category keyword appears often enough in the current blog post, that keyword is added to the posts categories metadata. The default value of CATEGORY_APPEARANCE_THRESHOLD is 1%. This method of determining category metadata is imprecise, but I chose it because it allows Jarndyce to completely dispose of metadata in the actual blog post files.

If you need to alter any of the metadata for a blog post that has already been added to the archive, you can do so by simply editing the JSON file in the /archive/ directory.

## Markdown
Jarndyce uses [Marked](https://github.com/chjj/marked "Marked") for Markdown to HTML conversion. Marked includes a 'smartypants' option which nicely formats double and triple dashes and single and double quotes, however in the version on their repository, dashes and quotes are converted to Unicode characters instead of HTML codes. If you have any en/em dashes or fancy quote marks, make sure you specify the HTML charset to be UTF-16 otherwise your content will be littered with garbage characters. The default charset for the blog.jade and static.jade templates is UTF-16.

## Templating
Jarndyce uses [Jade](http://jade-lang.com “Jade”) for templating. Two very basic sample templates are included, one for blogs and one for static pages.

## Plans For Future Versions
Jarndyce is currently functional but feature-poor. Some features I plan to add include:
* A standard stylesheet for distributions of Jarndyce that includes a footer and looks acceptable
* Support for some sort of post categorization system, category links below each post, and viewing lists of posts by category


## Known Issues
* Currently Jarndyce will cache ALL detected blog posts and ALL detected static pages no matter how many there are. For a site with a large archive, this could lead to Jarndyce crashing during initialization

## Change Log

### 1.1.0
More Markdown, No More Metadata - June 5, 2015

* Completely removed metadata system from 1.0 and replaced it with a system that infers or calculates metadata, rather than reading it from an ugly header (see Metadata for more details)
* Added archive folder where posts are stored the first time they are added to Jarndyce
* Blog and static files must now be in Markdown format
* Added support for standard HTML headers and footers
* Added support for caching templates at launch

### 1.0.1 
Bug Fixes - June 3, 2015

* Made filesystem operations after initialization thread-friendly
* Added licence header speal to jarndyce.js
* Added ability to specify port as a commandline argument (node jarndyce [port #])
* Fixed an issue where serveBlogImage would cause a request to hang when a filesystem error occurred
* Added support for an optional blog metadata item, timeStamp, which is used for finer-grain chronological sorting whereas the data item is used as a nicely formatted date string
* Fixed a bug that would generate bad URLs in Older/Newer blog page navigation
* Changed blog URLs so that spaces are left in instead of being converted to '-'s. This fixes a bug where blog titles with '-'s had broken URLs

### 1.0.0
Initial Release - June 2, 2015

* RSS support
* Support for caching blog/static HTML content & metadata on launch

## License
Copyright Jordan Schalm 2015 (GPL v3)  
See LICENSE for more details
