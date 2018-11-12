// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
	bcrypt = require("bcrypt");


// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	fs.readFile("client-alex.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3457);

// Do the Socket.IO magic:
var io = socketio.listen(app);
var rooms = [];
function roomLoop(array, item){
	for (var i = 0; i < array.length; i++) {
		if(array[i][0] == item){
			return array[i][1];
		}
	}
	return "no";
}
 io.sockets.on('connection', function(socket) {
	for(var i = 0; i < rooms.length; i++){
		var name = rooms[i][0];
		io.emit("newroom",{name: name});
	}
	socket.join();
	//if the user decides to join a room, then it'll send them to join the room

	socket.on('join', function(data) {
		var password = roomLoop(rooms,data['room']);
		// console.log(password);
		var res = bcrypt.compareSync(data['password'],password);
		if(res){
			socket.join(data['room']);
		}
		else{
			io.emit("message_to_client",{message: "wrong password nerd"});
		}
		
	});
    // This callback runs when a new Socket.IO connection is established.
  
     //Send this event to everyone in the room.
    //  io.sockets.in("room-"+roomno).emit('connectToRoom', "You are in room no. "+roomno);
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		console.log("message: "+data["message"]);
		room = data['room']; // log it to the Node.JS output
		io.sockets.to(room).emit("message_to_client",{message:data["message"]}) // broadcast the message to other users
	});
	//right now we're just sending this to the console
	socket.on('listrooms',function(){
		console.log(rooms);
	});
	socket.on('createroom', function(data){
		var i = rooms.length;
		var pass = data['password'];
		var password = bcrypt.hashSync(pass, 10);
		rooms[i] = [data['room'],password];
		console.log(password);
		io.emit("newroom",{name: data['room']});
	});
 });
