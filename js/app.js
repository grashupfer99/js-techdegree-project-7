// Require necessary modules
const express = require('express');
const app = express();
const Twit = require('twit');
const config = require('./config');
const moment = require('moment');
const bodyParser = require("body-parser");
// To store all user's data in order to add a new tweet later 
let dataBackup;

// Use Pug.js
app.set("view engine", "pug");
// Static files
app.use(express.static("./"));
// Body parser
app.use(bodyParser.urlencoded({ extended: false }));

// Create a timestamp
const timeFormatter = (time, type = 0) => {
  let result;
  const type0 = "ddd MMM DD HH:mm:ss ZZ YYYY";
  const type1 = "ddd MMM DD YYYY HH:mm:ss ZZ";
  if(type === 0){
    result = moment(time, type0, "en").fromNow();
  } else if(type === 1){
    result = moment(new Date(time), type1).fromNow();
  }
  return result;
};

// Get profile data by id 
const getProfileDataById = async (id) => {
  return myTwit.get("users/lookup", { user_id: id.message_create.sender_id });
};

// Use Twitter API Client for node, access codes are automatically passed from config.js file.
const myTwit = new Twit(config);

// Array of promises to request account data for verification, timeline, friends, messages
const promises = [
  myTwit.get("account/verify_credentials", { skip_status: true}),
  myTwit.get('statuses/user_timeline', {count: 5}), 
  myTwit.get("friends/list", {count: 5}),
  myTwit.get("direct_messages/events/list", {count: 5})
];

// Main route
app.get('/', async (req, res, next) => {
    
  // Execute app
  try{
    // request data
    let data = await Promise.all(promises);

    // store data in object
    data = {
      user:data[0].data,
      timeline: data[1].data,
      following: data[2].data.users,
      directMsg: data[3].data.events,
    };

    // store all user's data
    dataBackup = data;
      
    // create timestamps on a user's timeline
    data.timeline.map( created_at => {
      created_at.timestamp = timeFormatter(created_at.created_at);
    });

    // For direct messages, append user's id and timestamp
    data.directMsg.map(info => {
      info.message_create.my_id = data.user.id_str;
      info.formatted_timestamp = timeFormatter(parseInt(info.created_timestamp), 1);
    });

    // Get user's profile data by id
    const getData = await Promise.all(data.directMsg.map(info => getProfileDataById(info)));
      
    // get image urls for every sender 
    getData.forEach( (users, i) => {
      data.directMsg[i].profile_img_url = users.data[0].profile_image_url;
    });
    
    // render the index page
    res.render('index', {data});

    // catch an error and render an error page
  } catch(err){
    err.details = "A server error occurred...";
    err.status = 500;
    next(err);
    return;
  }
});

// Post a new tweet withouth having to refresh a new page
app.post('/', (req, res, next)=> {

  // post a new tweet with Twitter API Client
  myTwit.post('statuses/update', { status: req.body.newTweet }, 
    (err,dat,response)=> {
      // Do if no error is found 
      if(!err){
        let newTweetObj = dat;
        newTweetObj.timestamp = timeFormatter(newTweetObj.created_at);
        dataBackup.timeline.pop(dataBackup.timeline[dataBackup.length-1]);
        dataBackup.timeline.unshift(newTweetObj);
        const data = dataBackup;
        res.render('index', {data});
        // Catch an error
      }else {
        err.details = "Input error detected! Input field should not be empty!";
        err.status = 400;
        next(err);
        return;
      }
    });
});

// Handling errors
app.use((req, res, next) => {
  const err = new Error("Not Found...");
  err.status = 404;
  err.details = "The requested page doesn't exist...";
  next(err);
});

app.use((err, req, res, next) => {
  res.locals.error = err;
  res.status(err.status);
  res.render("error");
});

// Dev server
app.listen(3000, () => {
  console.log("The application is running on localhost:3000!");
});