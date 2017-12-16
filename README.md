
# Dissentr

## Overview


It seems that even though the Internet has given individuals access to more information than at any other point in history, and yet our discourse has never been more churlish, more insipid, or more asinine. Many have pointed to a 'like culture' which has taken root in highly networked communities. The critics of this culture take it as a given of online living, but I disagree.

Dissentr set out to prove that the quality of our discourse is the direct result of the complexity of our ability to express approval or disapproval. Put simply, Dissentr is a content platform like Facebook, Reddit, Instagram, or Tumblr with one key difference: _there are no likes_. Instead, posts are ranked acording to the number and length of comments on them. Content that does not foster larger discussion will therefore not do well on Dissentr. Hopefully, this helps build communities around big questions, with lively discussion of how to solve them.

If Reddit is for funny memes, Dissentr is for thoughtful memes.

## To Use

1. Start by making an account
  * Pick a username and password
2. A new board will be generated for you -- it will have the same name as your username
  * You can access boards by /board/board_name
3. Make a new post on the board
  * Posts can be:
    - links
    - text posts
    - image posts
4. Make a reply to your post
  * Note: you may only reply to a post once. This is intentional -- it encourages you to use your comments wisely.
  * Similarly, you may only reply to a reply once as well
5. Follow your board. Now posts from that board will appear in your feed
6. Go to your feed
  * here you will see posts from all the boards that you follow
  * posts are ordered by number of replies to them -- crucially, only top level replies count towards the total, any lower level replies are used in ordering replies
7. Make a new board
  * you can make as many boards as you like
  * boards must have unique names
  * you will automatically be made the moderator of that board, but it will not go into your feed

## Data Model

The application will store Users, Boards, and Posts

* users can have multiple lists (via references)
* each list can have multiple items (by embedding)


An Example User Document:

```javascript
{
  username: "davidissident",
  hash: // a password hash,
  email: // a valid email for the user
  boards: // an array of references to Board documents that this user moderates
  posts: //an array of references to posts that this user has made
}
```

An Example Board Document:

```javascript
{
  moderators: // an array of references to User documents
  name: "Democrats", // this.name must be unique : if this is a personal board then this.moderators will have only one entry, and this.moderators[0].username === this.name
  posts: // an array of references to posts whose replyto atribute === this.name
}
```

An Example Post Document:

```javascript
{
  replyto: // a reference to either a post document or a board document
  author: // a reference to a user document who made the post
  contentType: // 'img', 'txt', or 'lnk'
  title: // a string title for the post
  content:
    // if this.contentType == 'img' : a string holding a link to the file location in /public
    // if this.contentType == 'txt' : a string with the text of the post
    // if this.contentType == 'lnk' : a string with the external link
  replies: // an array of references to post documents where this.replies[n].replyto === reference to this
  private: // boolean : if this post is private or not
}
```

## [Link to Commented First Draft Schema](/documentation/db.js)


## Wireframes

/feed - page for viewing a board's feed

![feed](/documentation/feed.png)

/login - page for logging in

![list](/documentation/login.png)

## Site map
Page 1:
![flow page 1](/documentation/Disentr-Flow-pg1.gif)
Page2:
![flow page 2](/documentation/Disentr-Flow-pg2.gif)

## User Stories or Use Cases

1. as non-registered user, I can register a new account with the site
2. as a user, I can log in to the site
3. as a user, I can create a new board
4. as a user, I can create a new post
5. as a user, I can view all of posts I've created in a single list
6. as a user, I can comment on a post
7. as a user, I can reply to comments
8. as a user, I can edit posts

## Research Topics

* (1 points) use slugs for posts
* (3 points) using ES6 promises as mongoose's promise library
* (5 points) integrate user authentication
* (2 points) use external API
  - used [linkpreview](https://www.linkpreview.net/) to fetch thumbnails for link posts
* (2 points) responsive design
  - used media queries, and changing grids to change layout of site for mobile clients

12 points total out of 8 required points (___TODO__: addtional points will __not__ count for extra credit_)


## [Link to Initial Main Project File](app.js)

(___TODO__: create a skeleton Express application with a package.json, app.js, views folder, etc. ... and link to your initial app.js_)

## Annotations / References Used

(___TODO__: list any tutorials/references/etc. that you've based your code off of_)

1. [passport.js authentication docs](http://passportjs.org/docs) - (add link to source code that was based on this)
2. [tutorial on vue.js](https://vuejs.org/v2/guide/) - (add link to source code that was based on this)
