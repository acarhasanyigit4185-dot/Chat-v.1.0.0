const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Odaların bilgisini RAM'de tutalım: { odaKodu: { owner: id, users: { id: username } } }
const roomsData = {};

io.on('connection', (socket) => {
    
    // KULLANICI ODAYA GİRMEK İSTEDİĞİNDE
    socket.on('requestJoin', (data) => {
        const { room, username } = data;
        
        // Eğer oda yoksa, ilk giren kişiyi sahibi yap
        if (!roomsData[room] || Array.from(io.sockets.adapter.rooms.get(room) || []).length === 0) {
            roomsData[room] = { owner: socket.id, users: {} };
            socket.join(room);
            roomsData[room].users[socket.id] = username;
            
            socket.emit('joinApproved', { room, isOwner: true });
            updateRoomInfo(room);
        } else {
            // Oda varsa, sahibine sor (onay iste)
            const ownerId = roomsData[room].owner;
            io.to(ownerId).emit('askOwnerPermission', { 
                requestingUser: username, 
                socketId: socket.id 
            });
            socket.emit('waitingApproval');
        }
    });

    // SAHİBİ ONAY VERDİĞİNDE
    socket.on('ownerResponse', (data) => {
        const { room, socketId, username, approved } = data;
        
        if (approved) {
            const guestSocket = io.sockets.sockets.get(socketId);
            if (guestSocket) {
                guestSocket.join(room);
                roomsData[room].users[socketId] = username;
                guestSocket.emit('joinApproved', { room, isOwner: false });
                updateRoomInfo(room);
            }
        } else {
            io.to(socketId).emit('joinRejected');
        }
    });

    // MESAJLAŞMA
    socket.on('sendMessage', (data) => {
        io.to(data.room).emit('receiveMessage', data.message);
    });

    // AYRILMA DURUMU
    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (roomsData[room] && roomsData[room].users[socket.id]) {
                delete roomsData[room].users[socket.id];
                
                // Eğer sahibi çıktıysa, bir sonrakini sahibi yap (isteğe bağlı)
                if (roomsData[room].owner === socket.id) {
                    const remaining = Array.from(roomsData[room].users);
                    roomsData[room].owner = remaining.length > 0 ? Object.keys(roomsData[room].users)[0] : null;
                }
                
                setTimeout(() => updateRoomInfo(room), 100);
            }
        });
    });

    function updateRoomInfo(room) {
        if (roomsData[room]) {
            const userList = Object.values(roomsData[room].users);
            io.to(room).emit('roomUpdate', {
                count: userList.length,
                users: userList
            });
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sistem ${PORT} portunda aktif.`));
