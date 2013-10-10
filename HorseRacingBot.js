/*
Creator: AHuman (CoinChat username) for EAP Bots (ahuman@ace-productions.net)
Code written for: virtualmining (CoinChat username)
Filename: DerbyBot.js
Required Node.js Modules: socket.io-client
Creation Date: 24/09/2013
Last Update: 24/09/2013

Note: Parts of this code remain the property of EAP Bots, as the code is based off of AlgebraBot. However, this does not mean that you cannot modify this code to your liking,
it simply means that some parts may not have been modified, thus creating the appearance that EAP kept the code created for you. This is false; all of the code found in this
file was not copied from it, it was copied to it.
*/
/***************Constants***************/
const CC_USERNAME = "Robobot"; //self-explanatory
const CC_PASSWORD = ""; //self-explanatory
const CC_ROOM = "horseracing"; //room that the bot will operate in

const jockeyPrice = 1; //how much the user must pay (in mBTC) to become a jockey for the round
const maxJockeys = 8;

const allowedUsers = ["AHuman", "MrRoboman4321", "virtualmining"]; //people who can run admin commands

const jockeyMult = 2; //how much to multiply jockey 
const betMult = 1.5; //how much to multiply bets by
const houseEdge = 0.06; //percent that the house takes (note:le 0.06 = 6%)
const WINMULT = [1.2, 1.3, 1.5, 1.7, 2, 2.1, 2.3]; //These are multipliers for winnings. First value is for 2 bots, second for 3, etc up to 8. DISCLAIMER: Math not worked out for these values, you may lose money. CHANGE THESE.

/***************Main Program***************/
var io = require('socket.io-client');
socket = io.connect('https://coinchat.org:443',{secure: true}); //try adding reconnect: false or true if needed

var users = [];

var fs = require('fs');
var json;

var username = "";
var outputBuffer = [];

var color = "#000000";

var userData = {}; //format = username:[balance: balance, wins: wins, losses: losses]

var gameState = 0; //0 = no game, 1 = one player bet, 2 = both players bet, 3 = game in progress
var gameData = {}; //format = {bets: {horse{players:players, bets:bets}, jockeys: {horsenumber:jockeyname}}

var balance = 0;
var startup = true;

var profit = 0;

var debug = true;
var isConnected = false;

var numJockeys = 0;
var winningJockey = 0;
var userBet = [];
var numBetters = 0;
var jockeys = [];
var running = false;
//begin main code

socket.on('connect', function(){
	socket.emit("accounts", {action: "login", username: CC_USERNAME, password: CC_PASSWORD}); //Login
    socket.on('loggedin', function(data){
	    isConnected = true; //Successfully connected
    	username = data.username;
		console.log("loggedin. username: " + username); //Log the user
		outputBuffer.push("chat", {room: CC_ROOM, message: "HorseRacingBot is online!", color: color});
		outputBuffer.push("chat", {room: CC_ROOM, message: "/topic Become a Jockey, or bet on which horse is going to win! !help for more information.", color: color});		
		
		if(debug)
		{
			outputBuffer.push("chat", {room: CC_ROOM, message: "I am currently being debugged; please pardon any issues/downtime.", color: color}); //Debug message
		} 
				socket.emit("getbalance", {}); //Find avaliable balance and colors
				socket.emit('getcolors', {});
				
				socket.emit('joinroom', {join: CC_ROOM});
				//socket.emit('joinroom', {join: 'lobby'});
				
				loadData(true);
				
				setTimeout(function()
				{
					startup = false;
				}, 1000);
    });
	socket.on('chat', function(data)
	{
		
		if(startup)
		{
			return;
		}
        console.log(data.message);
		if (data.message.substr(0, 21) === "<span style=\"color: #") 
		{//color handling crap
			data.message = data.message.slice(26, -8);
		}
		
		var words = data.message.toLowerCase().split(" ");
		
		if(words[0] == "!horserace" && data.room != CC_ROOM)
		{
			outputBuffer.push({room: data.room, message:'Hi ' + data.user + "! Come over to #horseracing and type !help for information!", color: color});
		}
		else if(words[0] == "!horserace" && data.room == CC_ROOM)
		{
			outputBuffer.push({room: data.room, message:'Hi ' + data.user + "! Type !help for game information!", color: color});
		}
		else if(words[0] == "!help" && data.room === CC_ROOM)
		{
			outputBuffer.push({room: data.room, message:data.user + ": Welcome to HorseRacingBot. Bet on virtual horses, or play as a jockey for a chance to win big!", color: color});
			outputBuffer.push({room: data.room, message:data.user + ":  To add to your balance, tip me! Then, you can either say !bet <bet> <jockey #> or !jockey to play!", color: color});
		}
		else if(words[0] == "!commands" && data.room === CC_ROOM)
		{
			outputBuffer.push({room: data.room, message: data.user + ": !help, !bet <bet> <jockey #>, !jockey, !balance, !cashout, !horses", color: color});
		}
		else if(words[0] =="!balance" && data.room === CC_ROOM)
		{
			if(userData[data.user])
			{
				outputBuffer.push({room: data.room, message: data.user + ": Your current balance is " + userData[data.user]["balance"] + " mBTC", color: color});
			}
			else
			{
				outputBuffer.push({room: data.room, message: data.user + ": No user data found! Tip me to get started!", color: color});
			}
		}
		else if(words[0] == "!cashout" && data.room === CC_ROOM)
		{
			console.log("!cashout " + data.user);
			if(userData[data.user])
			{
				console.log("user exists");
				if(userData[data.user]["balance"] > 0.25)
				{
					if(balance > userData[data.user]["balance"])
					{
					    console.log("user has enough money");
						tip(data.user, CC_ROOM, userData[data.user]["balance"], "!cashout");
						userData[data.user]["balance"] = 0;
						saveData(false);
					}
					else
					{
					    outputBuffer.push({room: CC_ROOM, message: "Sorry! The bot does not have enough to pay you back. Continue playing until the bot has enough balance to pay back!", color:"#000000"});
					}
					
				}
				else
				{
					console.log("user doesn't have enough");
					outputBuffer.push({room: data.room, message: data.user + ": You need at least 0.25mBTC to withdraw! \ Your current balance is " + userData[data.user]["balance"] + " mBTC", color: color});
				}
			}else
			{
				outputBuffer.push({room: data.room, message: data.user + ": No user data found! Tip me to get started!", color: color});
			}
		}
		else if(words[0] == "!bet" && data.room === CC_ROOM)
		{
			var bet = words[1];
			var horse = words[2];
			if(!bet || bet == "")
			{
				outputBuffer.push({room: data.room, message: data.user + ": No bet found! Please enter a bet after !bet", color: color});
				return;
			}
			else if(bet < 0.1)
			{
				outputBuffer.push({room: data.room, message: data.user + ": Bet is too small! Please bet at least 0.1mBTC", color: color});
				return;
			}
			else if(!horse || horse == "")
			{
				outputBuffer.push({room: data.room, message: data.user + ": No horse found! Please enter a horse after your bet", color: color});
				return;
			}
			else if(horse < 1 || horse > 5)
			{
				outputBuffer.push({room: data.room, message: data.user + ": Invalid horse number! Please choose a horse between 1-5", color: color});
				return;
			}
			
			if(userData[data.user])
			{
				if(userData[data.user]["balance"] > bet || userData[data.user]["balance"] == bet)
				{
					userData[data.user]["balance"] = userData[data.user]["balance"] - bet;
					userData[data.user]["balance"] = Math.round(userData[data.user]["balance"] * 1000) / 1000;
					outputBuffer.push({room: data.room, message: data.user + ": You have bet " + bet + " mBTC on horse # " + horse, color: color});
					userBet.push([data.user, horse, bet]);
					numBetters += 1;
				}
				else
				{
					outputBuffer.push({room: data.room, message: data.user + ": You don't have enough mBTC for that bet! \ Your current balance is " + userData[data.user]["balance"] + " mBTC", color: color});
				}
			}
			else
			{
				outputBuffer.push({room: data.room, message: data.user + ": No user data found! Tip me to get started!", color: color});
			}
						
		}
		else if(words[0] == "!jockey" && data.room === CC_ROOM)
		{
			if(userData[data.user])
			{
				if(numJockeys === 7)
				{
					outputBuffer.push({room: CC_ROOM, message: "Sorry, max jockeys already in the game! Bet on one.", color: color});
				}
				else if(userData[data.user]["balance"] > 1 || userData[data.user]["balance"] == 1)
				{
					gameState = 2;
					userData[data.user]["balance"] = userData[data.user]["balance"] - 1;
					userData[data.user]["balance"] = Math.round(userData[data.user]["balance"] * 1000) / 1000;
					outputBuffer.push({room: data.room, message: data.user + ": You have joined the game!", color: color});
					numJockeys += 1
					jockeys.push(data.user);
					console.log(jockeys);
				}
				else
				{
					outputBuffer.push({room: data.room, message: data.user + ": You don't have enough mBTC for that bet! \ Your current balance is " + userData[data.user]["balance"] + " mBTC", color: color});
				}
			}
			else
			{
				outputBuffer.push({room: data.room, message: data.user + ": No user data found! Tip me to get started!", color: color});
			}
			saveData(false);
		}
		else if(contains(data.message.toLowerCase(), ["<span class='label label-success'>has tipped " + username]))
		{
			var amount = data.message.split("<span class='label label-success'>has tipped " + username + " ")[1].split(" ")[0];
			amount = Number(amount);
			if(userData[data.user])
			{
				userData[data.user]["balance"] = userData[data.user]["balance"] + amount;
			}
			else
			{
				userData[data.user] = {balance: amount, wins: 0, losses: 0};
			}
			outputBuffer.push({room: data.room, message: data.user + ": " + amount + " mBTC has been added to your balance! Start a new game with !start <bet>", color: color});
			saveData(false);
			socket.emit("getbalance", {});
		}
		/*else if(words[0] == "!info" && data.room == CC_ROOM)   ******************FOR LATER********************
		{
			if(gameState == 1)
			{
				outputBuffer.push({room: data.room, message: data.user + ": The current game bet is " + gameData["bet"] + "mBTC and " + gameData["players"][0] + " is the only person in the game", color: color});
			}
			else if(gameState == 2 || gameState == 3)
			{
				outputBuffer.push({room: data.room, message: data.user + ": The current game bet is " + gameData["bet"] + "mBTC and " + gameData["players"][0] + " and " + gameData["players"][1] + " are playing.", color: color});
			}
			else
			{
				outputBuffer.push({room: data.room, message: data.user + ": There is no active game! Say !start <bet> to create one!", color: color});
			}
		}*/
		else if(words[0] == "!leave" && data.room == CC_ROOM)
		{
			if(data.user == gameData["players"][0])
			{
				if(gameState == 1)
				{
					gameState == 0;
					userData[gameData["players"][0]]["balance"] = userData[gameData["players"][0]]["balance"] + gameData["bet"];
					gameData = {};
				}
				else if(gameSate == 3)
				{
					gameState == 0;
					var mBTC = gameData["bet"]*2;
					var winnings = mBTC*0.9;
					var userBalance = userData[gameData["players"][1]]["balance"] + winnings;
					userData[gameData["players"][1]]["balance"] = Math.round(userBalance * 1000) / 1000;
					userData[gameData["players"][1]]["wins"] ++;
					userData[gameData["players"][0]]["losses"]++;
					profit = profit + mBTC*0.1;
					saveData(false);
					outputBuffer.push({room: data.room, message: data.user + " has quit the game! Therefore, " + gameData["players"][1] + " wins by default. X was equal to " + gameEquation["x"], color: color});
				}
			}
		
			else if(data.user == gameData["players"][1])
			{
				if(gameState == 1)
				{
					gameState == 0;
					userData[gameData["players"][1]]["balance"] = userData[gameData["players"][1]]["balance"] + gameData["bet"];
					gameData = {};
				}
				else if(gameSate == 3)
				{
					gameState == 0;
					var mBTC = gameData["bet"]*2;
					var winnings = mBTC*0.9;
					var userBalance = userData[gameData["players"][0]]["balance"] + winnings;
					userData[gameData["players"][0]]["balance"] = Math.round(userBalance * 1000) / 1000;
					userData[gameData["players"][0]]["wins"] ++;
					userData[gameData["players"][1]]["losses"]++;
					profit = profit + mBTC*0.1;
					saveData(false);
					outputBuffer.push({room: data.room, message: data.user + " has quit the game! Therefore, " + gameData["players"][0] + " wins by default. X was equal to " + gameEquation["x"], color: color});
				}
			}
		}
		
		if(numJockeys >= 1 && userBet.length != 0 && running === false)
		{
			outputBuffer.push({room: CC_ROOM, message: "Game is ready to begin! Will begin in one minute for remaining bets and entrants to be proccessed.", color: color});
			outputBuffer.push({room: CC_ROOM, message: CC_USERNAME + " joined the game!", color: color});
			jockeys.push(CC_USERNAME);
			numJockeys += 1;
			console.log(userBet);
			running = true;
			setTimeout(function()
			{
				outputBuffer.push({room: CC_ROOM, message: "And they're off! All the horses race from the starting line! Who will win?", color:"#000000"});
				setTimeout(function()
				{
					winningJockey = Math.floor((Math.random()*numJockeys)+1);
							
					outputBuffer.push({room: CC_ROOM, message: "And the winning horse is: " + jockeys[winningJockey - 1], color: color});
					for (var i=0; i<userBet.length; i++) 
					{
						console.log(userBet[i]);
						if(userBet[i][1].toLowerCase() === jockeys[winningJockey - 1].toLowerCase())
						{
						    outputBuffer.push({room: CC_ROOM, message: userBet[i][0] + " got it right! You get " + WINMULT[numJockeys - 2] + " times your original bet!", color: color});
							userData[userBet[i][0]]["balance"] = userData[userBet[i][0]]["balance"] + (userBet[i][2] * WINMULT[numJockeys - 2]);
						}
						if(jockeys[winningJockey - 1] != CC_USERNAME)
						{
							outputBuffer.push({room: CC_ROOM, message: jockeys[winningJockey - 1] + " wins 2 mBTC back!", color: color});
							console.log(jockeys[winningJockey - 1]);
							userData[jockeys[winningJockey - 1]]["balance"] += 2
						}
						else
						{
							outputBuffer.push({room: CC_ROOM, message: "Bot jockey won! It doesn't get anything, its a bot!", color: color});
						}
					}
					jockeys = []; //Users who have entered
					numJockeys = 0; //Number of jockeys in the game
					winningJockey = 0; //Winner 
					userBet = []; //Users who have bet
					gameState = 0; //Game state
					running = false;
				}, 1000);
				
			}, 10000);
					
		}
		
			
		
	
		else
		{//mod only stuffs
			var isAllowed = false;
			for(var i = 0; i < allowedUsers.length; i++)
			{
				if(data.user == allowedUsers[i])
				{
					isAllowed = true;
				}
			}
			
			
			if(isAllowed)
			{
				if(contains(data.message.toLowerCase(), ["!shutdown"]) && data.room === CC_ROOM)
				{
					outputBuffer.push({room: data.room, message: data.user + ": Shutting down...", color: color});
					saveData(true);
					setTimeout(function()
					{
						process.exit();
					}, 1500);
				}
				else if(contains(data.message.toLowerCase(), ["!tip"]) && data.room === CC_ROOM)
				{
					var words = data.message.split(" ");
					if(words.length == 3)
					{
						tip(words[1], data.room, words[2]);
					}
					else if(words.length == 4)
					{
						tip(words[1], data.room, words[2], words[3]);
					}
					else
					{
						outputBuffer.push({room: data.room, message: data.user + ": Incorrect parameters!", color: color});
					}
				}
				else if(contains(data.message.toLowerCase(), ["!save"]) && data.room === CC_ROOM)
				{
					outputBuffer.push({room: "AlgebraBot", message: data.user + ": Saving...", color: color});
					saveData(true);
				}
				else if(contains(data.message.toLowerCase(), ["!load"]) && data.room === CC_ROOM)
				{
					outputBuffer.push({room: "AlgebraBot", message: data.user + ": Loading...", color: color});
					loadData(true);
				}
				else if(contains(data.message, ["!setbal"]) && data.room === CC_ROOM)
				{
				    var words = data.message.split(" ");
					var user = words[1];
					var amount = words[2];
					userData[user] = {balance: amount, wins: 0, losses: 0};
					outputBuffer.push({room: data.room, message: "Set " + user + " balance to " + amount, color:"#000000"});
				}	
			}
		}
	});
	
	socket.on("message", function(msg) 
	{
		console.log('[CoinChat] ' + msg.message)
    });
	
	socket.on("balance", function(data)
	{
		balance = Number(data.balance);
	});
	
	/*socket.on("joinroom", function(data) 
	{
        if (data.room === "eap") {
            users = data.users;
        }
    });*/
	
	socket.on('disconnect', function() 
	{
		saveData();
		isConnected = false;
		startup = true;
        outputBuffer.push({room: CC_ROOM, message: "/topic Horse racing is down!", color: color});
		console.log('[AlgebraBot] Lost connection. Stopping...');
		socket.disconnect();
		setTimeout(function(){
			process.exit();
		}, 1000);
    });
});

setInterval(function()
{
	if(!isConnected)
	{
		return;
	}
    //CoinChat has a 550ms anti spam prevention. You can't send a chat message more than once every 550ms.
    if(outputBuffer[0])
	{
		console.log(outputBuffer[0]);
		socket.emit("chat", outputBuffer[0]);
    	outputBuffer.splice(0,1);
    }
}, 600);


function contains(string, terms)
{
	for(var i=0; i<terms.length; i++)
	{
		if(string.toLowerCase().indexOf(terms[i].toLowerCase()) == -1)
		{
			return false;
		}
	}
	return true;
}

//function prize(winner){
	//for(var i=0; i<
//}

function pm(user, msg, color) 
{
        outputBuffer.push({room: 'EAPBot:' + user.toLowerCase(), message: msg, color: color});
}

function tip(user, room, amount)
{
	socket.emit("tip", {room: room, user: user, tip: amount, message: ""});
}

function tip(user, room, amount, message)
{
	socket.emit("tip", {room: room, user: user, tip: amount, message: message});
}

function loadData(notify)
{
	fs.readFile("./AlgebraBot.dat", 'utf8', function(err, data){
	if(err) throw err;
		json = JSON.parse(data);
		userData = json["userData"];
		profit = json["profit"];
		console.log("AlgebraBot.dat loaded!");
		if(notify == true){
			outputBuffer.push({room: CC_ROOM, message: "HorseRacingData.dat loaded!", color: color});
		}
	});
}

function saveData(notify)
{
	json = JSON.stringify({userData: userData, profit: profit});
	fs.writeFile("./AlgebraBot.dat", json, function(){
		console.log("Horse racing bot data saved!");
		if(notify == true){
			outputBuffer.push({room: CC_ROOM, message: "AlgebraBot.dat saved!", color: color});
			outputBuffer.push({room: CC_ROOM, message: "/topic BOT IS OFFLINE, DO NOT TIP!!!!!", color: color});
		}
	});
}