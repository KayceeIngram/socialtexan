require('dotenv').config();

const express = require('express')
    , session = require('express-session')
    , path = require('path')
    , bodyParser = require('body-parser')
    , cors = require('cors')
    , passport = require('passport')
    , Auth0Strategy = require('passport-auth0')
    , massive = require('massive');

const app = express();
const SERVER_PORT = process.env.SERVER_PORT || 3003;
const CONNECTION_STRING = process.env.CONNECTION_STRING;

app.use(bodyParser.json());
app.use(cors());
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

passport.use(new Auth0Strategy({
    domain: process.env.AUTH_DOMAIN,
    clientID: process.env.AUTH_CLIENT_ID,
    clientSecret: process.env.AUTH_CLIENT_SECRET,
    callbackURL: process.env.AUTH_CALLBACK,
    scope: 'openid profile'
  }, function(accessToken, refreshToken, extraParams, profile, done) {
    const db = app.get('db');

    db.find_user([ profile.user_id ])
    .then(user => {
      if (user[0]) {
        return done(null, { id: user[0].id });
      } else {
        db.create_user([ profile.displayName, profile.picture, profile.user_id ])
        .then(user => {
          return done(null, { id: user[0].id });
        });
      }
    })
  }));
  
  app.get('/auth', passport.authenticate('auth0'));
  
  app.get('/auth/callback', passport.authenticate('auth0', {
    successRedirect: process.env.REACT_APP_SUCCESS_REDIRECT,
    failureRedirect: process.env.REACT_APP_FAILURE_REDIRECT
  }));
  
  passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    app.get('db').find_session_user([user.id])
    .then(user => {
      return done(null, user[0]);
    });
  });
  
  app.get('/auth/me', (req, res, next) => {
    if (!req.user) {
      return res.status(401).send('Log In required');
    } else {
      return res.status(200).send(req.user);
    }
  });
  
  app.get('/auth/logout', (req, res) => {
    req.logOut();
    return res.redirect(process.env.REACT_APP_REDIRECT);
  });

  // The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname+'/client/build/index.html'));
// });

massive(CONNECTION_STRING)
.then(db => {
  app.set('db', db);

  app.listen(SERVER_PORT, () => {
    console.log('Listening on port ', SERVER_PORT);
  });
});