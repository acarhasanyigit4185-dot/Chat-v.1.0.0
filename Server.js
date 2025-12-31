// Gerekli modülleri (kütüphaneleri) içe aktarıyoruz
const express = require('express'); // Web sunucusu kütüphanesi
const http = require('http'); // HTTP protokolü kütüphanesi
const { Server } = require('socket.io'); // Socket.io (Anlık iletişim) kütüphanesi

const app = express(); // Express uygulamasını başlat
const server = http.createServer(app); // Express'i standart bir HTTP sunucusuna bağla
const io = new Server(server); // Socket.io'yu sunucuya entegre et

// 'public' klasörü içindeki tüm dosyaları (html, css, js) internete aç
// Kullanıcı siteye girdiğinde otomatik olarak public/index.html dosyası yüklenir.
app.use(express.static('public'));

// Bir kullanıcı sunucuya bağlandığında (Siteyi açtığında)
io.on('connection', (socket) => {
    
    // Kullanıcı bir odaya katılmak istediğinde ('joinRoom' mesajı attığında)
    socket.on('joinRoom', (room) => {
        // Socket.io'nun dahili 'join' özelliğini kullanarak kullanıcıyı o odaya hapseder
        socket.join(room);
        console.log(`BİLGİ: Bir kullanıcı şu odaya girdi: ${room}`);
    });

    // Bir kullanıcı mesaj gönderdiğinde ('sendMessage' mesajı attığında)
    socket.on('sendMessage', (data) => {
        // data: { room: '12345', message: 'U2FsdGVkX1...' }
        
        // SUNUCUNUN GÖREVİ:
        // İçeriği asla açmaz veya çözmez. Sadece 'data.room' içindeki herkese
        // şifreli mesajı olduğu gibi ('receiveMessage' olarak) iletir.
        io.to(data.room).emit('receiveMessage', data.message);
    });

    // Kullanıcı sekmeyi kapattığında
    socket.on('disconnect', () => {
        console.log('BİLGİ: Bir kullanıcı sistemden ayrıldı.');
    });
});

// PORT AYARI:
// Render gibi servisler kendi portunu (process.env.PORT) atar. 
// Eğer yerel bilgisayardaysak 3000 portunu kullanırız.
const PORT = process.env.PORT || 3000;

// Sunucuyu belirtilen portta dinlemeye başla
server.listen(PORT, () => {
    console.log(`SİSTEM: Sunucu ${PORT} portunda başarıyla başlatıldı!`);
});
