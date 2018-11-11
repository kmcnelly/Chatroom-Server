// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

var usernames = [];


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
		io.sockets.emit('getUsers', usernames);
	}

	//new user entered 
	socket.on('new_user', function(data, callback){
		// Check if username is already present
		if(usernames.indexOf(data) != -1){
			callback(false);

			console.log("Username same");
		}
		else{
			console.log("Username registered");

			callback(true);
			socket.username = data;
			usernames.push(socket.username);

			//emits updated user list
			updateUsers();

		}
		
	});

	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		console.log("message: "+data["message"]); // log it to the Node.JS output

		io.sockets.emit("message_to_client", {message:data["message"], user: socket.username }) // broadcast the message to other users
	});

	socket.on('disconnect', function(data){
		//if user did not enter the actual chat
		if(!socket.username){
			return;
		}

		//finds and removes only the username from the array – Found Online 
		usernames.splice(usernames.indexOf(socket.username), 1);

		updateUsers();
	})
});