import React, { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ activePlayers: 0, serverStatus: 'CHECKING...', uptime: 0 });

  // Gerçek Backend API üzerinden Giriş Kontrolü
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (data.success) {
        setIsLoggedIn(true);
        setError('');
        fetchStats();
      } else {
        setError(data.message || 'Erişim Reddedildi!');
      }
    } catch (err) {
      setError('Sunucu bağlantı hatası!');
    }
  };

  // Sunucudan Canlı İstatistikleri Çekme
  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/admin-stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('İstatistikler alınamadı');
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(fetchStats, 3000); // Her 3 saniyede bir güncelle
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#030712', color: '#00f5d4',
        display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', padding: '20px'
      }}>
        <div style={{
          border: '2px solid #00f5d4', padding: '40px', borderRadius: '12px',
          boxShadow: '0 0 20px rgba(0, 245, 212, 0.3)', maxWidth: '400px', width: '100%', backgroundColor: '#0c101c'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', letterSpacing: '2px' }}>
            [ BOX WARS ADMIN ]
          </h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>GMAIL:</label>
              <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@boxwars.com"
                style={{ width: '100%', padding: '10px', backgroundColor: '#030712', border: '1px solid #00f5d4', color: '#00f5d4', borderRadius: '4px', outline: 'none' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>ŞİFRE:</label>
              <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                style={{ width: '100%', padding: '10px', backgroundColor: '#030712', border: '1px solid #00f5d4', color: '#00f5d4', borderRadius: '4px', outline: 'none' }}
                required
              />
            </div>
            {error && <p style={{ color: '#ff3366', fontSize: '12px', textAlign: 'center' }}>{error}</p>}
            <button 
              type="submit"
              style={{
                marginTop: '10px', padding: '12px', backgroundColor: '#00f5d4', color: '#030712',
                fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer',
                boxShadow: '0 0 10px rgba(0, 245, 212, 0.5)'
              }}
            >
              SİSTEME GİRİŞ YAP
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#030712', color: '#00f5d4', padding: '40px', fontFamily: 'monospace' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #00f5d4', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1>⚡ BOX WARS // KONTROL MERKEZİ</h1>
        <button 
          onClick={() => setIsLoggedIn(false)}
          style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #ff3366', color: '#ff3366', cursor: 'pointer', borderRadius: '4px' }}
        >
          ÇIKIŞ YAP
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div style={{ border: '1px solid #00f5d4', padding: '20px', borderRadius: '8px', backgroundColor: '#0c101c' }}>
          <h3>Aktif Bağlantı / Oyuncu</h3>
          <p style={{ fontSize: '24px', marginTop: '10px', fontWeight: 'bold' }}>{stats.activePlayers}</p>
        </div>
        <div style={{ border: '1px solid #00f5d4', padding: '20px', borderRadius: '8px', backgroundColor: '#0c101c' }}>
          <h3>Sunucu Durumu</h3>
          <p style={{ fontSize: '24px', marginTop: '10px', fontWeight: 'bold', color: '#00f5d4' }}>{stats.serverStatus} 🟢</p>
        </div>
        <div style={{ border: '1px solid #00f5d4', padding: '20px', borderRadius: '8px', backgroundColor: '#0c101c' }}>
          <h3>Çalışma Süresi (Uptime)</h3>
          <p style={{ fontSize: '24px', marginTop: '10px', fontWeight: 'bold' }}>{Math.floor(stats.uptime)} sn</p>
        </div>
      </div>
    </div>
  );
}