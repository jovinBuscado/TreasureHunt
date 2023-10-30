var crypto = require('crypto');
const ivLength = 16;
const password = '^~345tbm86&!x9t45t0m86&!';
const algorithm = 'aes-256-cbc';

module.exports = {
	text:'',
	encryptData:{},
	setEncryptData:function(data){
		this.encryptData = data;
		return this; // returned self for chaining
	},
	setText:function(text){
		this.text = text;
		return this; // returned self for chaining
	},
	setPassword:function(pass){
		this.password = pass
		return this // returned self for chaining
	},
	encrypt: function(){
		var date = (new Date()).getTime() + "";

		var sort = this.sortObject({d:date,t:this.text,...this.encryptData}); // sort object by value
		var obj = "";
		var y = 0;
		// concatenate object format key:value
		for(var x in sort) {
			if(y == 0) {
				obj += sort[x][0]+":"+sort[x][1]
				y++;
			} else {
				obj += ";"+sort[x][0]+":"+sort[x][1]
			}
		}

		let iv = crypto.randomBytes(ivLength);
		var bufferPassword = new Buffer.from(password).toString('base64');
		var cipher = crypto.createCipheriv(algorithm,bufferPassword,iv.toString('hex').slice(0, 16)) // create encryption with the password and algorithm

		var encrypted = cipher.update(obj,'utf8','hex') // encrypt text utf to hex
		encrypted += cipher.final('hex')
        
		// return encrypted; // encyrpted text(API key)
		return iv.toString('hex')+":"+encrypted; // encyrpted text(API key)
	},
	decrypt: function(){
        let text = this.text.split(":");
        let iv = Buffer.from(text.shift(), 'hex');
        let encryptedText = Buffer.from(text.join(':'), 'hex');
		var bufferPassword = new Buffer.from(password).toString('base64');
		var decipher = crypto.createDecipheriv(algorithm,bufferPassword,iv.toString('hex').slice(0, 16)) // create decryption with the password and algorithm
        
		try {
			if(!encryptedText) throw false;
			var dec = decipher.update(encryptedText,'hex','utf8') // decrypt text hex to utf
			dec += decipher.final('utf8');

			var date = (new Date());
			date.setHours(date.getHours()-16);
			var split = dec.split(';'); 

			var data = {}
			for(var x in split){
				var s = split[x].split(':')
				data[s[0]] = s[1]
			}
			if(!data.d) throw false;

			// var token = new Buffer(data.t, 'base64').toString('ascii'); // decrypt base64 encoding
			// var split = token.split(':');
			if(data.d && date.getTime() < parseInt(data.d)) {
				delete data.d
				return data;
				// return data.t;
			} else {
				throw false;
			}
			// return dec; // decrypted text
		} catch (e) {
			// return({ status:false, message: 'Access Denied!' });
			return false; // error in decrypting text
		}
	},
	sortObject: function(obj) {
	  // convert object into array
		var sortable=[];
		for(var key in obj)
			if(obj.hasOwnProperty(key))
				sortable.push([key, obj[key]]); // each item is an array in format [key, value]

		// sort items by value
		sortable.sort(function(a, b)
		{
			var x=(a[1]+"").toLowerCase(),
				y=(b[1]+"").toLowerCase();
			return x<y ? -1 : x>y ? 1 : 0;
		});
		return sortable; // array in format [ [ key1, val1 ], [ key2, val2 ], ... ]
	}
}