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
var rusers = [];

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
	//prints the list of existing rooms to the dropdown.
	socket.join('general');
	for(var i = 0; i < rooms.length; i++){
		var name = rooms[i][0];
		// socket.to(socket.username).emit("newroom",{name: name});
		socket.emit("newroom",{name: name});
	}
	// runs when trying to join a room
	socket.on('join', function(data) {
		console.log(data['room']);
		if(data['room'] == 'general'){
			socket.join('general');
		}
		else{
		//password is just the variable name, this just stores the value of roomLoop
		var password = roomLoop(rooms,data['room']);
		if(!password){
			socket.emit("message_to_client",{message: "room doesn't exist", user:'Chat Error'});
		}
		console.log(password);
		var res = bcrypt.compareSync(data['password'],password);
		if(res){
			socket.join(data['room']);
		}
		else{
			socket.emit("message_to_client",{message: "wrong password", user:'Chat Error'});
		}
	}
	});
	socket.on('leave', function(data){
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
		if(bans.includes(data)){
			callback(false);

			console.log("User is banned");
		}
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
			io.sockets.emit("user_entered", {message:data["message"], user: socket.username });

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
			io.emit("newroom",{name: data['room']});
		}
		else{
			socket.emit("message_to_client",{message: "room already exists", user:'Chat Error'});
		}
	});
	

	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		var sendTo = data["sendTo"];
		var room = data['room'];
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

	socket.on('disconnect', function(data){
		//if user did not enter the actual chat
		if(!socket.username){
			return;
		}

		//remove user from current list of users – Followed Online
		delete users[socket.username];

		
		console.log("User left");

		//notifies chat room of leaving
		io.sockets.emit("user_left", {message:data["message"], user: socket.username })

		updateUsers();
	});
	socket.on('kick', function(data) {
		var sucker = data['user'];
		var maker = findCreator(rooms,data['room']);
		console.log(maker);
		if(maker = socket.username){
			console.log(users[sucker].id);
			socket = io.sockets.connected[users[sucker].id];
			console.log(data['room']);
			socket.leave(data['room']);
			socket.emit("message_to_client",{message: "You have been kicked.", user:'Admin'})
			socket.emit("kicked");
		} 
	else{
		socket.emit("message_to_client",{message: "insufficient privileges"});
	}
	  });
	socket.on('ban', function(data){
		if (typeof io.sockets.sockets[data['user']] != 'undefined') {
			socket.emit('message', {text: users[socket] + ' kicked: ' + data['user']});
			io.sockets.sockets[users[socket.username]].disconnect();
			bans.push(data['user'], room);
		  } else {
			socket.emit('message', {text: 'User: ' + data['user'] + ' does not exist.'});
		  }
		});
	});
