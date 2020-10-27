if(process.env.NODE_ENV !=="production"){
  require("dotenv").config();
}

var path = require("path");
var fs = require("fs");
var express = require("express");
var app = express();
var bodyparser = require("body-parser");
var url = "mongodb+srv://Mark:mark@cluster0-mzqid.mongodb.net/musicdatabase?retryWrites=true&w=majority";
var MongoClient = require("mongodb").MongoClient;
var multer = require("multer");
var bcryptjs = require("bcryptjs");
var passport = require("passport");
var session = require("express-session");
var flash = require("express-flash");
var initializePassport = require("./passportConfig");
var methodOverride = require("method-override");

// route to display images
app.use(express.static(path.join(__dirname + "/")));

// global variables, used for data retrieved from the database
var allUsers, allProducts, email, result, userProducts, editedProduct,searchResult;


// set storage
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now())
  }
});
 
var upload = multer({ storage: storage })

// setting the view engine
app.set("view engine", "ejs");

// body parser
var urlencodedParser = bodyparser.urlencoded({ extended: false });



// authentication using passport

//  initialising passport, // function for finding the user based on their email
initializePassport(passport, 
email => allUsers.find(user => user.email === email),
 id => allUsers.find(user => user._id.toString() === id));


// setting statements to tell express to use flash and session
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized:false
}
));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static("public"));
app.use(methodOverride("_method"));




//routes 

app.get("/", function(req, res){

  MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology:true}, function(err, client){
   if(err){
     console.log(err);
   }else{
     console.log("Connected");
   }
   client.close();
  });
  res.sendFile(path.join(__dirname + "/index.html"));
  console.log(allUsers);
});
var allartist;

app.get("/index", (req , res) => {
    res.sendFile(path.join(__dirname + "/index.html"));
});

// route handle the products page

app.get("/buymusic", function(req,res){
  res.render("buymusic", {products: allProducts});
});


 // Route to handle the path /homelist - Just an exmaple to show students
 app.get("/homelist", function(req, res){
   MongoClient.connect(url, {useNewUrlParser:true}, function(err,client){
     if(err) throw err;
     var product = client.db("musicdatabase").collection("buymusic");
      product.find({}).toArray(function(err, artists){
      if (err) throw err;
      console.log(artists);
    result = artists;
      });
      
   });
   res.render("home", {products: result});
   client.close();
 });

// route to handle the path for selling music
app.get("/sellmusic", checkAuthenticatedUser, function (req, res){
  res.sendFile(path.join(__dirname + "/sellmusic.html"));
});

// route to handle the path for posting product to the database
app.post("/postProduct", urlencodedParser, function(req, res){
MongoClient.connect(url, {useNewUrlParser:true}, function(err, client){
  if(err) throw err;
  var product = client.db("musicdatabase").collection("buymusic");

  var prod = { 
    artist: req.body.artist,
    album: req.body.album,
    year: req.body.year,
    genre: req.body.genre,
    price: req.body.price,
    seller: req.user.username
  };

  product.insertOne(prod, function(err, result){
     if(err) throw err;
     console.log(result.ops);
  });


  MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology:true}, function(err, client){
    var db = client.db("musicdatabase");
    var productsCollection = db.collection("buymusic");
    var usersCollection = db.collection("users");
     productsCollection.find({}).toArray(function(err, result){
       if(err) throw err;
       allProducts = result;
     });
    });

  client.close();
});
res.sendFile(path.join(__dirname + "/addProduct.html"));
});

//route for editing product
app.get("/editproduct", (req,res)=>{
  var album = req.query;
  console.log(album);

  //retrieving data through the URL
MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology:true}, (err, client) =>{
  if (err) throw err;
  var productCollection = client.db("musicdatabase").collection("buymusic");
  productCollection.findOne({album:req.query.toString}, function(err, result)  {
if (err) throw err;
console.log(result);
editedProduct = result;
  })

});
// passing data to the views to update the form
    res.render("editproduct", {user:req.user.username, editproduct:editedProduct});
})

app.get("/review", (req , res) => {
  res.sendFile(path.join(__dirname + "/review.html"));
})

//route top update product the user has edited
app.post("/postEditedProduct", urlencodedParser, (req,res) =>{
var query = {artist: req.body.artist, 
album: req.body.album};
var newValues = {$set: {
  artist: req.body.artist,
  album: req.body.album,
  year: req.body.year,
  genre: req.body.genre,
  price: req.body.price
}}

  MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology:true}, (err,client) => {
var product = client.db("musicdatabase").collection("buymusic");
product.updateOne(query, newValues, (err,res) => {
  if (err) throw err;
console.log(res.result.nModified + " documents updated");
});
client.close();
  });
  res.redirect("/profile");
})


// route to handle the path for uploading a user
app.post("/addUser", upload.single("profileImage"), (req, res) => {
  var hashpassword = bcrypt.hashSync(req.body.password, 10)
  var img = fs.readFileSync(req.file.path);
  var encode_image = img.toString("base64");
  var user = {
      email: req.body.email,
      password: hashpassword,
      username: req.body.username,
      address: req.body.address,
      address2: req.body.address2,
      postcode: req.body.postcode,
      country: req.body.country,
      profileImage: {
          contentType: req.file.mimetype, 
           image: Buffer.from(encode_image, "base64")
      }
  }; 
  
  MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) throw err;
      console.log("You have successfully connected to the database");
      var users =  client.db("musicdatabase").collection("users");
      users.insertOne(user, (err, result) => {
          if (err) throw err;
          console.log(result.ops);
      })
      client.close();
  });
  res.sendFile(path.join(__dirname + "/addUser.html"));
  })
  
  
  app.get("/addUser", (req , res) => {
      res.sendFile(path.join(__dirname + "/addUser.html"));}
  );



// route to handle the path /register
app.get("/register", checkNotAuthenticatedUser, function(req, res){
  res.sendFile(path.join(__dirname +"/register.html"));
});
// route to handle the path /login
app.post("/logging-in", urlencodedParser, passport.authenticate("local",{
successRedirect: "/profile",
failureRedirect: "/login",
failureFlash:true
}));


app.get("/login", checkNotAuthenticatedUser, (req, res) => {
res.render("login");
});

//search bar route
app.post("/searchData", urlencodedParser, (req, res) => {
  console.log("Data received");
  console.log(req.body.search);

  MongoClient.connect(url, {useNewUrlParser:true,useUnifiedTopology:true}, (err,client) => {
if (err) throw err;
console.log("You have connected");
  
  //select table we want to query inside the database
  var database = client.db("musicdatabase");
var productCollection = database.collection("buymusic");
productCollection.find({artist: req.body.search}).toArray(function(err, result) {
  if (err) throw err;
  console.log(result);
  searchResult = result;
});

});
  res.render("searchresults", {results:searchResult})
});

 
// route to handle the path /upload
app.get("/upload",  checkAuthenticatedUser, function(req, res){
   res.render("upload", {user: req.user.username});
});

//Route to handle the path for profile page
app.get("/profile", checkAuthenticatedUser, urlencodedParser, function(req, res){

  MongoClient.connect(url, {useNewUrlParser:true,useUnifiedTopology:true}, function(err, client){
    if(err) throw err;
    var productCollection = client.db("musicdatabase").collection("buymusic");
  
    var query = {seller:req.user.username};
    productCollection.find(query).toArray(function(err, result){
     if(err) throw err;
     userProducts = result;
    });

  });

   res.render("profile", {name: req.user.username, products:userProducts});
});
// route to handle the path /admin
app.get("/admin", function(req, res){
  res.render("admin", {users:allUsers});
});

// route to handle the path /postproduct
app.post("/postproduct", urlencodedParser, function(req, res){
  MongoClient.connect(url,{useNewUrlParser:true}, function(err, client){
    var product = client.db("musicdatabase").collection("buymusic");
    var prod = {
        artist: req.body.artist,
        album: req.body.album,
        year: req.body.year,
        genre: req.body.genre,
        price: req.body.price,
    };
    product.insertOne(prod, function(err, result){
      if(err) throw err;
       console.log(result.ops);
    });
    client.close();
  });
  res.sendFile(path.join(__dirname + "/addProduct.html"));
});

app.get("/addProduct", (req , res) => {
  res.sendFile(path.join(__dirname + "/addProduct.html"));}
);

app.post('/uploadfile', upload.single('myFile'), (req, res, next) => {
  const file = req.file
  if (!file) {
    const error = new Error('Please upload a file')
    error.httpStatusCode = 400
    return next(error)
  }
    res.send(file)
  
})


app.post('/uploadphoto', upload.single('picture'), (req, res) => {
  var img = fs.readFileSync(req.file.path);
var encode_image = img.toString('base64');
// Define a JSONobject for the image attributes for saving to database

var finalImg = {
    contentType: req.file.mimetype,
    image:  new Buffer(encode_image, 'base64')
 };
db.collection('buymusic').insertOne(finalImg, (err, result) => {
  console.log(result)

  if (err) return console.log(err)

  console.log('saved to database')
  res.redirect('/')
 
   
})
})

//Middleware function for checking that users are authentcated
 function checkAuthenticatedUser(req, res, next){
    if(req.isAuthenticated()){
   return next();
    }
    res.redirect("/login");
 }
// Middleware function for checking not Logged users
function checkNotAuthenticatedUser(req, res, next){
  if(req.isAuthenticated()){
    return res.redirect("/profile")
   }
   next();
}
// Route to handle the path /logout
app.delete("/logout", function(req, res){
req.logOut(); // passport's function for clearing session
res.redirect("/login");
});


app.listen(8084, function(){
 MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology:true}, function(err, client){
 var db = client.db("musicdatabase");
 var productsCollection = db.collection("buymusic");
 var usersCollection = db.collection("users");
  productsCollection.find({}).toArray(function(err, result){
    if(err) throw err;
    allProducts = result;
  });
  usersCollection.find({}).toArray(function(err, result){
     if(err) throw err;
     allUsers = result;
  });

 });


    console.log("The server is listening at port 8084");
});

