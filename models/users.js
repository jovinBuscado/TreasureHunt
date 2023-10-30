const { Schema, model } = require("mongoose");

var data = new Schema({
	id: {type:Number,index:true,unique:true},
	name: String,
	age: Number,
	password: String,
	email: String,
	treasures:[],
	last_treasure: Date
},{collection:"users"});

module.exports = model("users",data);