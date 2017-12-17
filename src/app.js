// app.js
const http = require('http');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const session = require('express-session');
const hbs = require('hbs');
//const passport = require('passport');
const crypto = require('crypto');


const fs = require('fs');
const fn = path.join(__dirname, 'config.json');
const data = fs.readFileSync(fn);

// our configuration file will be in json, so parse it and get our salt
const conf = JSON.parse(data);
const salt = conf.salt;
const sessionSecret = conf.secret;

//console.log('salt:', salt);
//console.log('secret:', sessionSecret);

const app = express();
require('./db.js');

const User = mongoose.model('User');
const Board = mongoose.model('Board');
const Post = mongoose.model('Post');

app.set('view engine', 'hbs');
app.set('views', __dirname+'/views/');
app.use(bodyParser.urlencoded({ extended: false }));
const publicPath = path.resolve(__dirname, 'public');
app.use(express.static(publicPath));
const sessionOptions = {
  secret: sessionSecret,
  saveUninitialized: false,
  resave: false
};
app.use(session(sessionOptions));

hbs.registerPartials(__dirname + '/views/partials');

app.get('/', function(req, res) {
  if(req.session.user !== undefined) {
    res.redirect('/feed');
  }
  else {
    res.redirect('/login');
  }
});

app.get('/new-account', function(req, res) {
  const context = {};
  if( req.query.err ) { context.err = req.query.err; }
  res.render('new-account', context);
});

app.get('/404', function(req, res) {
  res.status(404).render('not-found', {err: req.query.err});
});

function validate(name) {
  let char;
  for ( let i=0; i<name.length; i++ ) {
    char = 0xfeff0000 + name.charCodeAt(i);
    if( ! //if it is not within this subset of UTF-16
      ( (0xfeff0030 <= char && char <= 0xfeff0039)//numerals
      ||(0xfeff0041 <= char && char <= 0xfeff005a)//caps
      ||(0xfeff0061 <= char && char <= 0xfeff007a)//lowers
      || 0xfeff00a1 <= char //all the rest of the special language chars
      || 0xfeff005f === char //underscore
      || 0xfeff002d === char)//hyphen
    ) { return false; }
  }
  return true;
}

app.post('/new-account', function(req, res) {
  let newUser, userBoard;

  //console.log('validation of username: ', validate(req.body.username));

  if ( !validate(req.body.username) ) {
    res.redirect('/new-account?err=That username has invalid characters. Try replacing punctuation with underscores or hyphens.');
  }
  else {

  User.findOne({username: req.body.username}).exec()
    .then(
      function(dbUser) {
        if(dbUser === null) {
          //console.log('didn\'t find user, moving on...');
          return Board.findOne({name: req.body.username}).exec();
        }
        else {
          //console.log('found user, throwing error...');
          throw '/new-account?err=that+username+is+already+taken';
        }
      })
    .then(
      function(dbBoard) {
        if(dbBoard === null) {
          //console.log('didn\'t find board, moving on...');
          const hash = crypto.createHash('sha256');
          hash.update(salt + req.body.password);
          const passHash = hash.digest('hex');

          newUser = new User({
            username: req.body.username,
            hash: passHash,
            email: req.body.email,
            notifications: [{message: 'welcome to disentr!', link: '/feed'}],
            boards: [],
            mods: [],
            posts: []
          });

          userBoard = new Board({
            moderators: [newUser._id],
            blacklist: [],
            name: newUser.username,
            posts: []
          });

          newUser.mods.push(userBoard._id);

          //console.log('created new user: ', newUser);
          //console.log('created new board: ', userBoard);
          //console.log('saving user...');

          return newUser.save();
        }
        else {
          //console.log('found board: ', dbBoard);
          //console.log('throwing error');
          throw '/new-account?err=a+board+already+exists+with+that+name';
        }
      })
    .then(
      function() {
        //console.log('user save fulfilled, saving board...');
        return userBoard.save();
      })
    .then(
      function() {
        //console.log();
        res.redirect('/feed');
      })
    .catch(function(landing) {
      //console.log('caught error: ', landing);
      res.redirect(landing);
  });
  }
});

app.get('/login', function(req, res) {
  if(req.session.user !== undefined){
    res.redirect('/feed');
  }
  else{
    res.render('login', {err: req.query.err});
  }
});

app.post('/login', function(req, res) {
  const hash = crypto.createHash('sha256');
  hash.update(salt + req.body.password);
  const passHash = hash.digest('hex');
  User.findOne({username: req.body.username, hash: passHash}, function(err, user){
    if (user === null) {
      res.redirect('/login?err=username+or+password+incorrect');
    }
    else {
      req.session.user = user;
      res.redirect('/feed');
    }
  });
});

app.get('/logout', function(req, res) {
  req.session.user = undefined;
  res.redirect('/login');
});

function getPostsFromBoards( boardIDs ) {
  //given an array of board IDs
  //returns an array of posts with their replyto's populated
  //console.log('inside getPostsFromBoards with boardIDs == ', boardIDs);
  if( boardIDs.length === 0 ) {
    return [];
  }
  else {
    const cur = boardIDs.pop();
    let board;

    return Board.findById(cur)
      .populate({
        path: 'posts',
        populate: {
          path: 'replyto',
          model: Board
        }
      })
      .exec()
      .then(function(curBoard) {
        //console.log('after search, found board: ', curBoard);
        board = curBoard;
        return getPostsFromBoards(boardIDs);
      })
      .then(function(val) {
        const ret = board.posts.concat(val);
        //console.log('I am returning: ', ret);
        return ret;
      });
  }
}

app.get('/feed', function(req, res) {
  if(req.session.user !== undefined) {

    let user, posts;

    User.findById(req.session.user._id).exec()
      .then(function(dbUser) {
        if( dbUser === null ) {
          throw 'user not found';
        }
        else {
          user = dbUser;
          return getPostsFromBoards(user.boards);
        }
      })
      .then(function (feedPosts) {
        posts = feedPosts;
        //console.log('after getPostsFromBoards, posts = ', posts);
        posts.sort(function(a,b) {
          return b.replies.length - a.replies.length;
        });

        for (const post in posts) { //do some handlebars help for all the posts
          switch (posts[post].contentType) {
            case 'img':
              posts[post].img = true;
              break;
            case 'txt':
              posts[post].txt = true;
              break;
            case 'lnk':
              posts[post].lnk = true;
              break;
          }
        }

        res.render('feed', {
          user: user,
          posts: posts,
          err: req.query.err
        });
      })
      .catch(function(err) {
        res.redirect('/404?err='+err);
      });
  }
  else {
    res.redirect('/login');
  }
});

app.post('/follow', function ( req, res ) {

  if ( !req.session.user ) {
    const ref = req.get('Referer');
    if( ref ) {
      res.redirect(ref + '?err=' + 'no logged in user');
    }
    else {
      res.redirect('/404?err=' + 'no logged in user');
    }
  }
  else {
    let user, board;

    User.findById(req.session.user._id).exec()
      .then( function ( dbUser ) {
        if ( dbUser === null ) {
          throw 'user not found';
        }
        else {
          user = dbUser;
          return Board.findOne({name: req.body.board}).exec();
        }
      })
      .then( function ( dbBoard ) {
        if ( dbBoard === null ) {
          throw 'board not found';
        }
        else if ( user.boards.indexOf(dbBoard._id) !== -1 ) {
          throw 'you are already subscribed to ' + dbBoard.name;
        }
        else {
          board = dbBoard;
          user.boards.push(board._id);
          return user.save();
        }
      })
      .then( function ( doc ) {
        const ref = req.get('Referer');
        if( ref ) {
          res.redirect(ref + '?err=' + 'you are now following ' + board.name);
        }
        else {
          res.redirect('/' + board.name + '?err=' + 'you are now following this board');
        }
      })
      .catch( function( err ) {
        const ref = req.get('Referer');
        if( ref ) {
          res.redirect(ref + '?err=' + err);
        }
        else {
          res.redirect('/404?err=' + err);
        }
      });
  }
});

app.get('/profile/:username', function(req, res){
  User.findOne({username: req.params.username})
    .populate('mods')
    .populate('posts')
    .exec(function(err, user){
      if(user !== null){
        if(req.session.user !== undefined && req.session.user._id === ''+user._id) {
          for (const post in user.posts) { //do some handlebars help for all the posts
            switch (user.posts[post].contentType) {
              case 'img':
                user.posts[post].img = true;
                break;
              case 'txt':
                user.posts[post].txt = true;
                break;
              case 'lnk':
                user.posts[post].lnk = true;
                break;
            }
          }
          res.render('profile', {user: user, err: req.query.err});
        }
        else {
          res.redirect('/board/' + req.params.username);
        }
      }
      else{
        res.redirect('/404');
      }
    });
});

app.get('/board/:name', function(req, res){
  Board.findOne({name: req.params.name}).populate('posts').exec(function(err, board){
    if(board !== null){


      const boardContext = { board: board };

      boardContext.board.posts.sort(function(a,b) {
        return b.replies.length - a.replies.length;
      });

      /*for (let post=0; post < boardContext.board.posts.length; post++) { //for some reason this isn't working, so I'll just leave it there for the future just in case
        boardContext.board.posts[post].content = boardContext.board.posts[post].content.replace(/\n/, "<br/>");
      }*/

      for (const post in boardContext.board.posts) { //do some handlebars help for all the posts
        switch (boardContext.board.posts[post].contentType) {
          case 'img':
            boardContext.board.posts[post].img = true;
            break;
          case 'txt':
            boardContext.board.posts[post].txt = true;
            break;
          case 'lnk':
            boardContext.board.posts[post].lnk = true;
            break;
        }
      }

      if(req.session.user !== undefined // logged in user
        && board.moderators.reduce((sum, moderator) => sum || moderator === req.session.user._id, false) ) { // user is moderator
        boardContext.mod = true;
        boardContext.user = req.session.user;
      }
      else if(req.session.user !== undefined // logged in user
        && !board.blacklist.reduce((sum, member) => sum || member === req.session.user._id, false) ) { // user is not blacklisted
        boardContext.user = req.session.user;
      }

      boardContext.err = req.query.err;

      //console.log('context object passed to hbs: ' + boardContext.board);
      res.render('board', boardContext);
    }
    else{
      res.redirect('/404');
    }
  });
});

app.post('/board/:name', function(req, res){
  if(req.session.user !== undefined) {
    //TODO: convert to promises
    if(req.body.contentType === undefined
     ||req.body.title === undefined
     ||req.body.content === undefined
     ||req.body.open === undefined) {
       res.redirect(req.get('Referer') + '?err=you must specify title, content, and open or closed');
     }
    else {
      Board.findOne({name: req.params.name}, function(err, board){
        if(board !== null){
          User.findById(req.session.user._id, function(err, user){
            //#TODO: add validation for post inputs (title should be required at least)
            const post = new Post({
              replyto: board._id,
              author: req.session.user._id,
              contentType: req.body.contentType,
              title: req.body.title,
              content: req.body.content,
              replies: [],
              open: req.body.open
            });

            board.posts.push(post._id);
            user.posts.push(post._id);

            //console.log('post about to be saved:\n', post);

            post.save()
              .then(function() { return board.save(); })
              .then(function() { return user.save(); })
              .then(function(){ res.redirect('/board/'+req.params.name); })
              .catch(function(err) { res.redirect('/board/'+req.params.name+'?err=' + err); } );

          });
        }
        else{
          res.redirect('404');
        }
      });
    }
  }
  else {
    res.redirect('/board/'+req.params.name);
  }
});

app.post('/new-board', function(req, res) {
  if ( req.session.user === undefined ) {
    res.redirect('/404?err=no logged in user');
  }
  else {
    let user, newBoard;

    User.findById( req.session.user._id ).exec()
      .then( function (dbUser) {
          if (dbUser === null) {
            throw 'user not found';
          }
          else {
            user = dbUser;
            return Board.findOne({name: req.body.name}).exec();
          }
      })
      .then( function (dbBoard) {
          if (dbBoard !== null) {
            throw 'board already exists';
          }
          else {
            newBoard = new Board({
              moderators: [user._id],
              blacklist: [],
              name: req.body.name,
              posts: []
            });
            return newBoard.save();
          }
      })
      .then( function( doc ) {
        user.mods.push(newBoard._id);
        return user.save();
      })
      .then( function( doc ) {
        res.redirect('/board/'+newBoard.name);
      })
      .catch(function ( err ) {
        const ref = req.get('Referer');
        if( ref ) {
          res.redirect(ref + '?err=' + err);
        }
        else {
          res.redirect('/404?err=' + err);
        }
      });
  }
});

function isPostInBoardCall(postId, boardId, resolve, reject){
  //console.log('--in validation-- postId: ' + postId + ' boardId: ' + boardId);
  //console.log('postId === boardId? ' + (''+postId === ''+boardId));
  if(''+postId === ''+boardId) { resolve(); } // if this function gets called with identical post and board ids, it meant that we have recursed up the tree and found a match
  else {
    Post.findById(postId, function(err, post){
      //console.log('--in validation-- searching for ' + postId + ': ' + post);
      if(post === null) { reject(); } // if there is some error, or we can't find any matching posts, we assume the post was not a child of the board
      else {
        isPostInBoardCall(post.replyto, boardId, resolve, reject);
      }
    });
  }
}

function isPostInBoard(postId, boardId){
  return new Promise((resolve, reject) => {
    isPostInBoardCall(postId, boardId, resolve, reject);
  });
}

app.get('/board/:board/post/:post', function(req,res) {

  let post, board, replyto;

  Board.findOne({name: req.params.board}).exec()

    .then(function(dbBoard) {
      if(dbBoard === null) {
        throw 'board not found';
      }
      else {
        board = dbBoard;
        return Post.findOne({slug: req.params.post}).populate('replies').exec();
      }
    })

    .then(function(dbPost) {
      if( dbPost === null ) {
        throw 'post not found';
      }
      else {
        post = dbPost;
        return Post.findById(post.replyto).exec(); //assume the replyto is a post -- rest gets handled by hbs
      }
    })

    .then(function(parent) {
        replyto = parent;
        return isPostInBoard(post._id, board._id);
    })

    .then(
      function() {

        const postContext = {post: post, replyto: replyto};

        postContext.post.replies.sort(function(a,b) {
          return b.replies.length - a.replies.length;
        });

        if(req.session.user !== undefined // logged in user
          && board.moderators.reduce((sum, moderator) => sum || moderator === req.session.user._id, false) ) { // user is moderator
          postContext.mod = true;
          postContext.user= req.session.user;
        }
        else if(req.session.user !== undefined // logged in user
          && !board.blacklist.reduce((sum, member) => sum || member === req.session.user._id, false) ) { // user is not blacklisted
          postContext.user = req.session.user;
        }

        switch (postContext.post.contentType) { //set values so that handelbars can read it easier
          case 'img':
            postContext.post.img = true;
            break;
          case 'txt':
            postContext.post.txt = true;
            break;
          case 'lnk':
            postContext.post.lnk = true;
            break;
        }

        for (const reply in postContext.post.replies) { //do the same handlebars help for all the replies
          switch (postContext.post.replies[reply].contentType) {
            case 'img':
              postContext.post.replies[reply].img = true;
              break;
            case 'txt':
              postContext.post.replies[reply].txt = true;
              break;
            case 'lnk':
              postContext.post.replies[reply].lnk = true;
              break;
          }
        }


        postContext.board = board; //maintain the board name for linking to comments
        postContext.err = req.query.err;

        if(req.session.user !== undefined && ''+post.author === ''+req.session.user._id) {
          postContext.author = true;
        }

        //console.log('postContext passed into handlebars:\n', postContext);

        res.render('post', postContext);
      },
      function() {
        throw 'invalid url -- that post is not in that board';
      }
    )

    .catch(function(err) {
      res.redirect('/404?err=' + err);
    });
});


app.post('/board/:board/post/:post', function(req,res) {
  if(req.session.user !== undefined) {

    if(req.body.contentType === undefined
     ||req.body.title === undefined
     ||req.body.content === undefined
     ||req.body.open === undefined) {
       res.redirect('/board/' + req.params.board + '/post/' + req.params.post + '?err=you must specify title, content, and open/closed');
     }

    else {
    let board, post, newReply, user;

    Board.findOne({name: req.params.board}).exec()

      .then(function(dbBoard) { //fulfilled
        //console.log(arguments);
        board = dbBoard;
        return Post.findOne({slug: req.params.post}).populate('replies').exec();
      })

      .then(function(dbPost) { //fulfilled
        post = dbPost;
        return isPostInBoard(post._id, board._id);
      })

      .then(
        function(){ //if isPostInBoard resolved
          return new Promise((resolve, reject) => {
            //console.log('in authored check:\n\tpost.replies:' + post.replies + '\n\treq.session.user._id:' + req.session.user._id);
            if(post.replies.reduce((authored, reply) => authored || ''+reply.author === ''+req.session.user._id, false)) {
              //console.log('about to reject');
              reject();
            }

            else {
              resolve();
            }
          });
        },
        function(){ //if isPostInBoard rejected
          //console.log('throwing invalid url error');
          throw 'invalid url -- that post is not in that board';
        }
      )

      .then(
        function() { //fulfilled -- meaning the user has not already authored a reply
          return User.findById(req.session.user._id).exec();
        },
        function() { //rejected -- meaning there has already been a reply by this author
          throw "you have already replied to this post";
        }
      )

      .then(function(dbUser){
        user = dbUser;
        newReply = new Post({
          replyto: post._id,
          author: req.session.user._id,
          contentType: req.body.contentType,
          title: req.body.title,
          content: req.body.content,
          replies: [],
          open: req.body.open
        });

        post.replies.push(newReply._id);
        user.posts.push(newReply._id);

        return newReply.save();
      })

      .then(function() { return post.save(); })

      .then(function() { return user.save(); })

      .then(function() {
        res.redirect('/board/' + req.params.board + '/post/' + req.params.post);
      })

      .catch(function(err) {
        res.redirect('/board/' + req.params.board + '/post/' + req.params.post + '?err=' + err);
      });
    }
  }

  else {
    res.redirect('/board/' + req.params.board + '/post/' + req.params.post);
  }
});

app.get('/board/:board/post/:post/edit', function(req,res) {
  //very similar to a normal post get, but a bit of extra validation, and a little bit less handlebars stuff
  let post, board;

  Board.findOne({name: req.params.board}).exec()

    .then(function(dbBoard) {
      board = dbBoard;
      return Post.findOne({slug: req.params.post}).exec();
    })

    .then(function(dbPost) {
      post = dbPost;
      return isPostInBoard(post._id, board._id);
    })

    .then(
      function() {
        return new Promise((resolve, reject) => {
          if(''+req.session.user._id === ''+post.author) { resolve(); }
          else { reject(); }
        });
      },
      function() {
        throw 'invalid url -- that post is not in that board';
      }
    )

    .then(
      function() {

        const postContext = {post: post};

        switch (postContext.post.contentType) { //set values so that handelbars can read it easier
          case 'img':
            postContext.post.img = true;
            break;
          case 'txt':
            postContext.post.txt = true;
            break;
          case 'lnk':
            postContext.post.lnk = true;
            break;
        }

        postContext.err = req.query.err;

        //console.log('postContext passed into handlebars:\n', postContext);

        res.render('edit-post', postContext);
      },
      function() {
        throw 'you are not authorized to edit this post';
      }
    )

    .catch(function(err) {
      res.redirect('/404?err=' + err);
    });
});

app.post('/board/:board/post/:post/edit', function(req,res) {
  //very similar to a normal post get, but a bit of extra validation, and a little bit less handlebars stuff
  let post, board;

  Board.findOne({name: req.params.board}).exec()

    .then(function(dbBoard) {
      board = dbBoard;
      return Post.findOne({slug: req.params.post}).exec();
    })

    .then(function(dbPost) {
      post = dbPost;
      return isPostInBoard(post._id, board._id);
    })

    .then(
      function() {
        return new Promise((resolve, reject) => {
          if(''+req.session.user._id === ''+post.author) { resolve(); }
          else { reject(); }
        });
      },
      function() {
        throw 'invalid url -- that post is not in that board';
      }
    )

    .then(
      function() {
        post.set({
          contentType: req.body.contentType,
          title: req.body.title,
          content: req.body.content,
          open: req.body.open
        });

        return post.save();
      },
      function() {
        throw 'you are not authorized to edit this post';
      }
    )

    .then(function() {
      res.redirect('/board/' + req.params.board + '/post/' + req.params.post);
    })

    .catch(function(err) {
      res.redirect('/404?err=' + err);
    });
});

app.get('*', function(req, res) {
  let query = '';
  if( req.query.err ) { query = '?err=' + req.query.err; }
  res.redirect('/404' + query);
});

let portHTTP = 8000, portHTTPS = 8080;

let options = {};

if (process.env.NODE_ENV === 'PRODUCTION') {
  portHTTP = 80;
  portHTTPS = 443;

  options = {
    key: fs.readFileSync(conf.key),
    cert: fs.readFileSync(conf.cert)
  };
}

http.createServer(app).listen(portHTTP);
if (process.env.NODE_ENV === 'PRODUCTION') {
  https.createServer(options, app).listen(portHTTPS);
}
