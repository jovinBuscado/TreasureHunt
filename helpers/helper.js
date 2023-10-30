const { resolve } = require("path");
const { Types } = require("mongoose");
const models = {
    treasures: require(resolve("models","treasures.js")),
    money_values: require(resolve("models","money_values.js")),
    users: require(resolve("models","users.js"))
}

// find the treasure
// formula taken from http://www.movable-type.co.uk/scripts/latlong.html and converted to match the algorithm
// tested the formula with multiple online distance calculator
const findTreasure = (filter) => {
    let query = [];
    //join money_values data to treasure data
    query.push({
        $lookup:{
            from:"money_values",
            localField:"id",
            foreignField:"treasure_id",
            as:"values"
        }
    });
    // check the filter if it has prize value data
    query.push({
        $unwind: "$values"
    });

    if(filter.prize_value){
        // get only the data that matched the condition
        query.push({
            $match:{"values.amount":{$gte:filter.prize_value[0],$lte:filter.prize_value[1]}}
        });
    }

    // get only the data that matched the condition
    query.push({
        $match:{"values.found":0}
    });
    
    query.push({
        $group: {
            _id:"$_id",
            id:{$first:"$id"},
            longitude:{$first:"$longitude"},
            latitude:{$first:"$latitude"},
            name:{$first:"$name"},
            values:{ "$push": "$values" },
        }
    });
    query.push({$sort:{id:1}});

    // push the default data to be used for calculating the distance between the two coordinates
    query.push({
        $addFields:{
            meters:6371e3,
            pi:Math.PI,
            given:filter
        }
    });

    // distance calculation starts here
    query.push({
        $project:{
            id:1,
            longitude:1,
            latitude:1,
            name:1,
            values:1,
            meters:1,
            pi:1,
            given:1,
            distance: {
                $let: {
                    vars: { // initiate the default data needed for final calculation
                        lat1:{$multiply:["$given.latitude",{$divide:["$pi",180]}]},
                        lat2:{$multiply:["$latitude",{$divide:["$pi",180]}]},
                        diffLat:{$multiply:[{$subtract:["$latitude","$given.latitude"]},{$divide:["$pi",180]}]},
                        diffLong:{$multiply:[{$subtract:["$longitude","$given.longitude"]},{$divide:["$pi",180]}]},
                    },
                    in:{ // final calculation
                        $divide:[{
                            $multiply:[
                                "$meters",
                                {$multiply: [
                                    2,
                                    {$atan2: [
                                        {$sqrt:{
                                            $add:[
                                                {$multiply:[
                                                    {$sin:{$divide:[
                                                        "$$diffLat",
                                                        2
                                                    ]}},
                                                    {$sin:{$divide:[
                                                        "$$diffLat",
                                                        2
                                                    ]}},
                                                ]},
                                                {$multiply:[
                                                    {$cos:"$$lat1"},
                                                    {$cos:"$$lat2"},
                                                    {$sin:{$divide:[
                                                        "$$diffLong",
                                                        2
                                                    ]}},
                                                    {$sin:{$divide:[
                                                        "$$diffLong",
                                                        2
                                                    ]}},
                                                ]}
                                            ]
                                        }},
                                        {$sqrt:{
                                            $subtract:[1,
                                                {$add:[
                                                    {$multiply:[
                                                        {$sin:{$divide:[
                                                            "$$diffLat",
                                                            2
                                                        ]}},
                                                        {$sin:{$divide:[
                                                            "$$diffLat",
                                                            2
                                                        ]}},
                                                    ]},
                                                    {$multiply:[
                                                        {$cos:"$$lat1"},
                                                        {$cos:"$$lat2"},
                                                        {$sin:{$divide:[
                                                            "$$diffLong",
                                                            2
                                                        ]}},
                                                        {$sin:{$divide:[
                                                            "$$diffLong",
                                                            2
                                                        ]}},
                                                    ]}
                                                ]}
                                            ]
                                        }}
                                    ]}
                                ]}
                            ]
                        },1000] // divide to 1000 to get the distance by kilometer
                    }
                }
            }
        }
    });
    
    // get the data that matched with the condition
    query.push({
        $match:{distance:{$lte:filter.distance}}
    });
    
    let project = {
        id:1,
        latitude:1,
        longitude:1,
        name:1,
        values:1
    }
    let withValues = true;
    // check the filter if it has prize value data
    if(!filter.prize_value){
        delete project.values;
        withValues = false;
    }
    // build the final data to be shown in api, remove other data that is not needed
    query.push({
        $project:project
    });
    return new Promise((res,rej) =>{
        // execute query
        models.treasures.aggregate(query).exec((err,result) => {
            if(err){
                rej(err);
            } else {
                if(withValues){
                    result = result.map((data)=>{
                        let value = data.values.reduce((prev,current)=> prev.amount>current.amount ? current : prev);
                        delete data.values;
                        data.value = value;
                        return data;
                    })
                }
                
                res(result);
            }
        });
    })
}

// pull user data
const getUser = (query = {},password=false)=>{
    return new Promise((res,rej)=>{
        let collection = [];
        let qry = [
            {$match:query}
        ];
        models.users.aggregate(qry,(error,response)=>{
            if(error) {rej({status:false,message:"Please Try Again Later."})};
            for(var key in response){
                let index = collection.length;
                collection[index] = {...response[key]}
                if(!password){
                    delete collection[index].password;
                }
            }
            res(collection);
        })
    });
}

// get treasure algorithm
// 5 Minute cooldown every treasure search
const getTreasure = (query)=>{
    return new Promise((res,rej)=>{
        
        // validate if user exists
        models.users.findOne({email:query.email,password:query.password}).exec(function(error,result){
            if(error){
                rej(error);
            } else if(result) {
                let last_treasure = new Date(result.last_treasure);
                let now = new Date();
                now.setMinutes(now.getMinutes()-5);

                // check if the user is still on cooldown time
                if(now.getTime() < last_treasure.getTime()){
                    // get total seconds between the times
                    let diff = Math.abs(last_treasure - now) / 1000;

                    // calculate (and subtract) whole minutes
                    let minutes = Math.floor(diff / 60) % 60;
                    diff -= minutes * 60;

                    // what's left is seconds
                    let seconds = Math.round(diff % 60);  // in theory the modulus is not required
                    
                    // return cooldown message
                    res({message:`${minutes} Minute(s) and ${seconds} Second(s) left until next treasure hunt.`});
                } else {
                    
                    // get treasure near the user coordinates
                    findTreasure(query)
                    .then((treasures)=>{
                        // pick random treasure that is found within user search
                        let pickRandomTreasure = Math.floor(Math.random() * (treasures.length - 1 + 1));
                        
                        // user data to be updated
                        result.last_treasure = new Date();
                        let treasureFound = false;
                        if(treasures[pickRandomTreasure]){
                            treasureFound = true;
                            result.treasures.push(treasures[pickRandomTreasure]);
                        }
                        
                        // save user data
                        result.save(async (error,result)=>{
                            if(error){
                                rej(error);
                            } else {

                                // try again message
                                let response = {
                                    message:`No Treasure Found, Please Try Again Later. Treasure hunting will be available after 5 Minutes.`,
                                    data:{
                                        email:result.email,
                                        name:result.name,
                                        age:result.age,
                                        id:result.id,
                                        foundTreasure:{}
                                    }
                                };
                                // if treasure is found 
                                if(treasureFound){
                                    const filter = { _id: Types.ObjectId(treasures[pickRandomTreasure].value._id) };
                
                                    await models.money_values.findOneAndUpdate(filter, {found:1}); //update treasure money_values data after treasure is found

                                    //congratulations message
                                    response = {
                                        message:`Congratulations User ${result.name}, you found treasure ${treasures[pickRandomTreasure].name} with the amount of $${treasures[pickRandomTreasure].value.amount}. Treasure hunting will be available after 5 Minutes.`,
                                        data:{
                                            email:result.email,
                                            name:result.name,
                                            age:result.age,
                                            id:result.id,
                                            foundTreasure:treasures[pickRandomTreasure]
                                        }
                                    }
                                }
                                
                                res(response);
                            }
                        })
                    })
                    .catch((err)=>{
                        console.log(err);
                    })
                }
            } else {
                rej({message:"Data Not Found."});
            }
        })
    });
}
module.exports = {
    findTreasure,
    getUser,
    getTreasure
}