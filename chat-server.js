// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
	bcrypt = require("bcrypt");
//object users – Key: the usernames, values are the sockets
var users = {};
//array for rooms [name, password (hashed with bcrypt)]
var rooms = [];
var bans = [];
var rusers = []; //holds the users in each room
var rusersHelper = []; //maps the positions of the rooms

//helper to iterate through the rooms if it exists
function roomLoop(array, item){
	for (var i = 0; i < array.length; i++) {
		if(array[i][0] == item){
			return array[i][1];
		}
	}
	return false;
}
function findCreator(array, item){
	for (var i = 0; i < array.length; i++) {
		if(array[i][0] == item){
			return array[i][2];
		}
	}
	return false;
}
function findUser(array, item, where){
	for (var i = 1; i < array[where].length; i++) {
		console.log(array[where][i])
		if(array[where][i] == item){
			return i;
		}
	}
	return false;
}	
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);

io.sockets.on("connection", function(socket){

	//join general by default
	socket.join('general');
	socket.room = 'general';
	//prints the list of existing rooms to the dropdown.

	for(var i = 0; i < rooms.length; i++){
		var name = rooms[i][0];
		// socket.to(socket.username).emit("newroom",{name: name});
		socket.emit("newroom",{name: name});
	}


	// runs when trying to join a room
	socket.on('join', function(data) {
		//check room to join
			//if joining general
		if(data['room'] == 'general'){
			socket.join('general');
			socket.room = 'general';
		}
			//joining other
		else{
			var where = rusersHelper.indexOf(data['room']);
		console.log(where);
		console.log(bans[where]);
		if(bans[where].includes(socket.username)){
			socket.emit("message_to_client",{message: "you are banned!", user:'Admin'});
			socket.emit("banned",{room: data['room']});
		}
		else{
			var password = roomLoop(rooms,data['room']);
			if(!password){
				socket.emit("message_to_client",{message: "room doesn't exist", user:'Chat Error'});
			}
			console.log(password);

			//Password result
			var res = bcrypt.compareSync(data['password'],password);

			//enter room or not
			if(res){

				socket.join(data['room']);
				
				socket.room = data['room'];
				var where = rusersHelper.indexOf(data['room']);
				rusers[where].push(socket.username);
				console.log(rusers);
				//notifies chatroom of new member
				io.sockets.to(socket.room).emit("user_entered", {message:socket.room, user: socket.username });
			}
			else{

				socket.emit("message_to_client",{message: "wrong password", user:'Chat Error'});
				socket.emit("fail");
			}
		}
	}
	});

	//leaving room
	socket.on('leave', function(data){
		var newUsers = [];
		var where = rusersHelper.indexOf(data['room']); //finds where in the array the room is
		var here = findUser(rusers, socket.username, where); //finds where in the room the user joined
		// console.log(rusers[where][here]);
		newUsers = rusers[where].splice(here,1);
		io.sockets.to(socket.room).emit("user_left", {message:socket.room, user: socket.username });
		socket.leave(data['room']);
	});
	socket.on('leaveGeneral', function(data){
		io.sockets.to(socket.room).emit("user_left", {message:socket.room, user: socket.username });

		socket.leave(data['room']);
	});
	// This callback runs when a new Socket.IO connection is established.

	//emits updated user list
	function updateUsers(){

		//send just the usernames. Just like an Array –Followed Online
		io.sockets.emit('getUsers', Object.keys(users));
	}

	//new user entered 
	socket.on('new_user', function(data, callback){
		//Check if user is banned

		// Check if username is already present
		 if(data in users){
			callback(false);

			console.log("Username same");
		}
		else{

			console.log("Username registered");
			
			callback(true);
			socket.username = data;

			//add to users
			users[socket.username] = socket;

			//notifies chatroom of new member
			io.sockets.emit("user_entered", {message:"akIRC", user: socket.username });

			//emits updated user list
			updateUsers();

			
		}
		
	});
	socket.on('createroom', function(data){
		var xizt = roomLoop(rooms, data['room']);
		console.log(xizt);
		if(xizt == false){
			var pass = data['password'];
			var password = bcrypt.hashSync(pass, 10);	
			console.log(password);
			rooms.push([data['room'],password,socket.username]);
			rusers.push([data['room']]);
			rusersHelper.push(data['room']);
			bans.push([data['room']]);
			io.emit("newroom",{name: data['room']});
		}
		else{
			socket.emit("message_to_client",{message: "room already exists", user:'Chat Error'});
		}
	});
	
//message from user
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		var sendTo = data["sendTo"];
		var room = data['room'];

		var img = data['image'];
		console.log("recieved image");


		//find user in list of users
		if(sendTo in users){
			//WHISPER

			console.log("WHISPER:" + data["message"]);

			//send PRIVATE to reciever
			users[sendTo].emit("whisperTo", {message:data["message"], user: socket.username, bold:data["bold"] });

			//send COPY PRIVATE to sender
			users[socket.username].emit("whisperFrom", {message:data["message"], user:sendTo, bold:data["bold"] });
		}
		else{
			//to ALL
			console.log("message: "+data["message"]); // log it to the Node.JS output

			io.sockets.to(room).emit("message_to_client", {message:data["message"], user: socket.username, bold:data["bold"] }) // broadcast the message to other users
			
		}
	});

//image from user
	socket.on('image_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		var room = data['room'];

		var img = data['image'];
		console.log("recieved image");

		
		//to ALL
		console.log("message: "+data["message"]); // log it to the Node.JS output

		io.sockets.to(room).emit("image_to_client", {message:data["message"], user: socket.username, image:img }) // broadcast the message to other users
		
	});

	//user disconnecting from chat
	socket.on('disconnect', function(data){
		//if user did not enter the actual chat
		if(!socket.username){
			return;
		}

		//remove user from current list of users – Followed Online
		delete users[socket.username];

		
		console.log(socket.username +" left");

		//notifies chat room of leaving
		io.sockets.emit("user_left", {message:"akIRC", user: socket.username })

		updateUsers();
	});

	// listen for being kicked out
	socket.on('kick', function(data) {
		var sucker = data['user'];
		var maker = findCreator(rooms,data['room']);
		// console.log(maker);
		if(maker == socket.username){
			var where = rusersHelper.indexOf(data['room']);
			// console.log(where); //finds where in the array the room is
			var here = findUser(rusers, data['user'], where);
			// console.log(here);
			if(findUser(rusers, data['user'], where) == false){
				socket.emit("message_to_client",{message: "user not found in room", user:'Admin'});
			}
			else{
			sucker = io.sockets.connected[users[sucker].id];
			// console.log('--');
			// console.log(data['room']);
			sucker.emit("message_to_client",{message: "You have been kicked.", user:'Admin'});
			sucker.emit("kicked", {room: data['room']});
			}
		}
		else{
		socket.emit("message_to_client",{message: "insufficient privileges", user:'Admin'});
		}
	  });
	socket.on('ban', function(data) {
		var sucker = data['user'];
		var maker = findCreator(rooms,data['room']);
		// console.log(maker);
		if(maker == socket.username){
			var where = rusersHelper.indexOf(data['room']);
			// console.log('-----'); //finds where in the array the room is
			// // var here = findUser(rusers, data['user'], where);
			// console.log(bans[where]);
			bans[where].push(sucker);
			// console.log('-----');
			// console.log(bans);
			// console.log(here);
			if(findUser(rusers, data['user'], where) == false){
				socket.emit("message_to_client",{message: "user not found in room", user:'Admin'});
			}
			else{
			sucker = io.sockets.connected[users[sucker].id];
			// console.log('--');
			// console.log(data['room']);
			sucker.emit("message_to_client",{message: "You have been banned.", user:'Admin'});
			sucker.emit("kicked", {room: data['room']});
			}
		}
		else{
		socket.emit("message_to_client",{message: "insufficient privileges", user:'Admin'});
		}
	  });
});



