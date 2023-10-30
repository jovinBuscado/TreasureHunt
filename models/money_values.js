const { Schema, model } = require("mongoose");

var data = new Schema({
	treasure_id: Number,
	amount: Number,
	found: { type:"number", default:0 }
},{collection:"money_values"});

module.exports = model("money_values",data);