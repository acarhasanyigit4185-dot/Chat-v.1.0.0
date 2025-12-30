const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // public klasöründeki dosyaları dışarı açar

io.on('connection', (socket) => {
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`Bir kullanıcı şu odaya girdi: ${room}`);
    });

    socket.on('sendMessage', (data) => {
        // Gelen şifreli mesajı o odadaki herkese (gönderen dahil) geri gönderir
        io.to(data.room).emit('receiveMessage', data.message);
    });
});

server.listen(3000, () => {
    console.log('Sunucu çalışıyor: http://localhost:3000');
});