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

  // Shop Alt Sekmesi ('store' | 'inventory')
  const [shopSubTab, setShopSubTab] = useState('store')

  // Envanter & Mağaza State'leri
  const [inventory, setInventory] = useState([]) 
  const [equippedItems, setEquippedItems] = useState({
    skin: 'default_box',
    bullet: 'default_bullet',
    trail: 'none'
  })

  // 🛍️ KOCAMAN ÜRÜN LİSTESİ (TÜRÜNE GÖRE GÖRSEL ŞEKLİ VAR: 'skin', 'bullet', 'trail')
  const shopItems = [
    // --- SKİNLER (KUTULAR) ---
    { id: 'skin_neon_purple', type: 'skin', name: 'Siber Mor Küp', price: 50, desc: 'Neon mor parlayan havalı kutu tasarımı.', preview: '#7209b7' },
    { id: 'skin_gold', type: 'skin', name: 'Altın Kaplama Küp', price: 150, desc: 'Zenginliğin ve ihtişamın rengi!', preview: '#ffd700' },
    { id: 'skin_fire_red', type: 'skin', name: 'Cehennem Ateşi Küpü', price: 120, desc: 'Alevler içinde yanan agresif tasarım.', preview: '#e71d36' },
    { id: 'skin_matrix_green', type: 'skin', name: 'Matrix Yeşil Küp', price: 90, desc: 'Dijital kod evreninden fırlamış gibi.', preview: '#00f5d4' },
    { id: 'skin_cyber_pink', type: 'skin', name: 'Cyber Pembe Küp', price: 80, desc: 'Sokakların en dikkat çeken neon pembe tarzı.', preview: '#f72585' },
    { id: 'skin_shadow_black', type: 'skin', name: 'Gölge Karbon Küp', price: 200, desc: 'Karanlığın gücünü üzerinde taşı.', preview: '#1e293b' },

    // --- MERMİ RENKLERİ & PARILDAMALAR ---
    { id: 'bullet_plasma_blue', type: 'bullet', name: 'Plazma Mavi Mermi', price: 40, desc: 'Parlak mavi renkli keskin plazma mermileri.', preview: '#38bdf8' },
    { id: 'bullet_laser_red', type: 'bullet', name: 'Lazer Kırmızı Mermi', price: 60, desc: 'Yüksek hızlı kızılötesi parlayan lazer mermisi.', preview: '#ff4d4d' },
    { id: 'bullet_toxic_green', type: 'bullet', name: 'Zehirli Yeşil Mermi', price: 55, desc: 'Etrafa radyasyon ve yeşil parıltı yayan mermi.', preview: '#10b981' },
    { id: 'bullet_gold_spark', type: 'bullet', name: 'Altın Sarısı Parıltılı Mermi', price: 85, desc: 'Altın tozlarıyla parıldayan özel mermi tipi.', preview: '#facc15' },
    { id: 'bullet_neon_cyan', type: 'bullet', name: 'Cyan Neon Mermi', price: 70, desc: 'Göz alıcı canlı cyan parıldayan mermi izi.', preview: '#22d3ee' },

    // --- HAREKET / İZ (TRAIL) EFEKTLERİ ---
    { id: 'trail_sparks', type: 'trail', name: 'Kıvılcım İz Efekti', price: 75, desc: 'Hareket ederken arkasından uçuşan kıvılcımlar.', preview: '#f72585' },
    { id: 'trail_star_dust', type: 'trail', name: 'Yıldız Tozu İz Efekti', price: 110, desc: 'Galaktik toz bulutu bırakan zarif efekt.', preview: '#a855f7' },
    { id: 'trail_smoke', type: 'trail', name: 'Sis Duman Efekti', price: 65, desc: 'Arzdan süzülen gizemli gri duman izi.', preview: '#64748b' },
    { id: 'trail_fire_trail', type: 'trail', name: 'Alev Yolu İz Efekti', price: 130, desc: 'Aranda bıraktığın yanık alev izleri.', preview: '#ea580c' }
  ]

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
    if (data) {
      setProfile(data)
      if (data.inventory) setInventory(data.inventory)
      if (data.equipped) setEquippedItems(data.equipped)
    }
  }

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, level, xp, wins, losses, is_online')
      .order('level', { ascending: false })
      .order('xp', { ascending: false })

    if (data) setLeaderboardPlayers(data)
  }

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

  // --- SHOP & ENVANTER İŞLEMLERİ ---
  const handleBuyItem = async (item) => {
    if (!profile || (profile.voxel ?? 0) < item.price) {
      alert('❌ Yetersiz Voxel ($VXL$) bakiyesi!')
      return
    }

    if (inventory.includes(item.id)) {
      alert('⚠️ Bu ürüne zaten sahipsin!')
      return
    }

    const newVoxel = profile.voxel - item.price
    const newInventory = [...inventory, item.id]

    const { error } = await supabase
      .from('profiles')
      .update({ voxel: newVoxel, inventory: newInventory })
      .eq('id', session.user.id)

    if (error) {
      alert('Satın alma başarısız: ' + error.message)
    } else {
      setProfile({ ...profile, voxel: newVoxel })
      setInventory(newInventory)
      alert(`🎉 Tebrikler! Başarıyla satın aldın: ${item.name}`)
    }
  }

  const handleEquipItem = async (item) => {
    let updatedEquipped = { ...equippedItems }
    if (item.type === 'skin') updatedEquipped.skin = item.id
    if (item.type === 'bullet') updatedEquipped.bullet = item.id
    if (item.type === 'trail') updatedEquipped.trail = item.id

    const { error } = await supabase
      .from('profiles')
      .update({ equipped: updatedEquipped })
      .eq('id', session.user.id)

    if (!error) {
      setEquippedItems(updatedEquipped)
      alert(`✅ Kuşanıldı: ${item.name}`)
    }
  }

  const handleUnequipItem = async (type) => {
    let updatedEquipped = { ...equippedItems }
    if (type === 'skin') updatedEquipped.skin = 'default_box'
    if (type === 'bullet') updatedEquipped.bullet = 'default_bullet'
    if (type === 'trail') updatedEquipped.trail = 'none'

    const { error } = await supabase
      .from('profiles')
      .update({ equipped: updatedEquipped })
      .eq('id', session.user.id)

    if (!error) {
      setEquippedItems(updatedEquipped)
      alert('🛡️ Eşya üzerinden kaldırıldı (Varsayılana dönüldü).')
    }
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
        { 
          id: data.user.id, 
          username, 
          xp: 0, 
          level: 1, 
          wins: 0, 
          losses: 0, 
          voxel: 250, 
          is_online: true,
          inventory: [],
          equipped: { skin: 'default_box', bullet: 'default_bullet', trail: 'none' }
        }
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
          equippedItems={equippedItems}
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
        <header className="lobby-header" style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          padding: '16px 35px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <span className="lobby-logo" style={{ 
            fontSize: '24px', 
            fontWeight: '800', 
            color: '#fff', 
            letterSpacing: '-0.5px',
            textShadow: '0 0 20px rgba(0, 245, 212, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ color: '#00f5d4' }}>⬛</span> BOX WARS
          </span>

          <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ 
              background: 'rgba(0, 245, 212, 0.1)', 
              border: '1px solid rgba(0, 245, 212, 0.3)', 
              padding: '6px 14px', 
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 15px rgba(0, 245, 212, 0.15)'
            }}>
              <span style={{ color: '#00f5d4', fontWeight: 'bold' }}>🔷 {profile?.voxel ?? 0} VXL</span>
            </div>
            <span className="user-name" style={{ color: '#cbd5e1', fontWeight: '600' }}>⚡ {profile?.username || 'Oyuncu'}</span>
            <button className="logout-btn" onClick={handleLogout} style={{
              background: 'rgba(231, 29, 54, 0.15)',
              border: '1px solid rgba(231, 29, 54, 0.3)',
              color: '#ff6b6b',
              padding: '6px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}>Çıkış</button>
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'center', background: 'transparent', position: 'relative', zIndex: 90, marginTop: '-1px' }}>
          <div style={{ 
            display: 'flex', 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(25px) saturate(180%)',
            WebkitBackdropFilter: 'blur(25px) saturate(180%)',
            borderRadius: '0 0 32px 32px', 
            padding: '10px 30px 16px 30px', 
            gap: '12px', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderTop: 'none',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 245, 212, 0.15)'
          }}>
            <button 
              onClick={() => setActiveTab('home')} 
              style={{ 
                background: activeTab === 'home' ? 'linear-gradient(135deg, #00f5d4, #2ec4b6)' : 'rgba(255, 255, 255, 0.04)', 
                color: activeTab === 'home' ? '#0f172a' : '#94a3b8', 
                border: activeTab === 'home' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
                padding: '10px 24px', 
                borderRadius: '50px', 
                cursor: 'pointer', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                boxShadow: activeTab === 'home' ? '0 10px 25px rgba(0, 245, 212, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
              🏠 Anasayfa
            </button>
            <button 
              onClick={() => setActiveTab('shop')} 
              style={{ 
                background: activeTab === 'shop' ? 'linear-gradient(135deg, #00f5d4, #2ec4b6)' : 'rgba(255, 255, 255, 0.04)', 
                color: activeTab === 'shop' ? '#0f172a' : '#94a3b8', 
                border: activeTab === 'shop' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
                padding: '10px 24px', 
                borderRadius: '50px', 
                cursor: 'pointer', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                boxShadow: activeTab === 'shop' ? '0 10px 25px rgba(0, 245, 212, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
              🛍️ Shop & Envanter
            </button>
            <button 
              onClick={() => setActiveTab('about')} 
              style={{ 
                background: activeTab === 'about' ? 'linear-gradient(135deg, #00f5d4, #2ec4b6)' : 'rgba(255, 255, 255, 0.04)', 
                color: activeTab === 'about' ? '#0f172a' : '#94a3b8', 
                border: activeTab === 'about' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
                padding: '10px 24px', 
                borderRadius: '50px', 
                cursor: 'pointer', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                boxShadow: activeTab === 'about' ? '0 10px 25px rgba(0, 245, 212, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
              📖 Hakkında
            </button>
          </div>
        </div>

        {showLeaderboard && (
          <div className="leaderboard-modal-bg">
            <div className="leaderboard-box">
              <div className="leaderboard-header">
                <h3 style={{ margin: 0, color: '#00f5d4', fontSize: '1.1rem' }}>🏆 Global Liderlik Tablosu</h3>
                <button onClick={() => setShowLeaderboard(false)} style={{ background: '#e71d36', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>

              <div className="leaderboard-list">
                {leaderboardPlayers.map((player, index) => {
                  const isMe = player.id === session.user.id
                  const rankClass = index === 0 ? 'leaderboard-item-rank-1' : (index === 1 ? 'leaderboard-item-rank-2' : (index === 2 ? 'leaderboard-item-rank-3' : 'leaderboard-item-standard'))

                  return (
                    <div key={player.id} className={rankClass} style={isMe ? { borderColor: '#00f5d4', background: 'rgba(0, 245, 212, 0.1)' } : {}}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: index === 0 ? '1.2rem' : '1rem', color: index === 0 ? '#ffd700' : (index === 1 ? '#c0c0c0' : (index === 2 ? '#cd7f32' : '#888')) }}>
                          #{index + 1}
                        </span>
                        <div>
                          <span style={{ fontWeight: 'bold', color: isMe ? '#00f5d4' : '#fff' }}>
                            {player.username} {isMe && '(Sen)'}
                          </span>
                          <div style={{ fontSize: '0.75rem', color: player.is_online ? '#2ec4b6' : '#888' }}>
                            {player.is_online ? '🟢 Çevrimiçi' : '⚪ Çevrimdışı'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', textAlign: 'right' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>Seviye / XP</div>
                          <div style={{ fontWeight: 'bold', color: '#38bdf8' }}>Lvl {player.level}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>Galibiyet</div>
                          <div style={{ fontWeight: 'bold', color: '#2ec4b6' }}>{player.wins} W</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4'ERLİ GRID VE TÜRÜNE GÖRE DOĞRU ÖNİZLEME ŞEKLİ (SKİN=KUTU, MERMİ=ÇUBUK/MERMİ, TRAİL=PARLAYAN TOP) */}
        {activeTab === 'shop' ? (
          <div style={{ padding: '30px', maxWidth: '1250px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
              <button 
                onClick={() => setShopSubTab('store')}
                style={{
                  background: shopSubTab === 'store' ? '#00f5d4' : 'rgba(255,255,255,0.05)',
                  color: shopSubTab === 'store' ? '#0f172a' : '#fff',
                  border: 'none', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: shopSubTab === 'store' ? '0 0 15px rgba(0,245,212,0.4)' : 'none'
                }}>
                🛍️ Mağaza (Satın Al)
              </button>
              <button 
                onClick={() => setShopSubTab('inventory')}
                style={{
                  background: shopSubTab === 'inventory' ? '#00f5d4' : 'rgba(255,255,255,0.05)',
                  color: shopSubTab === 'inventory' ? '#0f172a' : '#fff',
                  border: 'none', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: shopSubTab === 'inventory' ? '0 0 15px rgba(0,245,212,0.4)' : 'none'
                }}>
                🎒 Envanterim & Kuşan / Çıkar
              </button>
            </div>

            {shopSubTab === 'store' ? (
              <div>
                <h3 style={{ color: '#00f5d4', marginBottom: '20px', textAlign: 'center', letterSpacing: '1px' }}>TÜM MAĞAZA ÜRÜNLERİ</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }}>
                  {shopItems.map((item) => {
                    const owned = inventory.includes(item.id)
                    return (
                      <div key={item.id} style={{ 
                        background: 'rgba(15, 23, 42, 0.6)', 
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(255,255,255,0.08)', 
                        borderRadius: '20px', 
                        padding: '20px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        textAlign: 'center',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
                      }}>
                        {/* 🎨 ÜRÜNÜN KENDİNE HAS ŞEKLİ (SKİN=KARE KUTU, MERMİ=İNCE UZUN ÇUBUK, TRAİL=YUVARLAK PARLAYAN TOP) */}
                        <div style={{ 
                          width: item.type === 'bullet' ? '24px' : '55px', 
                          height: item.type === 'bullet' ? '50px' : '55px', 
                          background: item.preview, 
                          borderRadius: item.type === 'skin' ? '14px' : (item.type === 'bullet' ? '12px' : '50%'), 
                          marginBottom: '14px', 
                          boxShadow: `0 0 22px ${item.preview}`,
                          transform: item.type === 'bullet' ? 'rotate(0deg)' : 'none'
                        }} />

                        <h4 style={{ color: '#fff', margin: '0 0 6px 0', fontSize: '1rem' }}>{item.name}</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.75rem', minHeight: '45px', lineHeight: '1.3' }}>{item.desc}</p>
                        <div style={{ color: '#00f5d4', fontWeight: 'bold', margin: '12px 0', fontSize: '1rem' }}>🔷 {item.price} VXL</div>
                        <button 
                          onClick={() => handleBuyItem(item)}
                          disabled={owned}
                          style={{
                            width: '100%', padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: owned ? 'default' : 'pointer',
                            background: owned ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #00f5d4, #2ec4b6)',
                            color: owned ? '#64748b' : '#0f172a',
                            boxShadow: owned ? 'none' : '0 5px 15px rgba(0,245,212,0.3)'
                          }}>
                          {owned ? 'Zaten Sende ✅' : 'Satın Al'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ color: '#00f5d4', marginBottom: '20px', textAlign: 'center', letterSpacing: '1px' }}>ENVANTERİN VE KUŞANIM MERKEZİ</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }}>
                  {inventory.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Envanterinde hiç eşya yok! Mağazadan dilediğin gibi satın alabilirsin. 🚀</p>
                    </div>
                  ) : (
                    inventory.map((invId) => {
                      const item = shopItems.find(i => i.id === invId)
                      if (!item) return null
                      const isEquipped = equippedItems.skin === item.id || equippedItems.bullet === item.id || equippedItems.trail === item.id

                      return (
                        <div key={item.id} style={{ 
                          background: 'rgba(15, 23, 42, 0.6)', 
                          backdropFilter: 'blur(15px)',
                          border: isEquipped ? '2px solid #00f5d4' : '1px solid rgba(255,255,255,0.08)', 
                          borderRadius: '20px', 
                          padding: '20px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          textAlign: 'center',
                          boxShadow: isEquipped ? '0 0 25px rgba(0,245,212,0.25)' : '0 10px 30px rgba(0,0,0,0.4)'
                        }}>
                          {/* 🎨 ENVANTERDE DE DOĞRU ŞEKİL GÖSTERİMİ */}
                          <div style={{ 
                            width: item.type === 'bullet' ? '24px' : '55px', 
                            height: item.type === 'bullet' ? '50px' : '55px', 
                            background: item.preview, 
                            borderRadius: item.type === 'skin' ? '14px' : (item.type === 'bullet' ? '12px' : '50%'), 
                            marginBottom: '14px', 
                            boxShadow: `0 0 22px ${item.preview}` 
                          }} />

                          <h4 style={{ color: '#fff', margin: '0 0 6px 0', fontSize: '1rem' }}>{item.name}</h4>
                          <p style={{ color: '#94a3b8', fontSize: '0.75rem', minHeight: '45px', lineHeight: '1.3' }}>{item.desc}</p>
                          
                          {isEquipped ? (
                            <button 
                              onClick={() => handleUnequipItem(item.type)}
                              style={{
                                width: '100%', padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px',
                                background: '#e71d36',
                                color: '#fff',
                                boxShadow: '0 0 15px rgba(231,29,54,0.4)'
                              }}>
                              Kuşanmayı Kaldır ❌
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleEquipItem(item)}
                              style={{
                                width: '100%', padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px',
                                background: 'rgba(255,255,255,0.1)',
                                color: '#cbd5e1'
                              }}>
                              Kuşan ✨
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'about' ? (
          <div style={{ padding: '40px 30px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            <h2 style={{ color: '#00f5d4', marginBottom: '15px' }}>📖 Box Wars Hakkında</h2>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', lineHeight: '1.6', color: '#ccc' }}>
              <p><strong>Box Wars</strong>, küplerin ve taktiksel kapışmaların merkezde olduğu gerçek zamanlı bir 1v1 web oyunudur.</p>
            </div>
          </div>
        ) : (
          currentRoom ? (
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

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  {!isHost && (
                    <button className="auth-button" onClick={toggleReadyStatus} style={{ background: isGuestReady ? '#2ec4b6' : '#e71d36', flex: 1 }}>
                      {isGuestReady ? '✅ HAZIRSIN (İptal Et)' : '❌ HAZIR OL'}
                    </button>
                  )}
                  <button className="logout-btn" onClick={handleLeaveRoom} style={{ flex: 1, padding: '12px', background: isHost ? '#e71d36' : undefined }}>
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
                          <button onClick={() => handleSendInvite(player.id)} style={{ padding: '5px 10px', background: '#00f5d4', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Davet Et</button>
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

                <div className="mod-card" onClick={() => { fetchLeaderboard(); setShowLeaderboard(true); }} style={{ marginTop: '15px', background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.1), rgba(114, 9, 183, 0.1))', borderColor: '#00f5d4' }}>
                  <div className="mod-left">
                    <span className="mod-name" style={{ color: '#00f5d4' }}>🏆 LİDERLİK TABLOSU</span>
                    <span className="mod-desc">Seviye ve galibiyet sıralaması</span>
                  </div>
                  <span className="mod-badge" style={{ background: '#00f5d4', color: '#0f172a' }}>İNCELE</span>
                </div>
              </section>

              <section className="stats-panel">
                <h3 className="panel-title">👥 Çevrimiçi Oyuncular & Gelen Davetler</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {onlinePlayers.length === 0 ? (
                    <p style={{ color: '#888' }}>Şu an çevrimiçi başka oyuncu yok.</p>
                  ) : (
                    onlinePlayers.map((player) => {
                      const invite = incomingInvites.find((inv) => inv.sender_id === player.id)
                      return (
                        <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', alignItems: 'center' }}>
                          <span>{player.username} (Lvl {player.level}) <span style={{ color: '#2ec4b6', fontSize: '12px' }}>🟢 Online</span></span>
                          {invite ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button onClick={() => handleAcceptInvite(invite)} style={{ padding: '5px 8px', background: '#2ec4b6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Kabul Et ✅</button>
                              <button onClick={() => handleRejectInvite(invite)} style={{ padding: '5px 8px', background: '#e71d36', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Reddet ❌</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#888' }}>Bekleniyor...</span>
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