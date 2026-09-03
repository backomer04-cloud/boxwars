import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import GameCanvas from './GameCanvas'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [fullName, setFullName] = useState('')
const [birthDate, setBirthDate] = useState('')
const [location, setLocation] = useState('')
  const [toast, setToast] = useState({ show: false, message: '' });
  const [inGame, setInGame] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false) // 🌐 Sunucu bekleme / yüklenme ekranı state'i

  const [activeTab, setActiveTab] = useState('home')
  const [shopSubTab, setShopSubTab] = useState('store')

  const [inventory, setInventory] = useState([]) 
  const [equippedItems, setEquippedItems] = useState({
    skin: 'default_box',
    bullet: 'default_bullet',
    trail: 'none'
  })

  // 🛍️ 60 ÜRÜNLÜK DEV MAĞAZA (Özel İkon/Görsel Tanımlarıyla)
  const shopItems = [
    // --- SKİN / KUTU ÇEŞİTLERİ (20 Adet) ---
    { id: 'skin_neon_purple', type: 'skin', name: 'Siber Mor Küp', price: 50, desc: 'Neon mor parlayan havalı kutu tasarımı.', preview: '#7209b7', iconType: 'cube' },
    { id: 'skin_gold', type: 'skin', name: 'Altın Kaplama Küp', price: 200, desc: 'Zenginliğin ve ihtişamın zirvesi!', preview: '#ffd700', iconType: 'cube' },
    { id: 'skin_fire_red', type: 'skin', name: 'Cehennem Ateşi Küpü', price: 150, desc: 'Alevler içinde yanan agresif tasarım.', preview: '#e71d36', iconType: 'fire' },
    { id: 'skin_matrix_green', type: 'skin', name: 'Matrix Yeşil Küp', price: 100, desc: 'Dijital kod evreninden fırlamış gibi.', preview: '#00f5d4', iconType: 'cube' },
    { id: 'skin_cyber_pink', type: 'skin', name: 'Cyber Pembe Küp', price: 90, desc: 'Sokakların en dikkat çeken neon pembe tarzı.', preview: '#f72585', iconType: 'cube' },
    { id: 'skin_shadow_black', type: 'skin', name: 'Gölge Karbon Küp', price: 250, desc: 'Karanlığın gücünü üzerinde taşı.', preview: '#1e293b', iconType: 'cube' },
    { id: 'skin_electric_blue', type: 'skin', name: 'Elektrik Mavisi Küp', price: 120, desc: 'Yüksek voltajlı akımlarla parıldayan küp.', preview: '#3b82f6', iconType: 'lightning' },
    { id: 'skin_toxic_slime', type: 'skin', name: 'Radyoaktif Slime Küp', price: 140, desc: 'Asit yeşili zehirli toksik kutu.', preview: '#84cc16', iconType: 'cube' },
    { id: 'skin_sunset_orange', type: 'skin', name: 'Gün Batımı Küpü', price: 110, desc: 'Akşamüstü kızıllığı ve sıcak tonlar.', preview: '#f97316', iconType: 'cube' },
    { id: 'skin_galaxy_violet', type: 'skin', name: 'Galaksi Moru Küp', price: 220, desc: 'Derin uzayın sonsuz gizemini barındırır.', preview: '#8b5cf6', iconType: 'cube' },
    { id: 'skin_cat_face', type: 'skin', name: 'Kedi Surat Küpü', price: 130, desc: 'Sevimli ama bir o kadar çevik kedi yüzlü stil.', preview: '#fb923c', iconType: 'cat' },
    { id: 'skin_dog_face', type: 'skin', name: 'Köpek Surat Küpü', price: 130, desc: 'Sadık ve güçlü dostların tarzını yansıtan kutu.', preview: '#d97706', iconType: 'dog' },
    { id: 'skin_ghost_white', type: 'skin', name: 'Hayalet Suret Küpü', price: 160, desc: 'Karanlıkta parlayan ürkütücü hayalet yüzü.', preview: '#e2e8f0', iconType: 'ghost' },
    { id: 'skin_pirate_box', type: 'skin', name: 'Korsan Kasa Küp', price: 175, desc: 'Yedi denizlerin korkusuz korsan maskotu.', preview: '#78716c', iconType: 'pirate' },
    { id: 'skin_robot_droid', type: 'skin', name: 'Savaş Droidi Küpü', price: 190, desc: 'Geleceğin metalik robotik yüz hatları.', preview: '#64748b', iconType: 'robot' },
    { id: 'skin_camo_military', type: 'skin', name: 'Taktiksel Komando Küpü', price: 115, desc: 'Askeri yeşil kamuflaj ve sert hatlar.', preview: '#4d7c0f', iconType: 'cube' },
    { id: 'skin_ice_crystal', type: 'skin', name: 'Buz Kristali Küpü', price: 180, desc: 'Kutup soğuğunda donmuş elmas yüzey.', preview: '#06b6d4', iconType: 'cube' },
    { id: 'skin_magma_core', type: 'skin', name: 'Magma Çekirdek Küp', price: 210, desc: 'İçten dışa lav püskürten tehlikeli tasarım.', preview: '#c2410c', iconType: 'fire' },
    { id: 'skin_toxic_hazard', type: 'skin', name: 'Biyolojik Tehlike Küpü', price: 155, desc: 'Tehlikeli maddeler biriminin resmi kasası.', preview: '#ca8a04', iconType: 'cube' },
    { id: 'skin_royal_crown', type: 'skin', name: 'Kraliyet Altın Küpü', price: 300, desc: 'Sadece şampiyonların hak ettiği taçlı ihtişam.', preview: '#eab308', iconType: 'crown' },

    // --- MERMİ RENKLERİ & İZLERİ (20 Adet) ---
    { id: 'bullet_plasma_blue', type: 'bullet', name: 'Plazma Mavi Mermi', price: 40, desc: 'Parlak mavi renkli keskin plazma mermileri.', preview: '#38bdf8', iconType: 'bullet' },
    { id: 'bullet_laser_red', type: 'bullet', name: 'Lazer Kırmızı Mermi', price: 60, desc: 'Yüksek hızlı kızılötesi parlayan lazer mermisi.', preview: '#ff4d4d', iconType: 'bullet' },
    { id: 'bullet_toxic_green', type: 'bullet', name: 'Zehirli Yeşil Mermi', price: 55, desc: 'Etrafa radyasyon ve yeşil parıltı yayan mermi.', preview: '#10b981', iconType: 'bullet' },
    { id: 'bullet_gold_spark', type: 'bullet', name: 'Altın Sarısı Mermi', price: 90, desc: 'Altın tozlarıyla parıldayan özel mermi tipi.', preview: '#facc15', iconType: 'bullet' },
    { id: 'bullet_neon_cyan', type: 'bullet', name: 'Cyan Neon Mermi', price: 70, desc: 'Göz alıcı canlı cyan parıldayan mermi izi.', preview: '#22d3ee', iconType: 'bullet' },
    { id: 'bullet_hot_pink', type: 'bullet', name: 'Kızıl Ötesi Pembe Mermi', price: 75, desc: 'Çarpıcı sıcak pembe mermi hüzmesi.', preview: '#ec4899', iconType: 'bullet' },
    { id: 'bullet_sun_yellow', type: 'bullet', name: 'Güneş Işığı Mermisi', price: 50, desc: 'Göz alan sarı parıltılı enerji mermisi.', preview: '#eab308', iconType: 'bullet' },
    { id: 'bullet_pure_white', type: 'bullet', name: 'Süpernova Beyaz Mermi', price: 100, desc: 'Kör edici saf beyaz lazer ışığı.', preview: '#f8fafc', iconType: 'bullet' },
    { id: 'bullet_ruby_red', type: 'bullet', name: 'Yakut Kırmızı Mermi', price: 65, desc: 'Derin yakut rengi delici mermi çekirdeği.', preview: '#991b1b', iconType: 'bullet' },
    { id: 'bullet_emerald_ray', type: 'bullet', name: 'Zümrüt Işını Mermisi', price: 80, desc: 'Zümrüt yeşili saf enerji huzmesi.', preview: '#065f46', iconType: 'bullet' },
    { id: 'bullet_amethyst_bolt', type: 'bullet', name: 'Ametist Moru Mermi', price: 85, desc: 'Gizemli ametist kristal mermisi.', preview: '#581c87', iconType: 'bullet' },
    { id: 'bullet_copper_shot', type: 'bullet', name: 'Bakır Pası Mermi', price: 45, desc: 'Aşındırıcı bakır tonlu kurşun izi.', preview: '#9a3412', iconType: 'bullet' },
    { id: 'bullet_silver_flash', type: 'bullet', name: 'Gümüş Flaş Mermi', price: 70, desc: 'Hızlı ve keskin gümüş parıltı.', preview: '#94a3b8', iconType: 'bullet' },
    { id: 'bullet_orange_flare', type: 'bullet', name: 'Turuncu Flare Mermi', price: 50, desc: 'Akşam karanlığını delen turuncu alev.', preview: '#c2410c', iconType: 'bullet' },
    { id: 'bullet_lime_zap', type: 'bullet', name: 'Lime Çarpma Mermisi', price: 60, desc: 'Asit lime tonlu elektrikli mermi.', preview: '#65a30d', iconType: 'bullet' },
    { id: 'bullet_indigo_beam', type: 'bullet', name: 'İndigo Derinlik Mermisi', price: 95, desc: 'Derin uzay indigo dalga mermisi.', preview: '#3730a3', iconType: 'bullet' },
    { id: 'bullet_rose_quartz', type: 'bullet', name: 'Gül Kuvars Mermi', price: 55, desc: 'Yumuşak pembe kristal mermi atışı.', preview: '#fda4af', iconType: 'bullet' },
    { id: 'bullet_neon_teal', type: 'bullet', name: 'Neon Teal Mermi', price: 75, desc: 'Fütüristik koyu turkuaz mermi izi.', preview: '#0d9488', iconType: 'bullet' },
    { id: 'bullet_carbon_dark', type: 'bullet', name: 'Karbon Siyahı Mermi', price: 110, desc: 'Görünmezliği andıran karanlık mermi.', preview: '#0f172a', iconType: 'bullet' },
    { id: 'bullet_rainbow_prism', type: 'bullet', name: 'Prizma Renkli Mermi', price: 150, desc: 'Gökkuşağı renklerinde salınan efsane mermi.', preview: '#db2777', iconType: 'bullet' },

    // --- HAREKET / İZ (TRAIL) EFEKTLERİ (20 Adet) ---
    { id: 'trail_sparks', type: 'trail', name: 'Kıvılcım İz Efekti', price: 75, desc: 'Hareket ederken arkasından uçuşan kıvılcımlar.', preview: '#f72585', iconType: 'trail' },
    { id: 'trail_star_dust', type: 'trail', name: 'Yıldız Tozu Efekti', price: 120, desc: 'Galaktik toz bulutu bırakan zarif efekt.', preview: '#a855f7', iconType: 'trail' },
    { id: 'trail_smoke', type: 'trail', name: 'Sis Duman Efekti', price: 65, desc: 'Arzdan süzülen gizemli gri duman izi.', preview: '#64748b', iconType: 'trail' },
    { id: 'trail_fire_trail', type: 'trail', name: 'Alev Yolu Efekti', price: 140, desc: 'Aranda bıraktığın yanık alev izleri.', preview: '#ea580c', iconType: 'trail' },
    { id: 'trail_lightning', type: 'trail', name: 'Yıldırım Çarpması İzi', price: 160, desc: 'Aranda çakıp sönen elektrik arkları.', preview: '#38bdf8', iconType: 'trail' },
    { id: 'trail_matrix_code', type: 'trail', name: 'Matrix Kod Akışı', price: 150, desc: 'Arzdan süzülen yeşil kod parçacıkları.', preview: '#22c55e', iconType: 'trail' },
    { id: 'trail_bubble_pop', type: 'trail', name: 'Renkli Baloncuk İzi', price: 80, desc: 'Arkada patlayan neşeli renkli baloncuklar.', preview: '#38bdf8', iconType: 'trail' },
    { id: 'trail_toxic_droplet', type: 'trail', name: 'Zehir Damlası İzi', price: 90, desc: 'Yere damlayan asidik yeşil sızıntı.', preview: '#84cc16', iconType: 'trail' },
    { id: 'trail_shadow_mist', type: 'trail', name: 'Gölge Sis Çizgisi', price: 110, desc: 'Karanlık karanlık süzülen gizemli gölge.', preview: '#334155', iconType: 'trail' },
    { id: 'trail_gold_coins', type: 'trail', name: 'Altın Parıltı İzi', price: 180, desc: 'Zenginlik hissi veren altın tanecikleri.', preview: '#eab308', iconType: 'trail' },
    { id: 'trail_ice_frost', type: 'trail', name: 'Buz Patinası İzi', price: 100, desc: 'Yerde donan soğuk kristal izleri.', preview: '#22d3ee', iconType: 'trail' },
    { id: 'trail_heart_beats', type: 'trail', name: 'Kalp Atışı Efekti', price: 130, desc: 'Sevgi dolu pembe kalp parçacıkları.', preview: '#f43f5e', iconType: 'trail' },
    { id: 'trail_music_notes', type: 'trail', name: 'Müzik Nota İzi', price: 115, desc: 'Havadа dans eden nota sembolleri.', preview: '#8b5cf6', iconType: 'trail' },
    { id: 'trail_pixel_glitch', type: 'trail', name: 'Piksel Glitch İzi', price: 145, desc: 'Dijital hata veren retro piksel art izi.', preview: '#10b981', iconType: 'trail' },
    { id: 'trail_feather_fall', type: 'trail', name: 'Tüy Düşüşü Efekti', price: 95, desc: 'Hafifçe süzülen beyaz tüy tanecikleri.', preview: '#f1f5f9', iconType: 'trail' },
    { id: 'trail_plasma_trail', type: 'trail', name: 'Plazma Enerji İzi', price: 155, desc: 'Yüksek yoğunluklu saf plazma dalgası.', preview: '#0284c7', iconType: 'trail' },
    { id: 'trail_sakura_petals', type: 'trail', name: 'Sakura Yaprakları', price: 135, desc: 'Rüzgarda uçuşan pembe kiraz çiçekleri.', preview: '#fb7185', iconType: 'trail' },
    { id: 'trail_meteor_tail', type: 'trail', name: 'Meteor Kuyruğu İzi', price: 170, desc: 'Atmosfere giren taş gibi yanan kuyruk.', preview: '#f97316', iconType: 'trail' },
    { id: 'trail_neon_pulse', type: 'trail', name: 'Neon Nabız Çizgisi', profile: '#ec4899', price: 125, desc: 'Ritimle atan yanıp sönen şerit.', preview: '#ec4899', iconType: 'trail' },
    { id: 'trail_cosmic_void', type: 'trail', name: 'Kozmik Boşluk İzi', price: 200, desc: 'Yutan kara delik esintili uzay izi.', preview: '#4c1d95', iconType: 'trail' }
  ]

  const [currentRoom, setCurrentRoom] = useState(null) 
  const [roomMembers, setRoomMembers] = useState([]) 
  const [onlinePlayers, setOnlinePlayers] = useState([]) 
  const [incomingInvites, setIncomingInvites] = useState([]) 
  const [currentInviteId, setCurrentInviteId] = useState(null) 

  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardPlayers, setLeaderboardPlayers] = useState([])

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [isRegistering, setIsRegistering] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  
  // showToast fonksiyonu bu yapıya göre çalışacak
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 4500);
  };

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
        showToast('🎉 Rakip daveti kabul etti! Odaya giriliyor...')
        setCurrentRoom({ id: updated.room_id, status: 'waiting' })
        setCurrentInviteId(updated.id)
        setActiveTab('home')
      } else if (updated.status === 'rejected') {
        showToast('❌ Rakip daveti reddetti.')
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
        showToast('⚠️ Oda kapatıldı!')
        handleBackToLobby()
        return
      }

      // Oda durumu 'playing' olduğunda doğrudan oyuna girmek yerine önce kısa bir sunucu bağlantı/yüklenme ekranı tetikle
      if (roomData.status === 'playing' && !inGame && !isConnecting) {
        setIsConnecting(true)
        setTimeout(() => {
          setIsConnecting(false)
          setInGame(true)
        }, 1500)
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
  }, [currentRoom, currentInviteId, session, inGame, isConnecting])

  const handleCreateRoom = async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ host_id: session.user.id, status: 'waiting' }])
      .select()
      .single()

   if (error) showToast('Oda oluşturulamadı: ' + error.message)
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
     showToast('Bu oyuncuya zaten aktif bir davet gönderilmiş!')
      return
    }

    const { error } = await supabase.from('invites').insert([{
      sender_id: session.user.id,
      receiver_id: receiverId,
      room_id: currentRoom.id,
      status: 'pending',
      is_ready: false
    }])

    if (error) {
      showToast('Davet gönderilemedi: ' + error.message)
    } else {
      showToast('Davet gönderildi!')
    }
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
    if (!error) {
      setIsConnecting(true)
      setTimeout(() => {
        setIsConnecting(false)
        setInGame(true)
      }, 1500)
    } else {
      showToast('Oyun başlatılamadı: ' + error.message)
    }
  }

  const handleBackToLobby = async () => {
    if (currentRoom && session?.user?.id === currentRoom.host_id) {
      await supabase.from('rooms').delete().eq('id', currentRoom.id)
      await supabase.from('invites').delete().eq('room_id', currentRoom.id)
    }
    setInGame(false)
    setIsConnecting(false)
    setCurrentRoom(null)
    setCurrentInviteId(null)
    setRoomMembers([])
    if (session) fetchProfile(session.user.id)
  }

 const handleBuyItem = async (item) => {
    if (!profile || (profile.voxel ?? 0) < item.price) {
      showToast('❌ Yetersiz Voxel (VXL) bakiyesi!')
      return
    }

    if (inventory.includes(item.id)) {
      showToast('⚠️ Bu ürüne zaten sahipsin!')
      return
    }

    const newVoxel = profile.voxel - item.price
    const newInventory = [...inventory, item.id]

    const { error } = await supabase
      .from('profiles')
      .update({ voxel: newVoxel, inventory: newInventory })
      .eq('id', session.user.id)

    if (error) {
      showToast('Satın alma başarısız: ' + error.message)
    } else {
      setProfile({ ...profile, voxel: newVoxel })
      setInventory(newInventory)
      showToast(`🎉 Tebrikler! Başarıyla satın aldın: ${item.name}`)
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
      showToast(`✅ Kuşanıldı: ${item.name}`)
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
      showToast('🛡️ Eşya üzerinden kaldırıldı.')
    }
  }

const handleRegister = async (e) => {
  e.preventDefault()

  // Doğum tarihi ve konum güvenlik/mantık kontrolü
  if (!birthDate) {
    showToast('❌ Lütfen doğum tarihinizi eksiksiz seçin.')
    return
  }

  const selectedYear = new Date(birthDate).getFullYear()
  const currentYear = new Date().getFullYear()
  
  if (selectedYear < 1920 || selectedYear > currentYear) {
    showToast('❌ Lütfen geçerli bir doğum yılı girin.')
    return
  }

  if (!location.trim() || location.trim().length < 3) {
    showToast('❌ Lütfen geçerli bir ülke / şehir girin.')
    return
  }

  setLoading(true)

  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      data: {
        username,
        full_name: fullName,
        birth_date: birthDate,
        location
      }
    }
  })
  
  if (error) {
    showToast(`❌ ${error.message}`)
    setLoading(false)
    return
  }

  if (data.user) {
    const { error: profileErr } = await supabase.from('profiles').insert([
      { 
        id: data.user.id, 
        username, 
        full_name: fullName,
        birth_date: birthDate,
        location,
        xp: 0, 
        level: 1, 
        wins: 0, 
        losses: 0, 
        voxel: 100, 
        is_online: true,
        inventory: [],
        equipped: { skin: 'default_box', bullet: 'default_bullet', trail: 'none' }
      }
    ])
    if (profileErr) {
      showToast(`❌ ${profileErr.message}`)
    } else {
      showToast('✅ Kayıt başarılı! Giriş yapabilirsin.')
      setIsRegistering(false)
      setUsername('')
      setFullName('')
      setBirthDate('')
      setLocation('')
      setPassword('')
    }
  }
  setLoading(false)
}

const handleLogin = async (e) => {
  e.preventDefault()
  setLoading(true)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    showToast(`❌ ${error.message}`)
  } else if (data.user) {
    await supabase.from('profiles').update({ is_online: true }).eq('id', data.user.id)
    showToast('Giriş başarılı!')
  }
  setLoading(false)
}

const handleForgotPassword = async () => {
  if (!email || !email.includes('@')) {
    showToast('❌ Lütfen önce geçerli bir E-posta adresi yazın.')
    return
  }
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })

  if (error) {
    showToast('❌ Hata: ' + error.message)
  } else {
    showToast('✅ Şifre sıfırlama bağlantısı e-postana gönderildi!')
  }
}

  const handleLogout = async () => {
    if (currentRoom) await handleLeaveRoom()
    if (session) await supabase.from('profiles').update({ is_online: false }).eq('id', session.user.id)
    await supabase.auth.signOut()
    setProfile(null)
    setCurrentRoom(null)
  }

  const handleUpdateProfile = async (e) => {
  e.preventDefault()
  if (!session?.user) return

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      birth_date: birthDate,
      location: location
    })
    .eq('id', session.user.id)

  if (error) {
    setToast({ show: true, message: `❌ ${error.message}` })
  } else {
    setToast({ show: true, message: '✅ Profil başarıyla güncellendi!' })
    setProfile(prev => ({ ...prev, full_name: fullName, birth_date: birthDate, location }))
    setIsProfileOpen(false)
  }
}


// --- 1. openProfileModal fonksiyonunu bununla değiştir ---
const openProfileModal = async () => {
  const { data } = await supabase.from('profiles').select('*')
  const userProfile = data?.find(p => p.id === session?.user?.id)
  
  if (userProfile) {
    setProfile(userProfile)
    setFullName(userProfile.full_name || '')
    setBirthDate(userProfile.birth_date || '')
    setLocation(userProfile.location || '')
  }
  
  setIsProfileOpen(true)
  document.body.classList.add('modal-open') // Arka planı kilitler
}

// --- 2. Modalı kapatmak için bu fonksiyonu kullan ---
const closeProfileModal = () => {
  setIsProfileOpen(false)
  document.body.classList.remove('modal-open') // Kilidi kaldırır
}

  // 🎨 ÜRÜN İKONLARINI ÇİZEN YARDIMCI BİLEŞEN
  const renderItemPreviewIcon = (item) => {
    const baseStyle = {
      width: item.type === 'bullet' ? '24px' : '60px',
      height: item.type === 'bullet' ? '50px' : '60px',
      background: item.preview,
      borderRadius: item.type === 'skin' ? '14px' : (item.type === 'bullet' ? '12px' : '50%'),
      boxShadow: `0 0 22px ${item.preview}`,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '14px'
    }

    if (item.iconType === 'cat') {
      return (
        <div style={baseStyle}>
          <div style={{ position: 'absolute', top: '-10px', left: '6px', width: '0', height: '0', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '14px solid #fb923c' }} />
          <div style={{ position: 'absolute', top: '-10px', right: '6px', width: '0', height: '0', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '14px solid #fb923c' }} />
          <div style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%', position: 'absolute', top: '22px', left: '16px' }} />
          <div style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%', position: 'absolute', top: '22px', right: '16px' }} />
        </div>
      )
    }

    if (item.iconType === 'dog') {
      return (
        <div style={baseStyle}>
          <div style={{ position: 'absolute', top: '4px', left: '-8px', width: '12px', height: '22px', background: '#b45309', borderRadius: '6px' }} />
          <div style={{ position: 'absolute', top: '4px', right: '-8px', width: '12px', height: '22px', background: '#b45309', borderRadius: '6px' }} />
          <div style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%', position: 'absolute', top: '22px', left: '16px' }} />
          <div style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%', position: 'absolute', top: '22px', right: '16px' }} />
        </div>
      )
    }

    if (item.iconType === 'ghost') {
      return (
        <div style={baseStyle}>
          <div style={{ width: '10px', height: '10px', background: '#7f1d1d', borderRadius: '50%', position: 'absolute', top: '20px', left: '14px' }} />
          <div style={{ width: '10px', height: '10px', background: '#7f1d1d', borderRadius: '50%', position: 'absolute', top: '20px', right: '14px' }} />
        </div>
      )
    }

    if (item.iconType === 'pirate') {
      return (
        <div style={baseStyle}>
          <div style={{ position: 'absolute', top: '8px', left: '0', right: '0', height: '14px', background: '#dc2626' }} />
          <div style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%', position: 'absolute', top: '28px', left: '26px' }} />
        </div>
      )
    }

    if (item.iconType === 'robot') {
      return (
        <div style={baseStyle}>
          <div style={{ width: '32px', height: '10px', background: '#00f5d4', borderRadius: '4px', position: 'absolute', top: '22px', boxShadow: '0 0 10px #00f5d4' }} />
        </div>
      )
    }

    if (item.iconType === 'crown') {
      return (
        <div style={baseStyle}>
          <div style={{ fontSize: '24px', position: 'absolute', top: '12px' }}>👑</div>
        </div>
      )
    }

    if (item.iconType === 'fire') {
      return (
        <div style={baseStyle}>
          <div style={{ fontSize: '24px', position: 'absolute', top: '12px' }}>🔥</div>
        </div>
      )
    }

    return <div style={baseStyle} />
  }

  const currentLevelXp = profile?.xp ? profile.xp % 200 : 0
  const xpPercent = (currentLevelXp / 200) * 100

  // 🌐 SUNUCU BAĞLANTI VE YÜKLENME BEKLEME EKRANI
  if (isConnecting) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#0f172a',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        color: '#fff', gap: '20px', zIndex: 99999, position: 'fixed', top: 0, left: 0
      }}>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <div style={{
          width: '60px', height: '60px', border: '5px solid rgba(0, 245, 212, 0.2)',
          borderTop: '5px solid #00f5d4', borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00f5d4', textShadow: '0 0 15px rgba(0,245,212,0.5)' }}>
          Savaş Alanına Bağlanılıyor... 🌐
        </div>
        <div style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Sunucu senkronize ediliyor, rakip bekleniyor.</div>
      </div>
    )
  }

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
          shopItems={shopItems}
        />
      )
    }


    const isHost = currentRoom && session?.user?.id === currentRoom.host_id
    const isRoomFull = roomMembers.length >= 2
    const guestMember = roomMembers.find(m => m.role === 'guest')
    const isGuestReady = guestMember ? guestMember.isReady : false
    const canStartGame = isRoomFull && isGuestReady

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    
    const playerName = e.target[0].value || "Anonim Oyuncu";
    const messageContent = e.target[1].value;

    try {
      const { error } = await supabase
        .from('feedbacks')
        .insert([{ player_name: playerName, message: messageContent }]);

      if (error) throw error;

      showToast("Geri bildirimin başarıyla kaydedildi! Teşekkürler, Ömer'e iletildi. 🚀");
      e.target.reset();
    } catch (err) {
      console.error("Hata:", err.message);
      showToast("Mesaj gönderilirken bir sorun oluştu ama not aldık!");
    }
  };

    return (
      <div className="lobby-wrap">
      {/* TOAST BİLDİRİMİ EN ÜSTE KOYUYORUZ */}
     {/* Global Toast Görüntüsü */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 245, 212, 0.15)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #00f5d4',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '14px',
          boxShadow: '0 10px 30px rgba(0, 245, 212, 0.3)',
          zIndex: 9999,
          fontWeight: '600',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeInOut 4.5s ease forwards'
        }}>
          <span style={{ color: '#00f5d4' }}>✨</span> {toast.message}
        </div>
      )}

      {/* Profil Modalı (Tüm Veriler Dahil) */}
{isProfileOpen && (
  <div className="profile-modal-overlay">
    <div className="profile-modal-content">
      <h3 className="profile-modal-title">OYUNCU PROFİLİ</h3>
      
      {/* Salt Okunur Tüm İstatistikler ve Oyun Verileri */}
      <div className="profile-stats-grid">
        <div className="profile-stat-box">Seviye: <span className="stat-val">{profile?.level}</span></div>
        <div className="profile-stat-box">XP: <span className="stat-val">{profile?.xp}</span></div>
        <div className="profile-stat-box">Voxel: <span className="voxel-val">{profile?.voxel} 💎</span></div>
        <div className="profile-stat-box">Zafer / Yenilgi: <span className="win-val">{profile?.wins}</span> / <span className="loss-val">{profile?.losses}</span></div>
      </div>

      {/* Düzenlenebilir Bilgiler Formu */}
      <form onSubmit={handleUpdateProfile} className="profile-form">
        <div className="profile-input-group">
          <label className="profile-input-label">Ad Soyad</label>
          <input className="auth-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div className="profile-input-group">
          <label className="profile-input-label">Konum (Ülke / Şehir)</label>
          <input className="auth-input" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div className="profile-input-group">
          <label className="profile-input-label">Doğum Tarihi</label>
          <input className="auth-input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>

        <div className="profile-modal-actions">
          <button type="submit" className="auth-button profile-submit-btn">Güncelle</button>
         <button type="button" onClick={closeProfileModal} className="profile-close-btn">
  Kapat
</button>
        </div>
      </form>
    </div>
  </div>
)}


        <header className="lobby-header" >
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

         {/* Kullanıcı Rozet ve Profil Barı */}
<div className="user-badge">
  <div className="voxel-pill">
    <span className="voxel-text">🔷 {profile?.voxel ?? 0} VXL</span>
  </div>

  <div className="user-info-area">
    <span className="user-name">⚡ {profile?.username || 'Oyuncu'}</span>
    <button className="profile-dots-btn" onClick={openProfileModal}>
      ⋮
    </button>
  </div>

  <button className="logout-btn" onClick={handleLogout}>Çıkış</button>
</div>


        </header>

<div style={{ display: 'flex', justifyContent: 'center', background: 'transparent', position: 'relative', zIndex: 90, marginTop: '-1px', width: '100%', boxSizing: 'border-box', padding: '0 10px' }}>
  <div className="sticky-nav-container" style={{ 
    display: 'flex', 
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px', 
  }}>
    <button 
      onClick={() => setActiveTab('home')} 
      style={{ 
        background: activeTab === 'home' ? 'linear-gradient(135deg, #00f5d4, #2ec4b6)' : 'rgba(255, 255, 255, 0.04)', 
        color: activeTab === 'home' ? '#0f172a' : '#94a3b8', 
        border: activeTab === 'home' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
        padding: '10px 20px', 
        borderRadius: '50px', 
        cursor: 'pointer', 
        fontWeight: '600', 
        fontSize: '0.9rem',
        flex: '1 1 130px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        boxShadow: activeTab === 'home' ? '0 10px 25px rgba(0, 245, 212, 0.4)' : 'none'
      }}>
      🏠 Anasayfa
    </button>
    <button 
      onClick={() => setActiveTab('shop')} 
      style={{ 
        background: activeTab === 'shop' ? 'linear-gradient(135deg, #00f5d4, #2ec4b6)' : 'rgba(255, 255, 255, 0.04)', 
        color: activeTab === 'shop' ? '#0f172a' : '#94a3b8', 
        border: activeTab === 'shop' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
        padding: '10px 20px', 
        borderRadius: '50px', 
        cursor: 'pointer', 
        fontWeight: '600', 
        fontSize: '0.9rem',
        flex: '1 1 180px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        boxShadow: activeTab === 'shop' ? '0 10px 25px rgba(0, 245, 212, 0.4)' : 'none'
      }}>
      🛍️ Mağaza & Envanter
    </button>
    <button 
      onClick={() => setActiveTab('about')} 
      style={{ 
        background: activeTab === 'about' ? 'linear-gradient(135deg, #00f5d4, #2ec4b6)' : 'rgba(255, 255, 255, 0.04)', 
        color: activeTab === 'about' ? '#0f172a' : '#94a3b8', 
        border: activeTab === 'about' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
        padding: '10px 20px', 
        borderRadius: '50px', 
        cursor: 'pointer', 
        fontWeight: '600', 
        fontSize: '0.9rem',
        flex: '1 1 110px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        boxShadow: activeTab === 'about' ? '0 10px 25px rgba(0, 245, 212, 0.4)' : 'none'
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
                🛍️ Mağaza (60 Ürün)
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
                <h3 style={{ color: '#00f5d4', marginBottom: '20px', textAlign: 'center', letterSpacing: '1px' }}>60 ÜRÜNLÜK DEV KOLEKSİYON (20 Skin - 20 Mermi - 20 Efekt)</h3>
                <div className="shop-grid-container">
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
                        {renderItemPreviewIcon(item)}

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
                <div className="shop-grid-container">
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
                          {renderItemPreviewIcon(item)}

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
        ) :activeTab === 'about' ? (
  <div style={{ padding: '40px 30px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
    <h2 style={{ color: '#00f5d4', marginBottom: '15px' }}>📖 Box Wars Hakkında & Künye</h2>
    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', lineHeight: '1.6', color: '#ccc' }}>
      
      {/* Temel Giriş ve VXL Detayı */}
      <p style={{ marginBottom: '20px' }}>
        <strong style={{ color: '#fff' }}>Box Wars</strong>, toplamda 60 farklı özelleştirme seçeneği (20 özel skin, 20 mermi efekti ve 20 görsel efekt) sunan, yüksek tempolu ve rekabetçi bir 1v1 web tabanlı aksiyon oyunudur. Arenada aldığın her galibiyette ve atladığın her seviyede <strong style={{ color: '#00f5d4' }}>50 VXL</strong> kazanarak cüzdanını büyütebilirsin!
      </p>

      {/* Oyun Mekanikleri ve Detaylı Anlatım */}
      <h3 style={{ color: '#00f5d4', fontSize: '1.1rem', marginBottom: '8px', marginTop: '20px' }}>🎮 Detaylı Oyun Mekanikleri</h3>
      <p style={{ marginBottom: '12px' }}>
        Oyunda temel amaç, taktiksel hareketler ve nişan yeteneğini kullanarak rakibinden önce onun kutularını veya can barını bitirmektir. 
      </p>
      <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        <li><span style={{ color: '#fff' }}>Dinamik 1v1 Savaş Arenası:</span> Her maç anlık refleks gerektirir. Doğru pozisyon al, mermilerden kaç ve en uygun zamanda karşı atağa geç.</li>
        <li><span style={{ color: '#fff' }}>Zengin Mağaza Sistemi:</span> Mağaza üzerinden topladığın VXL'lerle karakterinin görünümünü tamamen değiştirebilir, mermilerine ve vuruşlarına nefis görsel efektler ekleyebilirsin.</li>
        <li><span style={{ color: '#fff' }}>Gelişmiş İlerleme (XP & Seviye):</span> Savaşlarda gösterdiğin performans sana XP kazandırır. Seviye atladıkça hem profilini güçlendirir hem de ödülleri toplarsın.</li>
        <li><span style={{ color: '#fff' }}>Çoklu Platform Desteği:</span> İster klavye ve fare kombinasyonuyla masaüstünde, ister mobil cihazlar/tabletler için özel olarak optimize edilmiş dokunmatik D-Pad ve ateş butonlarıyla kesintisiz oyna.</li>
      </ul>

      {/* Geliştirici & Patent / Telif Hakları */}
      <h3 style={{ color: '#00f5d4', fontSize: '1.1rem', marginBottom: '8px', marginTop: '20px' }}>⚖️ Patent, Telif Hakları ve İletişim</h3>
      <p style={{ marginBottom: '15px' }}>
        Bu oyunun tüm mimarisi, tasarımı, kod altyapısı ve hakları <strong style={{ color: '#00f5d4' }}>Ömer Koçoğlu</strong> adına tescilli olup tüm patent ve telif hakları saklıdır. İzinsiz kopyalanamaz veya çoğaltılamaz.
      </p>

      <div style={{ background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', padding: '15px 20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '30px' }}>
        <div>
          <span style={{ display: 'block', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Geliştirici & Hak Sahibi</span>
          <strong style={{ color: '#fff', fontSize: '1.05rem' }}>Ömer Koçoğlu</strong>
        </div>
        <div>
          <a 
            href="https://instagram.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              background: 'linear-gradient(135deg, #00f5d4, #00b4ff)', 
              color: '#0a0a12', 
              padding: '8px 16px', 
              borderRadius: '20px', 
              fontWeight: '700', 
              textDecoration: 'none', 
              fontSize: '0.85rem',
              boxShadow: '0 4px 15px rgba(0,245,212,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            Instagram'da Takip Et
          </a>
        </div>
      </div>

      {/* Hata Bildirimi ve Geri Bildirim Alanı */}
      <h3 style={{ color: '#00f5d4', fontSize: '1.1rem', marginBottom: '8px', marginTop: '20px' }}>🛠️ Hata Bildirimi & Geri Bildirim</h3>
      <p style={{ marginBottom: '15px', fontSize: '0.95rem' }}>
        Oyunda bir hata (bug) mı yakaladın, yeni bir özellik mi öneriyorsun yoksa sadece teşekkür etmek mi istiyorsun? Aşağıdaki formu kullanarak doğrudan geliştiriciye mesajını iletebilirsin!
      </p>

 <form 
  onSubmit={handleFeedbackSubmit}
  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
>
  <input 
    type="text" 
    placeholder="Oyuncu Adın (İsteğe bağlı)" 
    style={{ 
      background: 'rgba(0,0,0,0.3)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      padding: '12px 16px', 
      borderRadius: '12px', 
      color: '#fff',
      outline: 'none',
      fontSize: '0.9rem'
    }} 
  />
  <textarea 
    rows="4" 
    placeholder="Hata bildirimi, öneri veya teşekkür mesajını buraya yaz..." 
    required
    style={{ 
      background: 'rgba(0,0,0,0.3)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      padding: '12px 16px', 
      borderRadius: '12px', 
      color: '#fff',
      outline: 'none',
      fontSize: '0.9rem',
      resize: 'vertical'
    }} 
  />
  <button 
    type="submit"
    style={{ 
      background: 'linear-gradient(135deg, #00f5d4, #00b4ff)', 
      color: '#0a0a12', 
      padding: '12px', 
      borderRadius: '12px', 
      fontWeight: '700', 
      border: 'none', 
      cursor: 'pointer',
      fontSize: '0.95rem',
      boxShadow: '0 4px 15px rgba(0,245,212,0.2)'
    }}
  >
    🚀 Raporu / Mesajı Gönder
  </button>
</form>

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
        <div className="floating-brand onyxd">OnYx</div>
        <div className="floating-brand omerk">Ömer Koçoğlu</div>
        <div className="floating-brand onyxd-2">OnYx</div>
        <div className="floating-brand omerk-2">Ömer Koçoğlu</div>
      
      <div className="auth-panel">
        <div className="auth-title">BOX WARS</div>
        <div className="auth-sub">{isRegistering ? 'KAYIT OL' : 'GİRİŞ YAP'}</div>

        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          {isRegistering && (
            <>
              <input 
                className="auth-input" 
                type="text" 
                placeholder="Kullanıcı Adı" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
              <input 
                className="auth-input" 
                type="text" 
                placeholder="Ad Soyad" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                required 
              />
             <input 
                className="auth-input" 
                type="date" 
                min="1920-01-01"
                max={new Date().toISOString().split('T')[0]} // Bugünden ileri bir tarih seçilemez
                value={birthDate} 
                onChange={(e) => setBirthDate(e.target.value)} 
                required 
              />

              <input 
                className="auth-input" 
                type="text" 
                placeholder="Ülke / Şehir (Örn: Türkiye, İstanbul)" 
                value={location} 
                minLength={3} // En az 3 karakter girilmesini zorunlu kılar
                onChange={(e) => setLocation(e.target.value)} 
                required 
              />
            </>
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

          {!isRegistering && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '15px' }}>
              <span 
                onClick={handleForgotPassword} 
                style={{ color: '#00ffcc', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Şifremi Unuttum?
              </span>
            </div>
          )}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Yükleniyor...' : (isRegistering ? 'KAYIT OL' : 'GİRİŞ YAP')}
          </button>
        </form>

        <button className="toggle-button" onClick={() => { setIsRegistering(!isRegistering); }}>
          {isRegistering ? 'Zaten hesabın var mı? Giriş Yap' : 'Hesabın yok mu? Kayıt Ol'}
        </button>
      </div>
    </div>
  )
}

export default App