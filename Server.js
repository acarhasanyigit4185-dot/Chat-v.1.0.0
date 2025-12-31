// Gerekli araçlar (kütüphaneler)
const express = require('express'); 
const http = require('http'); 
const { Server } = require('socket.io'); 

const app = express(); // Web uygulamasını oluştur
const server = http.createServer(app); // HTTP sunucusunu kur
const io = new Server(server); // Soket bağlantısını sunucuya bağla

// 'public' isimli klasörü dış dünyaya aç (Kullanıcılar buradaki dosyaları görür)
app.use(express.static('public'));

// Bir tarayıcı bağlandığında bu olay (event) başlar
io.on('connection', (socket) => {
    
    // Kullanıcı bir odaya girmek istediğinde
    socket.on('joinRoom', (room) => {
        // Socket.io bu kullanıcıyı sadece bu 'oda ismi' altına gruplar
        socket.join(room);
        console.log(`BİLGİ: Bir cihaz şu odaya kilitlendi: ${room}`);
    });

    // Bir kullanıcı şifreli paket gönderdiğinde
    socket.on('sendMessage', (data) => {
        // data objesi şunları içerir: { room: 'oda_no', message: 'şifreli_yazı' }
        
        // SUNUCUNUN ROLÜ:
        // İçeriğe bakmaz, çözmeye çalışmaz. Sadece odayı kontrol eder
        // ve paketi o odadaki diğer cihazlara olduğu gibi (emit) iletir.
        io.to(data.room).emit('receiveMessage', data.message);
    });

    // Kullanıcı sekmeyi kapattığında
    socket.on('disconnect', () => {
        console.log('BİLGİ: Bir cihazın bağlantısı koptu.');
    });
});

// PORT AYARI: 
// Render gibi servisler kendi port numarasını buraya enjekte eder (process.env.PORT)
// Eğer kendi bilgisayarımızda çalıştırıyorsak 3000 portu geçerli olur.
const PORT = process.env.PORT || 3000;

// Sunucuyu başlat
server.listen(PORT, () => {
    console.log(`POSTACI: Sunucu şu an ${PORT} portunda çalışıyor.`);
});
