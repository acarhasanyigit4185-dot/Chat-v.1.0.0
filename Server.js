const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Odaların verisini ve oda sahiplerini RAM'de tutan obje
const roomsData = {};

// Zaman damgası (Timestamp) oluşturma fonksiyonu [31.12.2025 14:30:05]
const getLogTime = () => {
    return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

io.on('connection', (socket) => {
    
    // KULLANICI GİRİŞ İSTEĞİ ATTIĞINDA
    socket.on('requestJoin', (data) => {
        const { room, username } = data;
        
        // Soket üzerine kullanıcı adını ve odayı kaydediyoruz (Çıkışta loglamak için)
        socket.username = username;
        socket.requestedRoom = room;

        // EĞER ODA BOŞSA (İLK GİREN SAHİPTİR)
        if (!roomsData[room] || Array.from(io.sockets.adapter.rooms.get(room) || []).length === 0) {
            roomsData[room] = { owner: socket.id, users: {} };
            socket.join(room);
            roomsData[room].users[socket.id] = username;
            
            // LOG: ODA KURULUMU
            console.log(`[${getLogTime()}] 🟢 ODA KURULDU: ${username} (Sahip) -> Oda: ${room}`);
            
            socket.emit('joinApproved', { room, isOwner: true });
            updateRoomInfo(room);
        } else {
            // EĞER ODA VARSA (SAHİBE SORULUR)
            const ownerId = roomsData[room].owner;
            
            // LOG: GİRİŞ İSTEĞİ
            console.log(`[${getLogTime()}] 🛡️ GİRİŞ İSTEĞİ: ${username} -> Oda: ${room} (Onay Bekliyor...)`);
            
            io.to(ownerId).emit('askOwnerPermission', { 
                requestingUser: username, 
                socketId: socket.id 
            });
            socket.emit('waitingApproval');
        }
    });

    // SAHİBİN VERDİĞİ CEVAP
    socket.on('ownerResponse', (data) => {
        const { room, socketId, username, approved } = data;
        
        if (approved) {
            const guestSocket = io.sockets.sockets.get(socketId);
            if (guestSocket) {
                guestSocket.join(room);
                roomsData[room].users[socketId] = username;
                
                // LOG: ONAYLANAN GİRİŞ
                console.log(`[${getLogTime()}] ✅ GİRİŞ ONAYLANDI: ${username} -> Oda: ${room}`);
                
                guestSocket.emit('joinApproved', { room, isOwner: false });
                updateRoomInfo(room);
            }
        } else {
            // LOG: REDDEDİLEN GİRİŞ
            console.log(`[${getLogTime()}] ❌ GİRİŞ REDDEDİLDİ: ${username} -> Oda: ${room}`);
            io.to(socketId).emit('joinRejected');
        }
    });

    socket.on('sendMessage', (data) => {
        io.to(data.room).emit('receiveMessage', data.message);
    });

    // AYRILMA (KOPMA) DURUMU
    socket.on('disconnecting', () => {
        const username = socket.username || "Bilinmeyen Kullanıcı";
        
        socket.rooms.forEach(room => {
            if (roomsData[room] && roomsData[room].users[socket.id]) {
                // LOG: ÇIKIŞ KAYDI
                console.log(`[${getLogTime()}] 🔴 AYRILDI: ${username} -> Oda: ${room}`);
                
                delete roomsData[room].users[socket.id];
                
                // Sahibi çıktıysa odayı devretme mantığı
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
            const userList = Object.values(roomsData[room].users);
            io.to(room).emit('roomUpdate', {
                count: userList.length,
                users: userList
            });
        }
    }

    socket.on('disconnect', () => {
        // Genel bağlantı kopması logu (isteğe bağlı kapatılabilir)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[${getLogTime()}] 🚀 SİSTEM AKTİF: Sunucu ${PORT} portunda çalışıyor.`);
});
