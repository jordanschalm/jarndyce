# Jarndyce – Web Server & Blogging Software

## Installation

Make sure you have Node and NPM installed (http://nodejs.org)

Clone this repository into ./jarndyce:

git clone https://github.com/jordanschalm/jarndyce.git jarndyce

Resolve dependencies with npm:

cd jarndyce

npm install

Run vanilla Jarndyce:

node jarndyce.js

## Introduction
Jarndyce is a light-weight web server for sites with static pages (about, contact, etc.) and a blog.

## Static Pages
Static pages are kept in the static folder along with the favicon file, robots.txt file, etc. These pages are served using the **app.get(‘/:path/‘)** routing method. During initialization, HTML files found non-recursively in the ./static directory will be cached as static pages. These files should contain at least title metadata as this is used by the static.jade template file to generate standard titles. Standard headers (and footers if you add them) are generated by the Jade template so HTML files in the ./static folder should only contain page content. There are a few sample static pages included as examples.

## Blog Pages
The standard home page is the most recent blog page. Blog pages are collections of blog posts arranged by date from most to least recent. The number of blog posts per page can be changed using the POSTS_PER_PAGE symbolic constant (the default is 5). Blog posts can also be accessed individually at www.yourdomain.com/blog/title. Titles in URLs have spaces replaced with dashes (-). Since blog posts are accessed individually by title, if two posts are uploaded with exactly the same title, only one will be individually accessible (they will still both be accessible through page navigation).

Blog post files must be placed in the ./blog folder. During initialization, Jarndyce will search this folder recursively for *.html files and add each one as a post object in memory with references to:

* Title
* Date
* HTML content
* Path on disk
* URL

When a blog page or blog post is requested, Jarndyce looks up the necessary post(s) and renders them with a Jade template which can be found at /templates/blog.jade. This template uses the title and date metadata to create a standardized title/date header above each post, so don’t include title or date headers after the metadata section of your blog post file!

Blog bodies must be in HTML format and must have at least the following header metadata: title, date. Data metadata must be parseable be Date.parse() in order for blogs to be properly ordered.

### Syntax Highlighting
The blog.jade template includes the necessary code to perform client-side syntax highlighting in code blocks using [Highlight.js](https://highlightjs.org “Highlight.js”). A link to the default highlighting stylesheet is included in the head.

### Images
Blog post files can be placed anywhere within the ./blog directory and so can image files, so long as they have the proper image suffix (that is how Express knows to treat them differently) and so long as they are properly linked to within a blog post file. For example, consider the following directory structure:

blog ———————— some_blog_post.html

         `——— an_image.jpg
         
				 `——— some_directory ———————— another_image.jpg

Within some_blog_post.html, we would access an_image:

<img src=“/blog/an_image.jpg”>

and another_image.jpg:

<img src=“/blog/some_directory/another_image.jpg”>

If you want to, you can have all of blog post HTML files and all of your blog post image files in the same directory, but it’s probably a good idea to keep all the files associated with each blog post in it’s own sub-directory of ./blog

## Metadata
Metadata sections are in JSON format and must be at the beginning of the file. Metadata sections do not support nested {…} sections but do support array values. Metadata keys are not case-sensitive and are accessible as a post object key in lowercase. An example metadata section looks like the following:

{ “Title” : “An Intimate Look At Basket Weaving”,

  “date” : “June 2, 2015”,

  “catEGOries” : [“Basket Weaving”, “Investigative Journalism”]

This translates to:

post.title = “An Intimate Look At Basket Weaving”;

post.date = “June 2, 2015”;

post.categories = [“Basket Weaving”, “Investigative Journalism”];

## Templating
Jarndyce uses [Jade](http://jade-lang.com “Jade”) for templating. Two very basic sample templates are included, one for blogs and one for static pages.

## Plans For Future Versions

Jarndyce is currently functional but feature-poor. Some features I plan to add include:
* A standard stylesheet for distributions of Jarndyce that includes a footer and looks acceptable
* Support for some sort of post categorization system, category links below each post, and viewing lists of posts by category.

## Change Log

### 1.0.0
June 2
Initial Release
Features:
* code syntax highlighting support
* RSS support
* support for caching blog/static HTML content & metadata on launch
