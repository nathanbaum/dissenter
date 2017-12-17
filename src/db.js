// db.js
const mongoose = require('mongoose');
const urlSlugs = require('mongoose-url-slugs');
const ObjectID = mongoose.Schema.Types.ObjectId;

//my schema goes here!
const User = new mongoose.Schema({
  username: String,
  hash: String, // a password hash
  email: String,
  notifications: [{message: String, link: String}],
  boards: [{type: ObjectID, ref: 'Board'}], // an array of references to Board documents that this user follows
  mods: [{type: ObjectID, ref: 'Board'}], // an array of references to Board documents that this user moderates
  posts: [{type: ObjectID, ref: 'Post'}] // an array of references to posts that this user has made
}, { usePushEach: true });

const Board = new mongoose.Schema({
  moderators: [{type: ObjectID, ref: 'User'}], // an array of references to User documents
  blacklist: [{type: ObjectID, ref: 'User'}], // array of references to users banned from posting on this board
  name: String, // this.name must be unique : if this is a personal board then this.moderators will have only one entry, and this.moderators[0].username === this.name
  posts: [{type: ObjectID, ref: 'Post'}], // an array of references to posts whose replyto atribute === this.name
  archive: [{type: ObjectID, ref: 'Post'}] //an array of old posts -- posts here will always show up after those in this.posts
}, { usePushEach: true });

const Post = new mongoose.Schema({
  replyto: {type: ObjectID, ref: 'Post'}, // a reference to either a post document or a board document
  author: {type: ObjectID, ref: 'User'}, // a reference to a user document who made the post
  contentType: { type: String, enum: ['img', 'txt', 'lnk']}, // 'img', 'txt', or 'lnk'
  title: String,
  content: String,
    // if this.contentType == 'img' : a string holding a link to the file location in /public
    // if this.contentType == 'txt' : a string with the text of the post
    // if this.contentType == 'lnk' : a string with the external link
  replies: [{type: ObjectID, ref: 'Post'}], // an array of references to post documents where this.replies[n].replyto === reference to this
  open: Boolean // boolean : if this post is open to the public or not
}, { usePushEach: true });

Post.plugin(urlSlugs('title'));

mongoose.model('User', User);
mongoose.model('Board', Board);
mongoose.model('Post', Post);

let dbconf = null;
// is the environment variable, NODE_ENV, set to PRODUCTION?

console.log('Starting in mode:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'PRODUCTION') {
 // if we're in PRODUCTION mode, then read the configration from a file
 // use blocking file io to do this...
 const fs = require('fs');
 const path = require('path');
 const fn = path.join(__dirname, 'config.json');
 const data = fs.readFileSync(fn);

 // our configuration file will be in json, so parse it and set the
 // conenction string appropriately!
 const conf = JSON.parse(data);
 dbconf = conf.dbconf;
} else {
 // if we're not in PRODUCTION mode, then use
 dbconf = 'mongodb://localhost/nb2255';
}

mongoose.connect(dbconf, {useMongoClient: true});
