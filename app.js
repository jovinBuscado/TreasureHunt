const express = require("express");
const cors = require("cors"); // allow cross origin in /api
const { resolve } = require("path");
const { connect } = require("mongoose");
const helper = require(resolve("helpers","helper.js"));
const encrypt = require(resolve("lib","encryptor.js"));
var bodyParser = require('body-parser');
var crypto = require('crypto');
const e = require("express");

const app = express();
let mongoDB = 'mongodb://localhost:27017/serinoTest'

//connect database
connect(mongoDB,(e)=>{
    if(e) {
        console.log(e);
        process.exit(1);
    }
    console.log("Connection Success....");
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use('*',cors());

// middleware for user-key authentication
app.use(function(req,res,next){
    var p = req._parsedUrl.path
    p = p.replace(/\?.*/,"");
    if(['/login','/nearMe'].indexOf(p.replace(/(^\/.*[nearMe||login]).*/,'$1')) >= 0){ //allowed URLs without a user-key
        next();
    } else {
        if([null,undefined,"",''].indexOf(req.get("user-key")) >= 0){
            res.status(404).send("<h1>Page Not Found</h1>");
        } else {
            if(!encrypt.setText(req.get("user-key")).decrypt()) {
                res.status(401).send("<h1>The request did not include an authentication token or the authentication token was expired.</h1>");
            } else {
                next();
            }
        }
    }
});

//login route
app.post("/login",(req,res)=>{
	let body = req.body;
	let allow = true;

    //trap for insufficient request body
	if(body.password){
		body.password = crypto.createHash('md5').update(body.password).digest("hex"); // encrypt password
	} else {
		allow = false;
		res.status(400).send("<h1>The request was invalid.</h1>");
	}
	if(!body.email){
		allow = false;
		res.status(400).send("<h1>The request was invalid.</h1>");
	}

    //proceed if data is complete
	if(allow) {	
		let data = {
			"password":body.password,
			"email":body.email,
		}

        //get user data
		helper.getUser(data)
		.then(function(result){
			let min = 1;
			let max = 999999;
			encrypt.setText(false);
            
            //generate key unique everytime
			let key = encrypt.setEncryptData({
				u:body.email,
				p:body.password,
				j:min + Math.floor((max - min) * Math.random()),
				i:min + Math.floor((max - min) * Math.random())
			}).encrypt()
			if(result.length){
				res.json({key});
			} else {
				res.status(200).send("<h1>User Not Found.</h1>");
			}
		})
		.catch(function(err){
			res.json(err);
		})
	}
})

//get current user data
app.get("/user",(req,res)=>{
    let user = encrypt.setText(req.get("user-key")).decrypt();//decode user-key taken from request header
    //get user data
    helper.getUser({email:user.u,password:user.p})
    .then(function(result){
        res.json(result);
    })
    .catch(function(err){
        res.json(err);
    })
})

//treasure hunting route
app.post("/treasureHunt",(req,res)=>{
    let user = encrypt.setText(req.get("user-key")).decrypt(); //decode user-key taken from request header
    let body = req.body;

    // convert params from string to float, and split prize value if available
    for(var i in body){
        if(i === "prize_value"){
            body[i] = body[i].split("-").map((val)=>parseFloat(val));
        } else {
            body[i] = parseFloat(body[i]);
        }
    }

    // check if prize value is within the acceptable condition
    // condition is only between $10 to $30 and strictly no decimal values
    // added condition to not allow the prize value from to be greater than the prize value to
    if(body.prize_value && (body.prize_value.map((val)=> val%1 > 0 || val<10 || val>30 )).indexOf(true)+1){
        res.status(400).json({message:"Prize Value only accepts range from 10-30 and no decimal values."});
        return;
    } else if(body.prize_value && body.prize_value[0] > body.prize_value[1]){
        res.status(400).json({message:"Data Error."});
        return;
    } else {
        body.prize_value = [10,30];
    }

    // check if the required data is in the query
    if(!body.latitude || !body.longitude){
        res.status(400).json({message:"Data Incomplete"});
        return;
    }

    // check if distance is between 1 or 10
    if(body.distance && [1,10].indexOf(body.distance)<0){
        res.status(400).json({message:"Distance only accepts between 1 or 10"});
        return;
    } else {
        body.distance = 1;
    }
    let query = {email:user.u,password:user.p,...body};
    helper.getTreasure(query)
    .then((collection)=>{
        res.json(collection);
    })
    .catch((err)=>{
        console.log(err);
    })
});

app.get("/nearMe",(req,res)=>{
    let query = req.query;

    // convert params from string to Float, and split prize value if available
    for(var i in query){
        if(i === "prize_value"){
            query[i] = query[i].split("-").map((val)=>parseFloat(val));
        } else {
            query[i] = parseFloat(query[i]);
        }
    }

    // check if prize value is within the acceptable condition
    // condition is only between $10 to $30 and strictly no decimal values
    // added condition to not allow the prize value from to be greater than the prize value to
    if(query.prize_value && (query.prize_value.map((val)=> val%1 > 0 || val<10 || val>30 )).indexOf(true)+1){
        res.status(400).json({message:"Prize Value only accepts range from 10-30 and no decimal values."});
        return;
    } else if(query.prize_value && query.prize_value[0] > query.prize_value[1]){
        res.status(400).json({message:"Data Error."});
        return;
    }

    // check if the required data is in the query
    if(!query.latitude || !query.longitude || !query.distance){
        res.status(400).json({message:"Data Incomplete"});
        return;
    }

    // check if distance is between 1 or 10
    if([1,10].indexOf(query.distance)<0){
        res.status(400).json({message:"Distance only accepts between 1 or 10"});
        return;
    }

    // call the function for finding the treasure
    helper.findTreasure(query)
    .then((collection)=>{
        res.json(collection);
    })
    .catch((err)=>{
        console.log(err);
    })
});

// all pages will be set as 404
app.use(function(req, res, next) {
    res.status(404).send("<h1>Page Not Found!</h1>");
});

app.listen(process.env.PORT || 3000, () => console.log("server is up!"));