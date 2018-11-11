// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

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
 
 io.sockets.on('connection', function(socket) {
	socket.join();
	socket.on('join', function(room) {
        socket.join(room);
	});
    // This callback runs when a new Socket.IO connection is established.
  
     //Send this event to everyone in the room.
    //  io.sockets.in("room-"+roomno).emit('connectToRoom', "You are in room no. "+roomno);
	socket.on('message_to_server', function(data,room) {
		// This callback runs when the server receives a new message from the client.
		
		console.log("message: "+data["message"]); // log it to the Node.JS output
		io.sockets.to(room).emit("message_to_client",{message:data["message"] }) // broadcast the message to other users
	});
	socket.on('listrooms',function(){
		var roomlist = io.sockets.adapter.rooms;
		console.log(roomlist);
	});
 })
