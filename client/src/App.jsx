import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import GameCanvas from './GameCanvas'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [inGame, setInGame] = useState(false)

  // Sekme Yönetimi ('home' | 'shop' | 'about')
  const [activeTab, setActiveTab] = useState('home')

  // Oda ve Davet State'leri
  const [currentRoom, setCurrentRoom] = useState(null) 
  const [roomMembers, setRoomMembers] = useState([]) 
  const [onlinePlayers, setOnlinePlayers] = useState([]) 
  const [incomingInvites, setIncomingInvites] = useState([]) 
  const [currentInviteId, setCurrentInviteId] = useState(null) 

  // Liderlik Tablosu State'i
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardPlayers, setLeaderboardPlayers] = useState([])

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [isRegistering, setIsRegistering] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // 1. Oturum Takibi
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

    return () => subscription.unsubscribe()
  }, [])

  // Tarayıcı kapatıldığında offline yap
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

  // Liderlik Tablosu Verilerini Çekme
  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, level, xp, wins, losses, is_online')
      .order('level', { ascending: false })
      .order('xp', { ascending: false })

    if (data) setLeaderboardPlayers(data)
  }

  // 2. Online Oyuncular, Davetler ve Liderlik Verilerini Dinleme
  useEffect(() => {
    if (!session) return

    const fetchData = async () => {
      const { data: onlineData } = await supabase
        .from('profiles')
        .select('id, username, level, is_online')
        .eq('is_online', true)
        .neq('id', session.user.id)
      if (onlineData) setOnlinePlayers(onlineData)

      const { data: inviteData } = await supabase
        .from('invites')
        .select('*')
        .eq('receiver_id', session.user.id)
        .eq('status', 'pending')
      if (inviteData) setIncomingInvites(inviteData)
    }

    fetchData()
    fetchLeaderboard()

    const interval = setInterval(() => {
      fetchData()
      if (showLeaderboard) fetchLeaderboard()
    }, 4000)

    const inviteChannel = supabase
      .channel('public:invites')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invites', filter: `receiver_id=eq.${session.user.id}` },
        (payload) => setIncomingInvites((prev) => [...prev, payload.new])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invites', filter: `sender_id=eq.${session.user.id}` },
        (payload) => {
          const updated = payload.new
          if (updated.status === 'accepted') {
            alert('🎉 Rakip daveti kabul etti! Odaya giriliyor...')
            setCurrentRoom({ id: updated.room_id, status: 'waiting' })
            setCurrentInviteId(updated.id)
            setActiveTab('home')
          } else if (updated.status === 'rejected') {
            alert('❌ Rakip daveti reddetti.')
          }
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(inviteChannel)
    }
  }, [session, showLeaderboard])

  // 3. Oda Durumu Takibi
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
        alert('⚠️ Oda kapatıldı!')
        handleBackToLobby()
        return
      }

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
      if (hostProfile) members.push({ ...hostProfile, role: 'host', isReady: true })

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
          members.push({ ...guestProfile, role: 'guest', isReady: acceptedInvite.is_ready ?? false })
        }
      } else if (session?.user?.id !== roomData.host_id) {
        handleBackToLobby()
        return
      }

      setRoomMembers(members)
    }

    fetchRoomDetails()
    const roomInterval = setInterval(fetchRoomDetails, 2000)
    return () => clearInterval(roomInterval)
  }, [currentRoom, currentInviteId, session, inGame])

  const handleCreateRoom = async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ host_id: session.user.id, status: 'waiting' }])
      .select()
      .single()

    if (error) alert('Oda oluşturulamadı: ' + error.message)
    else {
      setCurrentRoom(data)
      setCurrentInviteId(null)
    }
  }

  const handleLeaveRoom = async () => {
    if (!currentRoom) return
    if (session?.user?.id === currentRoom.host_id) {
      await supabase.from('rooms').delete().eq('id', currentRoom.id)
      await supabase.from('invites').delete().eq('room_id', currentRoom.id)
    } else if (currentInviteId) {
      await supabase.from('invites').delete().eq('id', currentInviteId)
    }
    handleBackToLobby()
  }

  const handleSendInvite = async (receiverId) => {
    if (!currentRoom || roomMembers.length >= 2) return

    const { data: existing } = await supabase
      .from('invites')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending')
      .single()

    if (existing) {
      alert('Bu oyuncuya zaten aktif bir davet gönderilmiş!')
      return
    }

    const { error } = await supabase.from('invites').insert([{
      sender_id: session.user.id,
      receiver_id: receiverId,
      room_id: currentRoom.id,
      status: 'pending',
      is_ready: false
    }])

    if (error) alert('Davet gönderilemedi: ' + error.message)
    else alert('Davet gönderildi!')
  }

  const handleAcceptInvite = async (invite) => {
    setCurrentRoom({ id: invite.room_id, status: 'waiting' })
    setCurrentInviteId(invite.id)
    await supabase.from('invites').update({ status: 'accepted', is_ready: false }).eq('id', invite.id)
    setIncomingInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  const handleRejectInvite = async (invite) => {
    await supabase.from('invites').update({ status: 'rejected' }).eq('id', invite.id)
    setIncomingInvites((prev) => prev.filter((i) => i.id !== invite.id))
  }

  const toggleReadyStatus = async () => {
    if (!currentInviteId) return
    const guest = roomMembers.find(m => m.role === 'guest')
    await supabase.from('invites').update({ is_ready: !guest?.isReady }).eq('id', currentInviteId)
  }

  const handleStartGame = async () => {
    if (!currentRoom) return
    const { error } = await supabase.from('rooms').update({ status: 'playing' }).eq('id', currentRoom.id)
    if (!error) setInGame(true)
    else alert('Oyun başlatılamadı: ' + error.message)
  }

  const handleBackToLobby = async () => {
    if (currentRoom && session?.user?.id === currentRoom.host_id) {
      await supabase.from('rooms').delete().eq('id', currentRoom.id)
      await supabase.from('invites').delete().eq('room_id', currentRoom.id)
    }
    setInGame(false)
    setCurrentRoom(null)
    setCurrentInviteId(null)
    setRoomMembers([])
    if (session) fetchProfile(session.user.id)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(`❌ ${error.message}`)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileErr } = await supabase.from('profiles').insert([
        { id: data.user.id, username, xp: 0, level: 1, wins: 0, losses: 0, voxel: 100, is_online: true }
      ])
      if (profileErr) setMessage(`❌ ${profileErr.message}`)
      else {
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
    if (error) setMessage(`❌ ${error.message}`)
    else if (data.user) await supabase.from('profiles').update({ is_online: true }).eq('id', data.user.id)
    setLoading(false)
  }

  const handleLogout = async () => {
    if (currentRoom) await handleLeaveRoom()
    if (session) await supabase.from('profiles').update({ is_online: false }).eq('id', session.user.id)
    await supabase.auth.signOut()
    setProfile(null)
    setCurrentRoom(null)
  }

  const currentLevelXp = profile?.xp ? profile.xp % 200 : 0
  const xpPercent = (currentLevelXp / 200) * 100

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

    const isHost = currentRoom && session?.user?.id === currentRoom.host_id
    const isRoomFull = roomMembers.length >= 2
    const guestMember = roomMembers.find(m => m.role === 'guest')
    const isGuestReady = guestMember ? guestMember.isReady : false
    const canStartGame = isRoomFull && isGuestReady

    return (
      <div className="lobby-wrap">
        {/* EFSANE CAM EFEKTLİ HEADER */}
        <header className="lobby-header">
          <span className="lobby-logo">
            <span className="logo-icon">⬛</span> BOX WARS
          </span>

          <div className="user-badge-container">
            <div className="voxel-badge">
              <span>🔷 {profile?.voxel ?? 0} VXL</span>
            </div>
            <span className="user-name-text">⚡ {profile?.username || 'Oyuncu'}</span>
            <button className="logout-btn" onClick={handleLogout}>Çıkış</button>
          </div>
        </header>

        {/* DAMLA KAVİSLE SARKAN ÇENTİK (NOTCH) SEKME ALANI */}
        <div className="notch-container">
          <div className="notch-tabs">
            <button 
              onClick={() => setActiveTab('home')} 
              className={`notch-tab-btn ${activeTab === 'home' ? 'active' : ''}`}>
              🏠 Anasayfa
            </button>
            <button 
              onClick={() => setActiveTab('shop')} 
              className={`notch-tab-btn ${activeTab === 'shop' ? 'active' : ''}`}>
              🛍️ Shop (Voxel)
            </button>
            <button 
              onClick={() => setActiveTab('about')} 
              className={`notch-tab-btn ${activeTab === 'about' ? 'active' : ''}`}>
              📖 Hakkında
            </button>
          </div>
        </div>

        {/* LİDERLİK TABLOSU MODALI */}
        {showLeaderboard && (
          <div className="leaderboard-modal-bg">
            <div className="leaderboard-box">
              <div className="leaderboard-header">
                <h3>🏆 Global Liderlik Tablosu</h3>
                <button onClick={() => setShowLeaderboard(false)} className="modal-close-btn">✕</button>
              </div>

              <div className="leaderboard-list">
                {leaderboardPlayers.map((player, index) => {
                  const isMe = player.id === session.user.id
                  const rankClass = index === 0 ? 'rank-1' : (index === 1 ? 'rank-2' : (index === 2 ? 'rank-3' : 'rank-standard'))

                  return (
                    <div key={player.id} className={`leaderboard-item ${rankClass} ${isMe ? 'my-rank' : ''}`}>
                      <div className="leaderboard-item-left">
                        <span className={`rank-number ${index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : ''}`}>
                          #{index + 1}
                        </span>
                        <div>
                          <span className="leaderboard-username">
                            {player.username} {isMe && '(Sen)'}
                          </span>
                          <div className={`status-indicator ${player.is_online ? 'online' : 'offline'}`}>
                            {player.is_online ? '🟢 Çevrimiçi' : '⚪ Çevrimdışı'}
                          </div>
                        </div>
                      </div>

                      <div className="leaderboard-item-right">
                        <div>
                          <div className="stat-sublabel">Seviye / XP</div>
                          <div className="stat-main-val">Lvl {player.level} <span>({player.xp})</span></div>
                        </div>
                        <div>
                          <div className="stat-sublabel">Galibiyet</div>
                          <div className="stat-win-val">{player.wins} W</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* İÇERİK ALANI (SEKMELERE GÖRE) */}
        {activeTab === 'shop' ? (
          <div className="tab-content-container">
            <h2>🛍️ Voxel Mağazası</h2>
            <p className="tab-subtext">Mağazaya hoş geldin kanki! Biriken Voxel'lerinle karakterini ve özelleştirmelerini yakında burada harcayabileceksin.</p>
            <div className="tab-card-placeholder">
              <span className="placeholder-emoji">🚧</span>
              <h3>Mağaza Tezgahı Hazırlanıyor...</h3>
              <p>İlk ürünleri eklemek için sabırsızlanıyorum!</p>
            </div>
          </div>
        ) : activeTab === 'about' ? (
          <div className="tab-content-container about-align">
            <h2>📖 Box Wars Hakkında</h2>
            <div className="about-box">
              <p><strong>Box Wars</strong>, küplerin ve taktiksel kapışmaların merkezde olduğu gerçek zamanlı bir 1v1 web oyunudur.</p>
              <p className="about-mt">Arkadaşlarınla oda kurabilir, çevrimiçi oyunculara meydan okuyabilir, seviye atlayarak <strong>Voxel ($VXL$)</strong> toplayabilir ve liderlik tablosunda adını zirveye yazdırabilirsin!</p>
              <p className="about-mt accent-text">Geliştirici Notu: Keyifli oyunlar kanki! 🚀</p>
            </div>
          </div>
        ) : (
          /* ANASAYFA / LOBİ EKRANI */
          currentRoom ? (
            <div className="lobby-grid">
              <section className="mods-panel">
                <h3 className="panel-title">🛡️ Bekleme Odası (1v1)</h3>
                <p className="room-id-text">Oda ID: {currentRoom.id.slice(0, 8)}... ({roomMembers.length}/2 Kişi)</p>
                
                <div className="room-members-list">
                  {roomMembers.map((member) => (
                    <div key={member.id} className="room-member-card">
                      <div>
                        <span className="member-name">{member.username}</span> (Lvl {member.level})
                        <div className={`member-role ${member.role === 'host' ? 'host-color' : 'guest-color'}`}>
                          {member.role === 'host' ? '👑 Kurucu' : '👤 Katılımcı'}
                        </div>
                      </div>
                      <div>
                        {member.role === 'host' ? (
                          <span className="ready-badge-green">✅ Kurucu (Hazır)</span>
                        ) : (
                          <span className={member.isReady ? 'ready-badge-green' : 'ready-badge-red'}>
                            {member.isReady ? '✅ Hazır' : '❌ Hazır Değil'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="room-actions-row">
                  {!isHost && (
                    <button className="auth-button room-ready-btn" onClick={toggleReadyStatus} style={{ background: isGuestReady ? '#2ec4b6' : '#e71d36' }}>
                      {isGuestReady ? '✅ HAZIRSIN (İptal Et)' : '❌ HAZIR OL'}
                    </button>
                  )}
                  <button className="logout-btn room-leave-btn" onClick={handleLeaveRoom}>
                    {isHost ? 'Odayı Dağıt / Ayrıl' : 'Odadan Ayrıl'}
                  </button>
                </div>

                {isHost && (
                  <button className="auth-button" onClick={handleStartGame} disabled={!canStartGame} style={{ background: canStartGame ? '#7209b7' : '#555', cursor: canStartGame ? 'pointer' : 'not-allowed' }}>
                    {!isRoomFull ? '⏳ Rakibin Bekleniyor...' : (!isGuestReady ? '⏳ Rakibin Hazır Olması Bekleniyor...' : '🚀 OYUNU BAŞLAT')}
                  </button>
                )}
              </section>

              <section className="stats-panel">
                <h3 className="panel-title">👥 Çevrimiçi Oyuncular</h3>
                <div className="online-players-list">
                  {onlinePlayers.length === 0 ? (
                    <p className="no-player-text">Şu an çevrimiçi başka oyuncu yok.</p>
                  ) : (
                    onlinePlayers.map((player) => (
                      <div key={player.id} className="player-row-card">
                        <span>{player.username} (Lvl {player.level}) <span className="online-tag">🟢 Online</span></span>
                        {isRoomFull ? (
                          <span className="room-full-text">Oda Dolu</span>
                        ) : (
                          <button onClick={() => handleSendInvite(player.id)} className="invite-action-btn">Davet Et</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
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

                <div className="mod-card leaderboard-card-trigger" onClick={() => { fetchLeaderboard(); setShowLeaderboard(true); }}>
                  <div className="mod-left">
                    <span className="mod-name leaderboard-title-glow">🏆 LİDERLİK TABLOSU</span>
                    <span className="mod-desc">Seviye ve galibiyet sıralaması</span>
                  </div>
                  <span className="mod-badge leaderboard-badge-btn">İNCELE</span>
                </div>
              </section>

              <section className="stats-panel">
                <h3 className="panel-title">👥 Çevrimiçi Oyuncular & Gelen Davetler</h3>
                <div className="online-players-list mb-space">
                  {onlinePlayers.length === 0 ? (
                    <p className="no-player-text">Şu an çevrimiçi başka oyuncu yok.</p>
                  ) : (
                    onlinePlayers.map((player) => {
                      const invite = incomingInvites.find((inv) => inv.sender_id === player.id)
                      return (
                        <div key={player.id} className="player-row-card">
                          <span>{player.username} (Lvl {player.level}) <span className="online-tag">🟢 Online</span></span>
                          {invite ? (
                            <div className="invite-buttons-group">
                              <button onClick={() => handleAcceptInvite(invite)} className="accept-btn">Kabul Et ✅</button>
                              <button onClick={() => handleRejectInvite(invite)} className="reject-btn">Reddet ❌</button>
                            </div>
                          ) : (
                            <span className="waiting-text">Bekleniyor...</span>
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
                    <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width: `${xpPercent}%` }} /></div>
                    <div className="xp-label"><span>{xpPercent.toFixed(0)}%</span><span>{currentLevelXp} / 200 XP</span></div>
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
          )
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
            <input className="auth-input" type="text" placeholder="Kullanıcı Adı" value={username} onChange={(e) => setUsername(e.target.value)} required />
          )}
          <input className="auth-input" type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="auth-input" type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Yükleniyor...' : (isRegistering ? 'KAYIT OL' : 'GİRİŞ YAP')}
          </button>
        </form>

        {message && <div className="auth-message">{message}</div>}

        <button className="toggle-button" onClick={() => { setIsRegistering(!isRegistering); setMessage(''); }}>
          {isRegistering ? 'Zaten hesabın var mı? Giriş Yap' : 'Hesabın yok mu? Kayıt Ol'}
        </button>
      </div>
    </div>
  )
}

export default App