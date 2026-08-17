import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import GameCanvas from './GameCanvas'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [inGame, setInGame] = useState(false)

  // Oda ve Davet State'leri
  const [currentRoom, setCurrentRoom] = useState(null) 
  const [roomMembers, setRoomMembers] = useState([]) 
  const [onlinePlayers, setOnlinePlayers] = useState([]) 
  const [incomingInvites, setIncomingInvites] = useState([]) 
  const [currentInviteId, setCurrentInviteId] = useState(null) 

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [isRegistering, setIsRegistering] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // 1. Oturum ve Profil Takibi
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id, true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id, true)
      } else {
        setProfile(null)
        setCurrentRoom(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Tarayıcı kapatıldığında offline yap ve odadaysa temizle
  useEffect(() => {
    if (!session) return

    const handleBeforeUnload = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseKey) return

      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ is_online: false }),
        keepalive: true
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session])

  const fetchProfile = async (userId, setOnline = false) => {
    if (setOnline) {
      await supabase.from('profiles').update({ is_online: true }).eq('id', userId)
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  // 2. Online Oyuncuları ve Davetleri Dinleme (Sadece 'waiting' odasındakileri listele)
  useEffect(() => {
    if (!session) return

    const fetchOnlinePlayers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, level, is_online')
        .eq('is_online', true)
        .neq('id', session.user.id)

      if (data) setOnlinePlayers(data)
    }

    const fetchIncomingInvites = async () => {
      const { data } = await supabase
        .from('invites')
        .select('*')
        .eq('receiver_id', session.user.id)
        .eq('status', 'pending')

      if (data) setIncomingInvites(data)
    }

    fetchOnlinePlayers()
    fetchIncomingInvites()

    const interval = setInterval(() => {
      fetchOnlinePlayers()
      fetchIncomingInvites()
    }, 4000)

    const inviteChannel = supabase
      .channel('public:invites')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invites', filter: `receiver_id=eq.${session.user.id}` },
        (payload) => {
          setIncomingInvites((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invites', filter: `sender_id=eq.${session.user.id}` },
        (payload) => {
          const updatedInvite = payload.new
          if (updatedInvite.status === 'accepted') {
            alert('🎉 Rakip daveti kabul etti! Odaya giriliyor...')
            setCurrentRoom({ id: updatedInvite.room_id, status: 'waiting' })
            setCurrentInviteId(updatedInvite.id)
          } else if (updatedInvite.status === 'rejected') {
            alert('❌ Rakip daveti reddetti.')
          }
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(inviteChannel)
    }
  }, [session])

  // 3. Oda Durumu ve Üyeleri Dinleme (Oyun başladı mı veya oda kapandı mı kontrolü)
  useEffect(() => {
    if (!currentRoom) {
      setRoomMembers([])
      return
    }

    const fetchRoomDetails = async () => {
      const { data: roomData, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', currentRoom.id)
        .single()

      if (error || !roomData) {
        alert('⚠️ Oda kurucu tarafından kapatıldı!')
        handleBackToLobby()
        return
      }

      // Kurucu oyunu başlattıysa ('playing' olduysa) katılımcıları da oyuna fırlat!
      if (roomData.status === 'playing' && !inGame) {
        setInGame(true)
        return
      }

      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('id, username, level')
        .eq('id', roomData.host_id)
        .single()

      const { data: acceptedInvite } = await supabase
        .from('invites')
        .select('*')
        .eq('room_id', currentRoom.id)
        .eq('status', 'accepted')
        .single()

      let members = []
      if (hostProfile) {
        members.push({ ...hostProfile, role: 'host', isReady: true })
      }

      if (acceptedInvite) {
        if (acceptedInvite.receiver_id === session?.user?.id && !currentInviteId) {
          setCurrentInviteId(acceptedInvite.id)
        }

        const { data: guestProfile } = await supabase
          .from('profiles')
          .select('id, username, level')
          .eq('id', acceptedInvite.receiver_id)
          .single()
        
        if (guestProfile) {
          members.push({ 
            ...guestProfile, 
            role: 'guest', 
            isReady: acceptedInvite.is_ready ?? false 
          })
        }
      } else {
        if (currentRoom && session?.user?.id !== roomData.host_id) {
          handleBackToLobby()
          return
        }
      }

      setRoomMembers(members)
    }

    fetchRoomDetails()
    const roomInterval = setInterval(fetchRoomDetails, 2000)

    return () => clearInterval(roomInterval)
  }, [currentRoom, currentInviteId, session, inGame])

  // 4. Oda Oluşturma
  const handleCreateRoom = async () => {
    if (!session) return

    const { data, error } = await supabase
      .from('rooms')
      .insert([{ host_id: session.user.id, status: 'waiting' }])
      .select()
      .single()

    if (error) {
      alert('Oda oluşturulamadı: ' + error.message)
    } else {
      setCurrentRoom(data)
      setCurrentInviteId(null)
    }
  }

  // 5. Odadan Ayrılma / Odayı Kapatma
  const handleLeaveRoom = async () => {
    if (!currentRoom) return

    const isHost = session?.user?.id === currentRoom.host_id

    if (isHost) {
      await supabase.from('rooms').delete().eq('id', currentRoom.id)
      await supabase.from('invites').delete().eq('room_id', currentRoom.id)
    } else {
      if (currentInviteId) {
        await supabase.from('invites').delete().eq('id', currentInviteId)
      }
    }

    handleBackToLobby()
  }

  // 6. Davet Gönderme (Çifte davet spam engeli eklenmiş hali)
  const handleSendInvite = async (receiverId) => {
    if (!currentRoom) return

    if (roomMembers.length >= 2) {
      alert('Oda dolu! Daha fazla oyuncu davet edilemez.')
      return
    }

    // Bu oyuncuya zaten bekleyen bir davet atılmış mı kontrol et
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      alert('Bu oyuncuya zaten aktif bir davet gönderilmiş!')
      return
    }

    const { error } = await supabase.from('invites').insert([
      {
        sender_id: session.user.id,
        receiver_id: receiverId,
        room_id: currentRoom.id,
        status: 'pending',
        is_ready: false
      }
    ])

    if (error) {
      alert('Davet gönderilemedi: ' + error.message)
    } else {
      alert('Davet başarıyla gönderildi! Cevap bekleniyor...')
    }
  }

  // 7. Daveti Kabul Etme
  const handleAcceptInvite = async (invite) => {
    setCurrentRoom({ id: invite.room_id, status: 'waiting' })
    setCurrentInviteId(invite.id)

    await supabase
      .from('invites')
      .update({ status: 'accepted', is_ready: false })
      .eq('id', invite.id)

    setIncomingInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  // 8. Daveti Reddetme
  const handleRejectInvite = async (invite) => {
    await supabase
      .from('invites')
      .update({ status: 'rejected' })
      .eq('id', invite.id)

    setIncomingInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  // 9. Katılımcının Hazır Durumunu Değiştirmesi
  const toggleReadyStatus = async () => {
    if (!currentInviteId) return

    const guestMember = roomMembers.find(m => m.role === 'guest')
    const newReadyState = !guestMember?.isReady

    await supabase
      .from('invites')
      .update({ is_ready: newReadyState })
      .eq('id', currentInviteId)
  }

  // 10. Kurucunun Oyunu Başlatması (Oda durumunu 'playing' yapar, böylece herkes oyuna geçer)
  const handleStartGame = async () => {
    if (!currentRoom) return

    const { error } = await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', currentRoom.id)

    if (!error) {
      setInGame(true)
    } else {
      alert('Oyun başlatılamadı: ' + error.message)
    }
  }

  const handleBackToLobby = async () => {
    // Eğer oyundan çıkılıyorsa odayı ve davetleri tamamen temizle (Temiz lobi çıkışı)
    if (currentRoom) {
      const isHost = session?.user?.id === currentRoom.host_id
      if (isHost) {
        await supabase.from('rooms').delete().eq('id', currentRoom.id)
        await supabase.from('invites').delete().eq('room_id', currentRoom.id)
      }
    }

    setInGame(false)
    setCurrentRoom(null)
    setCurrentInviteId(null)
    setRoomMembers([])
    if (session) {
      fetchProfile(session.user.id)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) {
      setMessage(`❌ ${authError.message}`)
      setLoading(false)
      return
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: authData.user.id, username, xp: 0, level: 1, wins: 0, losses: 0, is_online: true }
      ])
      if (profileError) {
        setMessage(`❌ ${profileError.message}`)
      } else {
        setMessage('✅ Kayıt başarılı! Giriş yapabilirsin.')
        setIsRegistering(false)
        setUsername('')
        setPassword('')
      }
    }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(`❌ ${error.message}`)
    } else if (data.user) {
      await supabase.from('profiles').update({ is_online: true }).eq('id', data.user.id)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    if (currentRoom) {
      await handleLeaveRoom()
    }
    if (session) {
      await supabase.from('profiles').update({ is_online: false }).eq('id', session.user.id)
    }
    await supabase.auth.signOut()
    setProfile(null)
    setCurrentRoom(null)
  }

  const currentLevelXp = profile?.xp ? profile.xp % 200 : 0;
  const xpPercent = (currentLevelXp / 200) * 100;

  if (session) {
    if (inGame) {
      return (
        <GameCanvas 
          onBack={handleBackToLobby} 
          userId={session.user.id} 
          roomId={currentRoom?.id} 
          profile={profile}
          refreshProfile={() => fetchProfile(session.user.id)}
        />
      )
    }

    const isHost = currentRoom && session?.user?.id === currentRoom.host_id;
    const isRoomFull = roomMembers.length >= 2;
    const guestMember = roomMembers.find(m => m.role === 'guest');
    const isGuestReady = guestMember ? guestMember.isReady : false;
    const canStartGame = isRoomFull && isGuestReady;

    return (
      <div className="lobby-wrap">
        <header className="lobby-header">
          <span className="lobby-logo">⬛ BOX WARS</span>
          <div className="user-badge">
            <span className="user-name">⚡ {profile?.username || 'Oyuncu'}</span>
            <button className="logout-btn" onClick={handleLogout}>Çıkış</button>
          </div>
        </header>

        {/* EĞER BİR ODAYSA (BEKLEME ODASI) */}
        {currentRoom ? (
          <div className="lobby-grid">
            <section className="mods-panel">
              <h3 className="panel-title">🛡️ Bekleme Odası (1v1)</h3>
              <p style={{ color: '#00f5d4', marginBottom: '15px' }}>Oda ID: {currentRoom.id.slice(0, 8)}... ({roomMembers.length}/2 Kişi)</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {roomMembers.map((member) => (
                  <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 'bold' }}>{member.username}</span> (Lvl {member.level})
                      <div style={{ fontSize: '12px', color: member.role === 'host' ? '#00f5d4' : '#888' }}>
                        {member.role === 'host' ? '👑 Kurucu' : '👤 Katılımcı'}
                      </div>
                    </div>

                    <div>
                      {member.role === 'host' ? (
                        <span style={{ color: '#2ec4b6', fontWeight: 'bold', fontSize: '14px' }}>✅ Kurucu (Hazır)</span>
                      ) : (
                        <span style={{ color: member.isReady ? '#2ec4b6' : '#e71d36', fontWeight: 'bold', fontSize: '14px' }}>
                          {member.isReady ? '✅ Hazır' : '❌ Hazır Değil'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* BUTONLAR */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {!isHost && (
                  <button 
                    className="auth-button" 
                    onClick={toggleReadyStatus}
                    style={{ background: isGuestReady ? '#2ec4b6' : '#e71d36', flex: 1 }}
                  >
                    {isGuestReady ? '✅ HAZIRSIN (İptal Et)' : '❌ HAZIR OL'}
                  </button>
                )}

                <button 
                  className="logout-btn" 
                  onClick={handleLeaveRoom}
                  style={{ flex: 1, padding: '12px', background: isHost ? '#e71d36' : undefined }}
                >
                  {isHost ? 'Odayı Dağıt / Ayrıl' : 'Odadan Ayrıl'}
                </button>
              </div>

              {/* KURUCU İÇİN OYUNU BAŞLAT TUŞU */}
              {isHost && (
                <button 
                  className="auth-button" 
                  onClick={handleStartGame}
                  disabled={!canStartGame}
                  style={{ background: canStartGame ? '#7209b7' : '#555', marginTop: '10px', cursor: canStartGame ? 'pointer' : 'not-allowed' }}
                >
                  {!isRoomFull ? '⏳ Rakibin Gelmesi Bekleniyor...' : (!isGuestReady ? '⏳ Rakibin Hazır Olması Bekleniyor...' : '🚀 OYUNU BAŞLAT')}
                </button>
              )}
            </section>

            <section className="stats-panel">
              <h3 className="panel-title">👥 Çevrimiçi Oyuncular {isRoomFull && '(Oda Dolu)'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {onlinePlayers.length === 0 ? (
                  <p style={{ color: '#888' }}>Şu an çevrimiçi başka oyuncu yok.</p>
                ) : (
                  onlinePlayers.map((player) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', alignItems: 'center' }}>
                      <span>{player.username} (Lvl {player.level}) <span style={{ color: '#2ec4b6', fontSize: '12px' }}>🟢 Online</span></span>
                      
                      {isRoomFull ? (
                        <span style={{ fontSize: '12px', color: '#e71d36' }}>Oda Dolu</span>
                      ) : (
                        <button 
                          onClick={() => handleSendInvite(player.id)}
                          style={{ padding: '5px 10px', background: '#00f5d4', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Davet Et
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          /* NORMAL LOBİ EKRANI (ODA DIŞI) */
          <div className="lobby-grid">
            <section className="mods-panel">
              <h3 className="panel-title">⚔️ Savaş Modu</h3>

              <div className="mod-card" onClick={handleCreateRoom}>
                <div className="mod-left">
                  <span className="mod-name">1 VS 1 OYNA</span>
                  <span className="mod-desc">Oda kur ve rakip davet et</span>
                </div>
                <span className="mod-badge">KUR</span>
              </div>
            </section>

            <section className="stats-panel">
              <h3 className="panel-title">👥 Çevrimiçi Oyuncular & Gelen Davetler</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {onlinePlayers.length === 0 ? (
                  <p style={{ color: '#888' }}>Şu an çevrimiçi başka oyuncu yok.</p>
                ) : (
                  onlinePlayers.map((player) => {
                    const inviteFromThisPlayer = incomingInvites.find((inv) => inv.sender_id === player.id)

                    return (
                      <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', alignItems: 'center' }}>
                        <span>{player.username} (Lvl {player.level}) <span style={{ color: '#2ec4b6', fontSize: '12px' }}>🟢 Online</span></span>
                        
                        {inviteFromThisPlayer ? (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button 
                              onClick={() => handleAcceptInvite(inviteFromThisPlayer)}
                              style={{ padding: '5px 8px', background: '#2ec4b6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                              Kabul Et ✅
                            </button>
                            <button 
                              onClick={() => handleRejectInvite(inviteFromThisPlayer)}
                              style={{ padding: '5px 8px', background: '#e71d36', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                              Reddet ❌
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#888' }}>Oda bekleniyor...</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <h3 className="panel-title">📊 İstatistikler</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-label">Level</div>
                  <div className="stat-value accent">{profile?.level ?? 1}</div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">XP</div>
                  <div className="stat-value">{profile?.xp ?? 0}</div>
                  <div className="xp-bar-wrap">
                    <div className="xp-bar-fill" style={{ width: `${xpPercent}%` }} />
                  </div>
                  <div className="xp-label">
                    <span>{xpPercent.toFixed(0)}%</span>
                    <span>{currentLevelXp} / 200 XP</span>
                  </div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">Galibiyet</div>
                  <div className="stat-value wins">{profile?.wins ?? 0}</div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">Mağlubiyet</div>
                  <div className="stat-value losses">{profile?.losses ?? 0}</div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-panel">
        <div className="auth-title">BOX WARS</div>
        <div className="auth-sub">{isRegistering ? 'KAYIT OL' : 'GİRİŞ YAP'}</div>

        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          {isRegistering && (
            <input
              className="auth-input"
              type="text"
              placeholder="Kullanıcı Adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            className="auth-input"
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Yükleniyor...' : (isRegistering ? 'KAYIT OL' : 'GİRİŞ YAP')}
          </button>
        </form>

        {message && <div className="auth-message">{message}</div>}

        <button
          className="toggle-button"
          onClick={() => { setIsRegistering(!isRegistering); setMessage(''); }}
        >
          {isRegistering ? 'Zaten hesabın var mı? Giriş Yap' : 'Hesabın yok mu? Kayıt Ol'}
        </button>
      </div>
    </div>
  )
}

export default App