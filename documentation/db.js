// db.js
const mongoose = require('mongoose');
const ObjectID = mongoose.Schema.ObjectID;

//my schema goes here!
const User = new mongoose.Schema({
  username: String,
  hash: String, // a password hash
  email: String,
  boards: [ObjectID], // an array of references to Board documents that this user moderates
  posts: [ObjectID] // an array of references to posts that this user has made
});

const Board = new mongoose.Schema({
  moderators: [ObjectID], // an array of references to User documents
  name: String, // this.name must be unique : if this is a personal board then this.moderators will have only one entry, and this.moderators[0].username === this.name
  posts: [ObjectID] // an array of references to posts whose replyto atribute === this.name
});

const Post = new mongoose.Schema({
  replyto: ObjectID, // a reference to either a post document or a board document
  author: ObjectID, // a reference to a user document who made the post
  contentType: { type: String, enum: ['img', 'txt', 'lnk']}, // 'img', 'txt', or 'lnk'
  title: String,
  content: String,
    // if this.contentType == 'img' : a string holding a link to the file location in /public
    // if this.contentType == 'txt' : a string with the text of the post
    // if this.contentType == 'lnk' : a string with the external link
  replies: [ObjectID] // an array of references to post documents where this.replies[n].replyto === reference to this
  private: Boolean, // boolean : if this post is private or not
});

mongoose.model('User', User);

mongoose.connect('mongodb://localhost/hw05');
