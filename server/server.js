const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Bağlantısı
mongoose.connect("mongodb://backomer04_db_user:lO8onjPE3MRZrSuv@ac-oqgbfqp-shard-00-00.cdq5jn8.mongodb.net:27017,ac-oqgbfqp-shard-00-01.cdq5jn8.mongodb.net:27017,ac-oqgbfqp-shard-00-02.cdq5jn8.mongodb.net:27017/boxwars?ssl=true&replicaSet=atlas-10bnl8-shard-0&authSource=admin&appName=BoxWarsCluster")
  .then(() => console.log("Bulut MongoDB Veritabanına Bağlandı ☁️🚀"))
  .catch((err) => console.log("Bağlantı Hatası:", err));

// Oyuncu Verisi için Şema (XP, Level, Wins, Losses tam uyumlu)
const playerSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 }
});

const Player = mongoose.model('Player', playerSchema);

// 1. OYUNCU PROFİLİNİ GETİR VEYA OLUŞTUR
app.get('/api/profile/:username', async (req, res) => {
  try {
    let user = await Player.findOne({ username: req.params.username });
    
    if (!user) {
      user = await Player.create({ username: req.params.username });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Profil çekilemedi' });
  }
});

// 2. MAÇ SONUCUNU VE XP'Yİ KAYDET / GÜNCELLE
app.post('/api/end-match', async (req, res) => {
  const { username, isWin } = req.body;

  try {
    let user = await Player.findOne({ username });
    if (!user) {
      user = await Player.create({ username });
    }

    const addedXp = isWin ? 100 : 25;
    user.xp += addedXp;
    
    if (isWin) {
      user.wins += 1;
    } else {
      user.losses += 1;
    }

    // Level Atlama Kontrolü (200 XP = 1 Level)
    if (user.xp >= 200) {
      user.level += 1;
      user.xp -= 200;
    }

    await user.save();

    res.json({
      success: true,
      updatedUser: user,
      addedXp
    });
  } catch (err) {
    res.status(500).json({ error: 'Maç sonucu kaydedilemedi' });
  }
});

app.get("/", (req, res) => {
    res.send("BOX WARS SUNUCUSU ÇALIŞIYOR 🔥");
});

// Socket.io
io.on("connection", (socket) => {
    console.log("Bir oyuncu bağlandı:", socket.id);

    socket.on("disconnect", () => {
        console.log("Bir oyuncu ayrıldı:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Box Wars sunucusu 3000 portunda çalışıyor!");
});