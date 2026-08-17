const express = require('express');
const User = require('../models/User');

const router = express.Router();

// 1. OYUNCU PROFİLİNİ GETİR
router.get('/profile/:username', async (req, res) => {
  try {
    let user = await User.findOne({ username: req.params.username });
    
    // Kullanıcı ilk defa giriyorsa otomatik oluştur
    if (!user) {
      user = await User.create({ username: req.params.username });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Profil çekilemedi' });
  }
});

// 2. MAÇ SONUCUNU VE XP'Yİ VERİTABANINA KAYDET
router.post('/end-match', async (req, res) => {
  const { username, isWin } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

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

module.exports = router;