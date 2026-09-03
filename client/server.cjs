const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Statik Dosyalar (Eğer dist veya client dışarı sunulacaksa)
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, "../client"))); 

app.get("/", (req, res) => {
    res.send("BOX WARS SUNUCUSU ÇALIŞIYOR 🔥 (Supabase Sync Mode)");
});

// --- ADMIN PANEL API ---
app.post("/api/admin-login", (req, res) => {
    const { email, password } = req.body;
    
    // Kendi belirleyeceğin admin bilgileri (İleride .env veya veritabanına bağlanabilir)
    const ADMIN_EMAIL = "admin@boxwars.com";
    const ADMIN_PASS = "admin123";

    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
        res.json({ success: true, message: "Giriş başarılı!" });
    } else {
        res.status(401).json({ success: false, message: "Geçersiz e-posta veya şifre!" });
    }
});

// Anlık bağlı oyuncu sayısını veren API
app.get("/api/admin-stats", (req, res) => {
    const activeConnections = io.engine.clientsCount; // Socket.io üzerinden bağlı toplam oyuncu sayısı
    res.json({
        activePlayers: activeConnections,
        serverStatus: "ONLINE",
        uptime: process.uptime()
    });
});

// --- SOCKET.IO OYUN İLETİŞİM RÖLESİ ---
io.on("connection", (socket) => {
    console.log("Bir oyuncu bağlandı:", socket.id);

    // Odaya Katılma
    socket.on("join_room", (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} -> ${roomId} odasına katıldı.`);
    });

    // Oyuncu Hareketi Senkronizasyonu
    socket.on("player_move", (data) => {
        socket.to(data.roomId).emit("player_move", data);
    });

    // Ateş Etme Olayı
    socket.on("player_shoot", (data) => {
        socket.to(data.roomId).emit("player_shoot", data);
    });

    // Vurulma / Hasar Olayı
    socket.on("player_hit", (data) => {
        socket.to(data.roomId).emit("player_hit", data);
    });

    // Round Kazanma
    socket.on("round_won", (data) => {
        socket.to(data.roomId).emit("round_won", data);
    });

    // Oyun Bitti Senkronizasyonu
    socket.on("game_over_sync", (data) => {
        socket.to(data.roomId).emit("game_over_sync", data);
    });

    // Oyundan Erken Ayrılma
    socket.on("player_quit", (data) => {
        const roomId = typeof data === 'string' ? data : data?.roomId;
        if (roomId) {
            socket.to(roomId).emit("player_quit");
        }
    });

    socket.on("disconnect", () => {
        console.log("Bir oyuncu ayrıldı:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Box Wars sunucusu ${PORT} portunda çalışıyor!`);
});