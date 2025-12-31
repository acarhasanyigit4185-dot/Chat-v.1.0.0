const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const roomsData = {};

const getLogTime = () => {
    return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

io.on('connection', (socket) => {
    
    socket.on('requestJoin', (data) => {
        const { room, username } = data;
        socket.username = username;

        if (!roomsData[room] || Array.from(io.sockets.adapter.rooms.get(room) || []).length === 0) {
            roomsData[room] = { owner: socket.id, users: {} };
            socket.join(room);
            roomsData[room].users[socket.id] = username;
            
            console.log(`[${getLogTime()}] 🔵 ODA KURULDU: ${username} (Sahip) -> Oda: ${room}`);
            socket.emit('joinApproved', { room, isOwner: true });
            updateRoomInfo(room);
        } else {
            const ownerId = roomsData[room].owner;
            console.log(`[${getLogTime()}] 🛡️ GİRİŞ İSTEĞİ: ${username} -> Oda: ${room}`);
            io.to(ownerId).emit('askOwnerPermission', { requestingUser: username, socketId: socket.id });
            socket.emit('waitingApproval');
        }
    });

    socket.on('ownerResponse', (data) => {
        const { room, socketId, username, approved } = data;
        if (approved) {
            const guestSocket = io.sockets.sockets.get(socketId);
            if (guestSocket) {
                guestSocket.join(room);
                roomsData[room].users[socketId] = username;
                console.log(`[${getLogTime()}] ✅ GİRİŞ ONAYLANDI: ${username} -> Oda: ${room}`);
                guestSocket.emit('joinApproved', { room, isOwner: false });
                updateRoomInfo(room);
            }
        } else {
            console.log(`[${getLogTime()}] ❌ GİRİŞ REDDEDİLDİ: ${username} -> Oda: ${room}`);
            io.to(socketId).emit('joinRejected');
        }
    });

    socket.on('sendMessage', (data) => {
        // data: { room, prefix, message } gönderiliyor
        io.to(data.room).emit('receiveMessage', data);
    });

    socket.on('disconnecting', () => {
        const username = socket.username || "Bilinmeyen Kullanıcı";
        socket.rooms.forEach(room => {
            if (roomsData[room] && roomsData[room].users[socket.id]) {
                console.log(`[${getLogTime()}] 🔴 AYRILDI: ${username} -> Oda: ${room}`);
                delete roomsData[room].users[socket.id];
                if (roomsData[room].owner === socket.id) {
                    const remainingUsers = Object.keys(roomsData[room].users);
                    roomsData[room].owner = remainingUsers.length > 0 ? remainingUsers[0] : null;
                }
                setTimeout(() => updateRoomInfo(room), 100);
            }
        });
    });

    function updateRoomInfo(room) {
        if (roomsData[room]) {
            const userList = Object.keys(roomsData[room].users).map(id => ({
                name: roomsData[room].users[id],
                isOwner: id === roomsData[room].owner
            }));
            io.to(room).emit('roomUpdate', { count: userList.length, users: userList });
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[${getLogTime()}] 🚀 SİSTEM AKTİF: Sunucu ${PORT} portunda çalışıyor.`);
});
