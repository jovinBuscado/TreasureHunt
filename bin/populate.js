const { connect } = require("mongoose");
const { series } = require("async");
const { createReadStream } = require("fs");
const { parse } = require("csv-parse");
const { createHash } = require("crypto");
const { resolve } = require("path");
const { WriteError } = require("mongodb");
const models = {
    treasures: require(resolve("models","treasures.js")),
    money_values: require(resolve("models","money_values.js")),
    users: require(resolve("models","users.js"))
}

let mongoDB = 'mongodb://localhost:27017/serinoTest'

console.log(models.treasures);

const readCsv = (file)=>{
    let data = [];
    let keys = [];
    return new Promise((res,rej)=>{
        createReadStream(resolve("bin",file))
        .pipe(parse({ delimiter: ",", from_line: 1 }))
        .on("data", (row) => {
            if(keys.length){
                data.push(Object.fromEntries(keys.map((key,i)=>{
                    if(key === "password"){
                        row[i] = createHash('md5').update(row[i]).digest("hex");
                    }
                    return [key,row[i]]
                })));
            } else {
                keys = row;
            }
        })
        .on("end",()=>{
            res(data);
        })
        .on("error",(err)=>{
            rej(err)
        })
    });
}

const insertDataAlgo = (data,model,callback) =>{
    model.createIndexes();
    model.insertMany(data,{ordered:false},(err,result)=>{
        if(err){
            err.writeErrors.map((error)=>console.log(error.err.errmsg));
            err.insertedDocs.map((data)=>console.log("id: "+data.id+" is successfully added."));
        } else {
            result.map((data)=>console.log("id: "+data.id+" is successfully added."));
        }
        callback();
    });
}

series([
	(cb) => { //connect to db
		console.log("\n*********************************** Data Population Begin ***********************************");
		connect(mongoDB,(e)=>{
			if(e) {
				console.log(e);
                process.exit(1);
			}
			console.log("Connection Success....");
			cb();
		});
	},
    (cb) => {
        console.log("\n*********************************** Inserting Treasures Data ***********************************");
        readCsv("treasures.csv")
        .then(((result)=>{
            insertDataAlgo(result,models.treasures,()=>{
                console.log("\n*********************************** Treasures Data Inserted ***********************************");
                cb();
            });
        }))
        .catch((err)=>{
            console.log(err);
		    process.exit(1);
        })
    },
    (cb) => {
        console.log("\n*********************************** Inserting Users Data ***********************************");
        readCsv("users.csv")
        .then(((result)=>{
            insertDataAlgo(result,models.users,()=>{
                console.log("\n*********************************** Users Data Inserted ***********************************");
                cb();
            });
        }))
        .catch((err)=>{
            console.log(err);
		    process.exit(1);
        })
    },
    (cb) => {
        models.money_values.deleteMany({},(err,result)=>{
            console.log("\n*********************************** Removing Money Value Data ***********************************");
            console.log("\n*********************************** Inserting Money Values Data ***********************************");
            readCsv("money_values.csv")
            .then(((result)=>{
                insertDataAlgo(result,models.money_values,()=>{
                    console.log("\n*********************************** Money Values Data Inserted ***********************************");
                    cb();
                });
            }))
            .catch((err)=>{
                console.log(err);
                process.exit(1);
            })
        })
    }
], function (error) {
	//console.log(usersModel);
	if (error) {
		console.log("\nInstallation failed");
        console.log(err);
        process.exit(1);
		//handle readFile error or processFile error here
	} else {
        console.log("\n*********************************** Data Population Complete ***********************************");
        process.exit(0);
    }
});