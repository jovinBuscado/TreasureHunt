const { Schema, model } = require("mongoose");

var data = new Schema({
	id: {type:Number,index:true,unique:true},
	latitude: Number,
	longitude: Number,
	name: String,
},{collection:"treasures"});

module.exports = model("treasures",data);