// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

//object users – Key: the usernames, values are the sockets
var users = {};


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

	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		var sendTo = data["sendTo"];

		if(sendTo in users){
			//WHISPER

			console.log("WHISPER:" + data["message"]);

			//send PRIVATE to reciever
			users[sendTo].emit("whisperTo", {message:data["message"], user: socket.username });

			//send COPY PRIVATE to sender
			users[socket.username].emit("whisperFrom", {message:data["message"], user:sendTo });
		}
		else{
			//to ALL
			console.log("message: "+data["message"]); // log it to the Node.JS output

			io.sockets.emit("message_to_client", {message:data["message"], user: socket.username }) // broadcast the message to other users
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
