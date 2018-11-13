// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
	bcrypt = require("bcrypt");
//object users – Key: the usernames, values are the sockets
var users = {};
//array for rooms [name, password (hashed with bcrypt)]
var rooms = [];
//helper to iterate through the rooms if it exists
function roomLoop(array, item){
	for (var i = 0; i < array.length; i++) {
		if(array[i][0] == item){
			return array[i][1];
		}
		else{
			return false;
		}
	}
	return "no";
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
 
	//runs when trying to join a room
	socket.on('join', function(data) {
		var password = roomLoop(rooms,data['room']);
		if(!password){
			socket.emit("message_to_client",{message: "room doesn't exist"});
		}
		// console.log(password);
		var res = bcrypt.compareSync(data['password'],password);
		if(res){
			socket.join(data['room']);
		}
		else{
			socket.emit("message_to_client",{message: "wrong password nerd"});
		}
		
	});
	// This callback runs when a new Socket.IO connection is established.

	//emits updated user list
	function updateUsers(){

		//send just the usernames. Just like an Array –Followed Online
		io.sockets.emit('getUsers', Object.keys(users));
	}

	//new user entered 
	socket.on('new_user', function(data, callback){
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
		
	})
	socket.on('createroom', function(data){
		var xizt = roomloop(rooms, data['room']);
		if(xizt == "no"){
			socket.emit("message_to_client",{message: "room already exists"});
		}
		else{
		var i = rooms.length;
		var pass = data['password'];
		var password = bcrypt.hashSync(pass, 10);
		rooms[i] = [data['room'],password];
		console.log(password);
		io.emit("newroom",{name: data['room']});
		}
	});
	

	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		var sendTo = data["sendTo"];

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

			io.sockets.emit("message_to_client", {message:data["message"], user: socket.usernam, bold:data["bold"] }) // broadcast the message to other users
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
	})
});
