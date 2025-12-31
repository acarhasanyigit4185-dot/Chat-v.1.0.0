const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Odaların verisini ve oda sahiplerini tutar
const roomsData = {};
// IP bazlı deneme zamanlarını tutar (Flood koruması)
const lastAttempts = {};

const getLogTime = () => {
    return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

io.on('connection', (socket) => {
    
    // Gerçek IP adresini al (Render ve Proxy desteğiyle)
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

    socket.on('requestJoin', (data) => {
        const { room, username, type } = data;
        const now = Date.now();

        // --- 5 SANİYE KURALI (IP BAZLI) ---
        if (lastAttempts[clientIp] && (now - lastAttempts[clientIp] < 5000)) {
            const kalan = Math.ceil((5000 - (now - lastAttempts[clientIp])) / 1000);
            return socket.emit('error_msg', `Güvenlik: Lütfen ${kalan} saniye bekleyin.`);
        }
        
        // İşlem zamanını güncelle
        lastAttempts[clientIp] = now;
        socket.username = username;

        const roomExists = roomsData[room] && Array.from(io.sockets.adapter.rooms.get(room) || []).length > 0;

        // ODA KURMA
        if (type === 'kur') {
            if (roomExists) {
                console.log(`[${getLogTime()}] [IP: ${clientIp}] ⚠️ KURMA HATASI: ${username} -> Oda ${room} dolu.`);
                return socket.emit('error_msg', "Hata: Bu oda kodu zaten kullanımda!");
            }
            roomsData[room] = { owner: socket.id, users: {} };
            socket.join(room);
            roomsData[room].users[socket.id] = username;
            
            console.log(`[${getLogTime()}] [IP: ${clientIp}] 🟢 ODA KURULDU: ${username} (Sahip) -> Oda: ${room}`);
            socket.emit('joinApproved', { room, isOwner: true });
            updateRoomInfo(room);
        } 
        // ODAYA GİRME
        else if (type === 'gir') {
            if (!roomExists) {
                console.log(`[${getLogTime()}] [IP: ${clientIp}] ⚠️ GİRİŞ HATASI: ${username} -> Oda ${room} bulunamadı.`);
                return socket.emit('error_msg', "Hata: Oda bulunamadı!");
            }
            const ownerId = roomsData[room].owner;
            console.log(`[${getLogTime()}] [IP: ${clientIp}] 🛡️ GİRİŞ İSTEĞİ: ${username} -> Oda: ${room}`);
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
                console.log(`[${getLogTime()}] ✅ ONAYLANDI: ${username} odaya girdi.`);
                guestSocket.emit('joinApproved', { room, isOwner: false });
                updateRoomInfo(room);
            }
        } else {
            console.log(`[${getLogTime()}] ❌ REDDEDİLDİ: ${username} isteği geri çevrildi.`);
            io.to(socketId).emit('joinRejected');
        }
    });

    socket.on('sendMessage', (data) => {
        io.to(data.room).emit('receiveMessage', data);
    });

    socket.on('disconnecting', () => {
        const username = socket.username || "Anonim";
        socket.rooms.forEach(room => {
            if (roomsData[room] && roomsData[room].users[socket.id]) {
                console.log(`[${getLogTime()}] [IP: ${clientIp}] 🔴 AYRILDI: ${username} -> Oda: ${room}`);
                delete roomsData[room].users[socket.id];
                if (roomsData[room].owner === socket.id) {
                    const remaining = Object.keys(roomsData[room].users);
                    roomsData[room].owner = remaining.length > 0 ? remaining[0] : null;
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
server.listen(PORT, () => console.log(`[${getLogTime()}] 🚀 SİSTEM HAZIR | Port: ${PORT}`));
