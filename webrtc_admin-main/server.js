const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Define admin IDs
const adminIds = ['admin1', 'admin2'];
let adminSockets = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('adminLogin', (inputAdminId) => {
        if (adminIds.includes(inputAdminId)) {
            if (adminSockets[inputAdminId]) {
                socket.emit('adminLoginFailure', 'Admin already logged in');
            } else {
                adminSockets[inputAdminId] = { socket: socket, available: true };
                console.log(`Admin ${inputAdminId} logged in`);
                socket.emit('adminLoginSuccess');
                socket.isAdmin = true; // Mark the socket as admin
            }
        } else {
            socket.emit('adminLoginFailure', 'Invalid admin ID');
        }
    });

    socket.on('login', () => {
        console.log('User logged in');
        socket.emit('loginSuccess');
    });

    socket.on('offer', (offer) => {
        const availableAdminId = Object.keys(adminSockets).find(adminId => adminSockets[adminId] && adminSockets[adminId].available);
        if (availableAdminId) {
            adminSockets[availableAdminId].available = false;
            adminSockets[availableAdminId].socket.emit('offer', offer);
            socket.currentAdminId = availableAdminId; // Save the admin ID handling the current call
            console.log('Offer sent to admin:', availableAdminId);
        } else {
            socket.emit('adminNotAvailable');
        }
    });

    socket.on('answer', (answer) => {
        if (socket.currentAdminId) {
            adminSockets[socket.currentAdminId].socket.emit('answer', answer);
            console.log('Answer received and sent to admin:', socket.currentAdminId);
            io.emit('callStarted'); // Emit callStarted event when the answer is received
        }
    });

    socket.on('candidate', (candidate) => {
        if (socket.currentAdminId) {
            adminSockets[socket.currentAdminId].socket.emit('candidate', candidate);
            console.log('Candidate received and sent to admin:', socket.currentAdminId);
        }
    });

    socket.on('endCall', () => {
        if (socket.currentAdminId) {
            adminSockets[socket.currentAdminId].available = true;
            console.log(`Admin ${socket.currentAdminId} is now available`);
            socket.currentAdminId = null; // Clear the admin ID handling the call
        }
        socket.broadcast.emit('endCall');
        console.log('Call ended');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        Object.keys(adminSockets).forEach(adminId => {
            if (adminSockets[adminId].socket === socket) {
                delete adminSockets[adminId];
            }
        });
    });

    socket.on('transcript', (transcript) => {
        if (socket.isAdmin) {
            // Display the transcript on the admin's console
            console.log('User says:', transcript);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
});
