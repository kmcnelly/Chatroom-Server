// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");


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


	app.get('/', function(req, res) {
	res.sendfile('index.html');
 });
 
 var roomno = 1;
 io.on('connection', function(socket) {
	
	//Increase roomno 2 clients are present in a room.
	if(io.nsps['/'].adapter.rooms["room-"+roomno] && io.nsps['/'].adapter.rooms["room-"+roomno].length > 1) roomno++;
	socket.join("room-"+roomno);
 
	//Send this event to everyone in the room.
	io.sockets.in("room-"+roomno).emit('connectToRoom', "You are in room no. "+roomno);
 })
 
	// This callback runs when a new Socket.IO connection is established.
	
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		console.log("message: "+data["message"]); // log it to the Node.JS output
		io.sockets.emit("message_to_client",{message:data["message"] }) // broadcast the message to other users
	});
});
