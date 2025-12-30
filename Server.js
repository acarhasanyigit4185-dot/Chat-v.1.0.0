const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 'public' klasöründeki dosyaları (HTML, CSS, JS) dışarı açar
app.use(express.static('public'));

io.on('connection', (socket) => {
    // Bir odaya katılma isteği
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`Bir kullanıcı şu odaya girdi: ${room}`);
    });

    // Şifreli mesajı ilgili odaya dağıtma
    socket.on('sendMessage', (data) => {
        // data: { room: '12345', message: 'U2FsdGVkX1...' }
        // Sunucu içeriği çözmez, sadece ilgili odaya paketi iletir.
        io.to(data.room).emit('receiveMessage', data.message);
    });

    socket.on('disconnect', () => {
        console.log('Bir kullanıcı ayrıldı.');
    });
});

// Render'ın verdiği portu kullan, yoksa 3000'i kullan
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda hazir!`);
});
