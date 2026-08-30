import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { io } from 'socket.io-client'

export default function GameCanvas({ onBack, userId, roomId, profile, refreshProfile }) {
  const canvasRef = useRef(null)
  const keysPressed = useRef({})
  const lastShotTime = useRef(0)

  // 🌐 Sunucu Tam Hazır (Sync) State'i (Oyuncular haritaya düşmeden donma yaşamaması için)
  const [isServerReady, setIsServerReady] = useState(false)
  const [loadingText, setLoadingText] = useState('Oda ve sunucu senkronizasyonu bekleniyor...')

  const [userData, setUserData] = useState({
    username: profile?.username || 'Oyuncu',
    color: profile?.color || '#00f5d4',
    level: profile?.level || 1,
    xp: profile?.xp || 0,
    wins: profile?.wins || 0,
    losses: profile?.losses || 0,
    voxel: profile?.voxel || 0,
    equippedSkin: profile?.equipped?.skin || profile?.skin || 'skin_neon_purple',
    equippedBullet: profile?.equipped?.bullet || profile?.bullet || 'bullet_plasma_blue',
    equippedTrail: profile?.equipped?.trail || profile?.trail || 'trail_sparks'
  })

  const [enemyData, setEnemyData] = useState({
    name: 'Rakip',
    color: '#ff2e93',
    id: null,
    equippedSkin: 'skin_neon_purple',
    equippedBullet: 'bullet_plasma_blue',
    equippedTrail: 'trail_sparks'
  })

  const [isHost, setIsHost] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [roundMessage, setRoundMessage] = useState('')
  const [scores, setScores] = useState({ player1: 0, player2: 0 })
  const [gameOverData, setGameOverData] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  const showNotification = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const [ammo, setAmmo] = useState(6)
  const maxAmmo = 6
  const [isReloading, setIsReloading] = useState(false)

  const ammoRef = useRef(6)
  const isReloadingRef = useRef(false)
  const socketRef = useRef(null)
  
  const gameStateRef = useRef({
    mySide: 'left',
    myPos: { x: 80, y: 250, hp: 200, maxHp: 200, trailHistory: [] },
    enemyPos: { x: 850, y: 250, hp: 200, maxHp: 200, trailHistory: [] },
    bullets: [],
    isPaused: false
  })

  const shopSkinDetails = {
    'skin_neon_purple': { color: '#7209b7', icon: 'cube' },
    'skin_gold': { color: '#ffd700', icon: 'cube' },
    'skin_fire_red': { color: '#e71d36', icon: 'fire' },
    'skin_matrix_green': { color: '#00f5d4', icon: 'cube' },
    'skin_cyber_pink': { color: '#f72585', icon: 'cube' },
    'skin_shadow_black': { color: '#1e293b', icon: 'cube' },
    'skin_electric_blue': { color: '#3b82f6', icon: 'lightning' },
    'skin_toxic_slime': { color: '#84cc16', icon: 'cube' },
    'skin_sunset_orange': { color: '#f97316', icon: 'cube' },
    'skin_galaxy_violet': { color: '#8b5cf6', icon: 'cube' },
    'skin_cat_face': { color: '#fb923c', icon: 'cat' },
    'skin_dog_face': { color: '#d97706', icon: 'dog' },
    'skin_ghost_white': { color: '#e2e8f0', icon: 'ghost' },
    'skin_pirate_box': { color: '#78716c', icon: 'pirate' },
    'skin_robot_droid': { color: '#64748b', icon: 'robot' },
    'skin_camo_military': { color: '#4d7c0f', icon: 'cube' },
    'skin_ice_crystal': { color: '#06b6d4', icon: 'cube' },
    'skin_magma_core': { color: '#c2410c', icon: 'fire' },
    'skin_toxic_hazard': { color: '#ca8a04', icon: 'cube' },
    'skin_royal_crown': { color: '#eab308', icon: 'crown' }
  }

  useEffect(() => {
    async function fetchLatestProfile() {
      if (!userId) return
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) {
        setUserData({
          username: data.username || 'Oyuncu',
          color: data.color || '#00f5d4',
          level: data.level || 1,
          xp: data.xp || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          voxel: data.voxel || 0,
          equippedSkin: data.equipped?.skin || data.skin || 'skin_neon_purple',
          equippedBullet: data.equipped?.bullet || data.bullet || 'bullet_plasma_blue',
          equippedTrail: data.equipped?.trail || data.trail || 'trail_sparks'
        })
      }
    }
    fetchLatestProfile()
  }, [userId])

  useEffect(() => {
    const enterFullscreen = () => {
      const elem = document.documentElement;
      if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
    };
    enterFullscreen();
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true

    async function initRoomAndSocket() {
      if (!roomId || !userId) return

      try {
        setLoadingText('Supabase oda verileri doğrulanıyor...')
        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single()
        if (!roomData) {
          if (isMounted) {
            alert('Oda bulunamadı.')
            onBack()
          }
          return
        }

        const hosting = roomData.host_id === userId
        setIsHost(hosting)
        const side = hosting ? 'left' : 'right'
        
        gameStateRef.current.mySide = side
        gameStateRef.current.myPos.x = side === 'left' ? 80 : 850
        gameStateRef.current.enemyPos.x = side === 'left' ? 850 : 80

        const { data: invites } = await supabase.from('invites').select('*').eq('room_id', roomId).eq('status', 'accepted').single()
        const enemyId = hosting ? invites?.receiver_id : roomData.host_id
        
        if (enemyId) {
          const { data: enemyProfile } = await supabase.from('profiles').select('*').eq('id', enemyId).single()
          if (enemyProfile && isMounted) {
            setEnemyData({
              name: enemyProfile.username,
              color: enemyProfile.color || '#ff2e93',
              id: enemyProfile.id,
              equippedSkin: enemyProfile.equipped?.skin || enemyProfile.skin || 'skin_neon_purple',
              equippedBullet: enemyProfile.equipped?.bullet || enemyProfile.bullet || 'bullet_plasma_blue',
              equippedTrail: enemyProfile.equipped?.trail || enemyProfile.trail || 'trail_sparks'
            })
          }
        }

        setLoadingText('Render oyun sunucusuna bağlanılıyor ve senkronize ediliyor...')
        const socket = io('https://boxwars-server.onrender.com', {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          timeout: 10000,
          query: { userId, roomId }
        })
        socketRef.current = socket

        socket.emit('join_room', roomId)

        // 🌐 Sunucudan "ready" veya ilk akış sinyali gelene kadar veya soket oturtulana kadar beklet
        socket.on('connect', () => {
          console.log('Sunucuya socket bağlantısı kuruldu.')
        })

        // Sunucunun oyuncuyu onayladığı veya hazır olduğu sinyal (Desteği yoksa fallback timer devreye girer)
        socket.on('server_ready', () => {
          if (isMounted) {
            setIsServerReady(true)
          }
        })

        // Emniyet Kalkanı / Fallback: Sunucu özel hazır sinyali göndermese bile 1.5 saniye içinde haritayı tam hazır hale getirerek donmaları önler
        const safetyTimer = setTimeout(() => {
          if (isMounted && !isServerReady) {
            setIsServerReady(true)
          }
        }, 1500)

        socket.on('player_move', (payload) => {
          gameStateRef.current.enemyPos = { 
            ...gameStateRef.current.enemyPos,
            x: payload.x, 
            y: payload.y, 
            hp: payload.hp, 
            maxHp: 200
          }
          if (payload.skin || payload.trail || payload.bullet) {
            setEnemyData(prev => ({
              ...prev,
              equippedSkin: payload.skin || prev.equippedSkin,
              equippedTrail: payload.trail || prev.equippedTrail,
              equippedBullet: payload.bullet || prev.equippedBullet
            }))
          }
        })

        socket.on('player_shoot', (payload) => {
          gameStateRef.current.bullets.push(payload.bullet)
        })

        socket.on('player_hit', (payload) => {
          if (payload.targetId === userId) {
            gameStateRef.current.myPos.hp = Math.max(0, gameStateRef.current.myPos.hp - 20)
          }
        })

        socket.on('round_won', (payload) => {
          handleRoundEndRemote(payload.winnerId, payload.scores)
        })

        socket.on('game_over_sync', async (payload) => {
          setScores(payload.scores)
          const finalResultType = payload.gameOverData.resultType
          const { addedXp } = await applyPenaltiesAndDatabase(finalResultType)

          setGameOverData({
            resultType: finalResultType,
            addedXp,
            p1Score: payload.gameOverData.p1Score,
            p2Score: payload.gameOverData.p2Score,
            isQuit: false
          })
        })

        socket.on('player_quit', async () => {
          showNotification('Rakip oyundan ayrıldı!')
          if (!gameOverData) {
            const res = await applyPenaltiesAndDatabase('win')
            setGameOverData({
              resultType: 'win',
              addedXp: res.addedXp,
              p1Score: scores.player1,
              p2Score: scores.player2,
              isQuit: false
            })
          }
        })

        return () => clearTimeout(safetyTimer)
      } catch (err) {
        console.error('Bağlantı hatası:', err)
      }
    }

    initRoomAndSocket()

    return () => {
      isMounted = false
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [roomId, userId])

  const handleEarlyLeave = async () => {
    if (!gameOverData) {
      if (socketRef.current) socketRef.current.emit('player_quit', {})
      await applyPenaltiesAndDatabase('lose')
    }
    if (refreshProfile) refreshProfile()
    onBack()
  }

  const applyPenaltiesAndDatabase = async (resultType) => {
    let currentXp = profile?.xp ?? userData.xp ?? 0
    let currentLevel = profile?.level ?? userData.level ?? 1
    let currentWins = profile?.wins ?? userData.wins ?? 0
    let currentLosses = profile?.losses ?? userData.losses ?? 0
    let currentVoxel = profile?.voxel ?? userData.voxel ?? 0
    let addedXp = 0

    if (resultType === 'win') {
      addedXp = 100; currentXp += 100; currentWins += 1
    } else if (resultType === 'draw') {
      addedXp = 50; currentXp += 50
    } else {
      addedXp = -50; currentXp -= 50; currentLosses += 1
      if (currentXp < 0 && currentLevel > 1) { currentLevel -= 1; currentXp += 200 }
      if (currentXp < 0) currentXp = 0
    }

    while (currentXp >= 200) { currentXp -= 200; currentLevel += 1; currentVoxel += 50 }

    await supabase.from('profiles').update({
      xp: currentXp, level: currentLevel, wins: currentWins, losses: currentLosses, voxel: currentVoxel
    }).eq('id', userId)

    if (refreshProfile) refreshProfile()
    return { addedXp }
  }

  const reloadGun = () => {
    if (isReloadingRef.current || gameStateRef.current.isPaused) return
    isReloadingRef.current = true
    setIsReloading(true)
    
    setTimeout(() => {
      ammoRef.current = maxAmmo
      setAmmo(maxAmmo)
      isReloadingRef.current = false
      setIsReloading(false)
    }, 1200)
  }

  useEffect(() => {
    if (!isServerReady) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const mapObstacles = [
      { x: 280, y: 0, w: 20, h: 180 },
      { x: 280, y: 370, w: 20, h: 180 },
      { x: 700, y: 0, w: 20, h: 180 },
      { x: 700, y: 370, w: 20, h: 180 },
      { x: 490, y: 220, w: 20, h: 110 }
    ]

    const shoot = () => {
      if (gameStateRef.current.isPaused || isReloadingRef.current) return
      if (ammoRef.current <= 0) { reloadGun(); return }

      const now = Date.now()
      if (now - lastShotTime.current - 50 < 0) return 
      lastShotTime.current = now

      ammoRef.current -= 1
      setAmmo(ammoRef.current)

      if (ammoRef.current <= 0) setTimeout(() => reloadGun(), 100)

      const myP = gameStateRef.current.myPos
      const enP = gameStateRef.current.enemyPos
      const dx = enP.x - myP.x
      const dy = enP.y - myP.y

      let vx = 0, vy = 0
      let muzzleX = myP.x + 16, muzzleY = myP.y + 16
      const bulletSpeed = 4.5

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { muzzleX = myP.x + 32; vx = bulletSpeed; }
        else { muzzleX = myP.x; vx = -bulletSpeed; }
      } else {
        if (dy > 0) { muzzleY = myP.y + 32; vy = bulletSpeed; }
        else { muzzleY = myP.y; vy = -bulletSpeed; }
      }

      const bulletType = userData.equippedBullet
      let bulletColor = '#38bdf8'

      const bulletColorMap = {
        'bullet_plasma_blue': '#38bdf8',
        'bullet_laser_red': '#ff4d4d',
        'bullet_toxic_green': '#10b981',
        'bullet_gold_spark': '#facc15',
        'bullet_neon_cyan': '#22d3ee',
        'bullet_hot_pink': '#ec4899',
        'bullet_sun_yellow': '#eab308',
        'bullet_pure_white': '#f8fafc',
        'bullet_ruby_red': '#991b1b',
        'bullet_emerald_ray': '#065f46',
        'bullet_amethyst_bolt': '#581c87',
        'bullet_copper_shot': '#9a3412',
        'bullet_silver_flash': '#94a3b8',
        'bullet_orange_flare': '#c2410c',
        'bullet_lime_zap': '#65a30d',
        'bullet_indigo_beam': '#3730a3',
        'bullet_rose_quartz': '#fda4af',
        'bullet_neon_teal': '#0d9488',
        'bullet_carbon_dark': '#0f172a',
        'bullet_rainbow_prism': '#db2777'
      }

      if (bulletColorMap[bulletType]) {
        bulletColor = bulletColorMap[bulletType]
      }

      const newBullet = {
        id: `${userId}-${Date.now()}`,
        senderId: userId,
        x: muzzleX,
        y: muzzleY,
        vx, vy,
        size: 6,
        color: bulletColor,
        type: bulletType,
        trailType: userData.equippedTrail,
        trail: []
      }

      gameStateRef.current.bullets.push(newBullet)
      if (socketRef.current) {
        socketRef.current.emit('player_shoot', { roomId, bullet: newBullet })
      }
    }

    const handleKeyDown = (e) => {
      if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      keysPressed.current[e.code] = true
      if (e.code === 'Space' || e.code === 'Enter') shoot()
      if (e.code === 'KeyR') reloadGun()
    }
    const handleKeyUp = (e) => { keysPressed.current[e.code] = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    window.mobileMove = (dir, active) => { keysPressed.current[dir] = active }
    window.mobileShoot = shoot
    window.mobileReload = reloadGun

    const checkRectCollision = (r1, r2) => {
      return r1.x < r2.x + r2.w && r1.x + 32 > r2.x && r1.y < r2.y + r2.h && r1.y + 32 > r2.y
    }

    let animationFrameId
    let lastMoveSend = 0

    const drawCustomSkin = (x, y, skinType, baseColor) => {
      if (!skinType || skinType === 'none') {
        ctx.fillStyle = baseColor || '#00f5d4'
        ctx.fillRect(x, y, 32, 32)
        return
      }

      const skinData = shopSkinDetails[skinType] || { color: baseColor || '#00f5d4', icon: 'cube' }
      const fillColor = skinData.color
      const iconType = skinData.icon

      ctx.save()
      ctx.shadowBlur = 12
      ctx.shadowColor = fillColor

      ctx.fillStyle = fillColor
      ctx.fillRect(x, y, 32, 32)

      if (iconType === 'cat') {
        ctx.fillStyle = fillColor
        ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + 9, y - 8); ctx.lineTo(x + 14, y); ctx.fill()
        ctx.beginPath(); ctx.moveTo(x + 18, y); ctx.lineTo(x + 23, y - 8); ctx.lineTo(x + 28, y); ctx.fill()
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(x + 8, y + 10, 4, 5)
        ctx.fillRect(x + 20, y + 10, 4, 5)
        ctx.fillRect(x + 14, y + 18, 4, 3)
      } else if (iconType === 'dog') {
        ctx.fillStyle = '#b45309'
        ctx.fillRect(x - 3, y + 4, 6, 14)
        ctx.fillRect(x + 29, y + 4, 6, 14)
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(x + 8, y + 12, 4, 5)
        ctx.fillRect(x + 20, y + 12, 4, 5)
      } else if (iconType === 'ghost') {
        ctx.fillStyle = '#0f172a'
        ctx.beginPath(); ctx.arc(x + 10, y + 12, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + 22, y + 12, 4, 0, Math.PI * 2); ctx.fill()
      } else if (iconType === 'pirate') {
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(x, y + 6, 32, 8)
        ctx.fillStyle = '#facc15'
        ctx.fillRect(x + 12, y + 6, 8, 4)
        ctx.fillStyle = '#000000'
        ctx.beginPath(); ctx.arc(x + 22, y + 18, 5, 0, Math.PI * 2); ctx.fill()
      } else if (iconType === 'crown' || skinType === 'skin_royal_crown') {
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.moveTo(x + 6, y + 8)
        ctx.lineTo(x + 9, y - 4)
        ctx.lineTo(x + 16, y + 4)
        ctx.lineTo(x + 23, y - 4)
        ctx.lineTo(x + 26, y + 8)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(x + 14, y + 2, 4, 4)
      } else if (iconType === 'fire' || skinType === 'skin_fire_red') {
        ctx.fillStyle = '#f97316'
        ctx.beginPath()
        ctx.moveTo(x + 8, y)
        ctx.lineTo(x + 16, y - 10)
        ctx.lineTo(x + 24, y)
        ctx.closePath()
        ctx.fill()
      } else if (iconType === 'robot') {
        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(x + 6, y + 10, 20, 6)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x + 14, y - 4, 4, 4)
      }

      ctx.restore()
    }

    const drawTrail = (trailHistory, trailType) => {
      if (!trailType || trailType === 'none') return
      trailHistory.forEach((pos, idx) => {
        const alpha = (idx + 1) / trailHistory.length * 0.45
        let trailColor = `rgba(0, 245, 212, ${alpha})`

        if (trailType.includes('fire') || trailType.includes('meteor')) {
          trailColor = `rgba(234, 88, 12, ${alpha})`
        } else if (trailType.includes('lightning') || trailType.includes('electric')) {
          trailColor = `rgba(56, 189, 248, ${alpha})`
        } else if (trailType.includes('matrix')) {
          trailColor = `rgba(34, 197, 94, ${alpha})`
        } else if (trailType.includes('gold')) {
          trailColor = `rgba(234, 179, 8, ${alpha})`
        } else if (trailType.includes('star') || trailType.includes('galaxy')) {
          trailColor = `rgba(168, 85, 247, ${alpha})`
        } else if (trailType.includes('heart') || trailType.includes('pink')) {
          trailColor = `rgba(244, 63, 94, ${alpha})`
        }

        ctx.fillStyle = trailColor
        ctx.fillRect(pos.x + 8, pos.y + 8, 16, 16)
      })
    }

    const drawBulletTrail = (bullet) => {
      const trailType = bullet.trailType
      if (!trailType || trailType === 'none' || !bullet.trail) return

      bullet.trail.forEach((tPos, tIdx) => {
        const tAlpha = (tIdx + 1) / bullet.trail.length * 0.65
        let color = bullet.color

        if (trailType.includes('fire') || trailType.includes('meteor') || trailType.includes('magma')) {
          color = `rgba(249, 115, 22, ${tAlpha})`
        } else if (trailType.includes('lightning') || trailType.includes('electric') || trailType.includes('plasma')) {
          color = `rgba(56, 189, 248, ${tAlpha})`
        } else if (trailType.includes('gold') || trailType.includes('sun')) {
          color = `rgba(234, 179, 8, ${tAlpha})`
        } else if (trailType.includes('pink') || trailType.includes('heart') || trailType.includes('rose')) {
          color = `rgba(244, 63, 94, ${tAlpha})`
        } else if (trailType.includes('matrix') || trailType.includes('toxic')) {
          color = `rgba(34, 197, 94, ${tAlpha})`
        } else if (trailType.includes('star') || trailType.includes('galaxy') || trailType.includes('amethyst')) {
          color = `rgba(168, 85, 247, ${tAlpha})`
        } else if (trailType.includes('laser') || trailType.includes('ruby')) {
          color = `rgba(239, 68, 68, ${tAlpha})`
        }

        ctx.save()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(tPos.x, tPos.y, bullet.size * 0.75, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    }

    const updateGame = () => {
      let myP = gameStateRef.current.myPos
      let enP = gameStateRef.current.enemyPos

      if (!gameStateRef.current.isPaused) {
        let nextX = myP.x, nextY = myP.y
        const speed = 2.5
        if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || keysPressed.current['UP']) nextY -= speed
        if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] || keysPressed.current['DOWN']) nextY += speed
        if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] || keysPressed.current['LEFT']) nextX -= speed
        if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] || keysPressed.current['RIGHT']) nextX += speed

        nextX = Math.max(0, Math.min(canvas.width - 32, nextX))
        nextY = Math.max(0, Math.min(canvas.height - 32, nextY))

        let canMoveX = true, canMoveY = true
        mapObstacles.forEach((obs) => {
          if (checkRectCollision({ x: nextX, y: myP.y }, obs)) canMoveX = false
          if (checkRectCollision({ x: myP.x, y: nextY }, obs)) canMoveY = false
        })

        if (canMoveX) myP.x = nextX
        if (canMoveY) myP.y = nextY

        if (canMoveX || canMoveY) {
          if (!myP.trailHistory) myP.trailHistory = []
          myP.trailHistory.push({ x: myP.x, y: myP.y })
          if (myP.trailHistory.length > 8) myP.trailHistory.shift()
        }

        const now = Date.now()
        if (now - lastMoveSend > 30 && socketRef.current) {
          lastMoveSend = now
          socketRef.current.emit('player_move', { 
            roomId, x: myP.x, y: myP.y, hp: myP.hp,
            skin: userData.equippedSkin,
            trail: userData.equippedTrail,
            bullet: userData.equippedBullet
          })
        }

        const bullets = gameStateRef.current.bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const bullet = bullets[i]
          let hitWall = false
          
          for (let step = 0; step < 2; step++) {
            bullet.x += bullet.vx / 2
            bullet.y += bullet.vy / 2

            if (!bullet.trail) bullet.trail = []
            bullet.trail.push({ x: bullet.x, y: bullet.y })
            if (bullet.trail.length > 7) bullet.trail.shift()

            if (bullet.x > canvas.width || bullet.x < 0 || bullet.y > canvas.height || bullet.y < 0) {
              hitWall = true; break
            }
            for (const obs of mapObstacles) {
              if (bullet.x > obs.x && bullet.x < obs.x + obs.w && bullet.y > obs.y && bullet.y < obs.y + obs.h) {
                hitWall = true; break
              }
            }
            if (hitWall) break
          }

          if (hitWall) { bullets.splice(i, 1); continue }

          const isMyBullet = bullet.senderId === userId || !bullet.senderId
          if (isMyBullet) {
            if (
              bullet.x >= enP.x - 6 && bullet.x <= enP.x + 38 &&
              bullet.y >= enP.y - 6 && bullet.y <= enP.y + 38
            ) {
              bullets.splice(i, 1)
              enP.hp = Math.max(0, enP.hp - 20)

              if (socketRef.current && enemyData.id) {
                socketRef.current.emit('player_hit', { roomId, targetId: enemyData.id })
              }

              if (enP.hp <= 0) triggerRoundWin()
              continue
            }
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
      for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() }
      for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() }

      mapObstacles.forEach((obs) => {
        ctx.fillStyle = '#1e293b'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h)
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h)
      })

      drawTrail(myP.trailHistory, userData.equippedTrail)
      if (enP.trailHistory) drawTrail(enP.trailHistory, enemyData.equippedTrail)

      drawCustomSkin(myP.x, myP.y, userData.equippedSkin, userData.color)
      drawEntityHeader(myP, userData.username, userData.color, 200)

      drawCustomSkin(enP.x, enP.y, enemyData.equippedSkin, enemyData.color)
      drawEntityHeader(enP, enemyData.name, enemyData.color, 200)

      gameStateRef.current.bullets.forEach((bullet) => {
        drawBulletTrail(bullet)
        ctx.save()
        ctx.shadowBlur = 10
        ctx.shadowColor = bullet.color
        ctx.fillStyle = bullet.color
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      animationFrameId = requestAnimationFrame(updateGame)
    }

    const drawEntityHeader = (entity, name, color, maxHp) => {
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(name, entity.x + 16, entity.y - 18)

      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(entity.x - 8, entity.y - 12, 48, 6)

      const hpWidth = Math.max(0, (entity.hp / maxHp) * 48)
      ctx.fillStyle = color
      ctx.fillRect(entity.x - 8, entity.y - 12, hpWidth, 6)
    }

    const triggerRoundWin = () => {
      if (gameStateRef.current.isPaused) return
      gameStateRef.current.isPaused = true

      gameStateRef.current.enemyPos.hp = 200
      gameStateRef.current.myPos.hp = 200

      setScores((prevScores) => {
        const updatedScores = { ...prevScores, player1: Math.min(2, prevScores.player1 + 1) }
        if (socketRef.current) socketRef.current.emit('round_won', { roomId, winnerId: userId, scores: updatedScores })
        handleRoundTransition(updatedScores)
        return updatedScores
      })
    }

    updateGame()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isServerReady, userData, enemyData, userId, roomId])

  const handleRoundEndRemote = (winnerId, remoteScores) => {
    if (winnerId !== userId) {
      gameStateRef.current.isPaused = true
      setScores((prevScores) => {
        const updatedScores = {
          player1: remoteScores ? remoteScores.player2 : prevScores.player1,
          player2: remoteScores ? Math.min(2, remoteScores.player1) : Math.min(2, prevScores.player2 + 1)
        }
        handleRoundTransition(updatedScores)
        return updatedScores
      })
    }
  }

  const handleRoundTransition = async (currentScores) => {
    setCurrentRound((prevRound) => {
      if (prevRound === 1) {
        setRoundMessage('1. Round Bitti! Taraf Değiştiriliyor...')
        setTimeout(() => {
          setRoundMessage('')
          setCurrentRound(2)
          ammoRef.current = maxAmmo
          setAmmo(maxAmmo)
          isReloadingRef.current = false
          setIsReloading(false)

          const currentSide = gameStateRef.current.mySide
          const nextSide = currentSide === 'left' ? 'right' : 'left'
          gameStateRef.current.mySide = nextSide

          const isNowLeft = nextSide === 'left'
          gameStateRef.current.myPos.x = isNowLeft ? 80 : 850
          gameStateRef.current.myPos.y = 250
          gameStateRef.current.myPos.hp = 200

          gameStateRef.current.enemyPos.x = isNowLeft ? 850 : 80
          gameStateRef.current.enemyPos.y = 250
          gameStateRef.current.enemyPos.hp = 200

          gameStateRef.current.bullets = []
          gameStateRef.current.isPaused = false
        }, 2000)
        return 1
      } else {
        (async () => {
          let hostResultType = 'lose'
          if (currentScores.player1 > currentScores.player2) hostResultType = 'win'
          else if (currentScores.player1 === currentScores.player2) hostResultType = 'draw'

          const { addedXp } = await applyPenaltiesAndDatabase(hostResultType)

          setGameOverData({
            resultType: hostResultType, addedXp,
            p1Score: currentScores.player1, p2Score: currentScores.player2, isQuit: false
          })

          if (isHost && socketRef.current) {
            let enemyResultType = 'lose'
            if (currentScores.player2 > currentScores.player1) enemyResultType = 'win'
            else if (currentScores.player1 === currentScores.player2) enemyResultType = 'draw'

            socketRef.current.emit('game_over_sync', {
              roomId,
              gameOverData: { resultType: enemyResultType, p1Score: currentScores.player2, p2Score: currentScores.player1 },
              scores: { player1: currentScores.player2, player2: currentScores.player1 }
            })
          }
        })();
        return prevRound
      }
    })
  }

  const handleReturnToLobby = () => {
    if (refreshProfile) refreshProfile()
    onBack()
  }

  // ⏳ SUNUCU TAM HAZIR OLANA KADAR GÖSTERİLECEK PROFESYONEL BAĞLANTI EKRANI
  if (!isServerReady) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#090d16',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        color: '#fff', gap: '20px', zIndex: 999999, position: 'fixed', top: 0, left: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <style>
          {`
            @keyframes spinPulse {
              0% { transform: rotate(0deg) scale(1); box-shadow: 0 0 10px rgba(0,245,212,0.2); }
              50% { transform: rotate(180deg) scale(1.1); box-shadow: 0 0 25px rgba(0,245,212,0.6); }
              100% { transform: rotate(360deg) scale(1); box-shadow: 0 0 10px rgba(0,245,212,0.2); }
            }
          `}
        </style>
        <div style={{
          width: '70px', height: '70px', border: '6px solid rgba(0, 245, 212, 0.15)',
          borderTop: '6px solid #00f5d4', borderRadius: '50%',
          animation: 'spinPulse 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
        }} />
        <div style={{ fontSize: '1.9rem', fontWeight: '800', color: '#00f5d4', letterSpacing: '1px', textShadow: '0 0 20px rgba(0,245,212,0.4)' }}>
          SAVAŞ ALANINA BAĞLANILINIR...
        </div>
        <div style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '450px', textAlign: 'center', lineHeight: '1.5' }}>
          {loadingText}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="portrait-warning">Lütfen Telefonu Yan Çevirin 🔄</div>

      <div className="game-wrapper" style={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', overflow: 'hidden' }}>
        
        {toastMessage && <div className="game-toast-notification">{toastMessage}</div>}

        <button className="back-btn-overlay" onClick={handleEarlyLeave}>⬅ Lobiye Dön (Terket)</button>

        {/* AMMO HUD */}
        <div style={{
          position: 'fixed', top: '20px', right: '25px', background: 'rgba(15, 23, 42, 0.9)',
          border: '2px solid rgba(0, 245, 212, 0.5)', padding: '0.6rem 1.2rem', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', backdropFilter: 'blur(8px)', zIndex: 99999, color: '#fff', fontWeight: 'bold'
        }}>
          <div style={{ fontSize: '0.8rem', color: isReloading ? '#e71d36' : '#38bdf8', marginBottom: '4px' }}>
            {isReloading ? 'RELOADING...' : `AMMO: ${ammo} / ${maxAmmo}`}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: maxAmmo }).map((_, i) => (
              <div key={i} style={{
                width: '9px', height: '18px',
                backgroundColor: i < ammo ? '#00f5d4' : 'rgba(255,255,255,0.2)',
                borderRadius: '3px'
              }} />
            ))}
          </div>
        </div>

        {roundMessage && <div className="round-banner">{roundMessage}</div>}

        {canvasRef && <canvas ref={canvasRef} width={1000} height={550} className="game-canvas" />}

        {/* KAZANMA / MAĞLUBİYET EKRANI (Doğrudan Üstte ve Görünür) */}
        {gameOverData && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            zIndex: 999999, color: '#fff', animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{
              fontSize: '3.5rem', fontWeight: '900', letterSpacing: '2px', marginBottom: '1.5rem',
              color: gameOverData.resultType === 'win' ? '#00f5d4' : '#ef4444',
              textShadow: gameOverData.resultType === 'win' ? '0 0 25px rgba(0,245,212,0.6)' : '0 0 25px rgba(239,68,68,0.6)'
            }}>
              {gameOverData.resultType === 'win' ? '🏆 ZAFER' : '💀 MAĞLUBİYET'}
            </div>

            <div style={{
              background: 'rgba(30, 41, 59, 0.8)', border: '2px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem 3rem', borderRadius: '16px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '10px', marginBottom: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <span style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Final Skoru</span>
              <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f8fafc' }}>
                {gameOverData.p1Score} - {gameOverData.p2Score}
              </span>
              <span style={{ fontSize: '0.9rem', color: gameOverData.addedXp >= 0 ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {gameOverData.addedXp >= 0 ? `+${gameOverData.addedXp} XP` : `${gameOverData.addedXp} XP`}
              </span>
            </div>

            <button onClick={handleReturnToLobby} style={{
              background: 'linear-gradient(135deg, #00f5d4, #38bdf8)', color: '#0f172a',
              border: 'none', padding: '1rem 2.5rem', borderRadius: '12px', fontSize: '1.1rem',
              fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,245,212,0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              🏠 LOBİYE DÖN
            </button>
          </div>
        )}

        <div className="mobile-controls-overlay">
          <div className="dpad">
            <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('UP', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('UP', false) }}>▲</button>
            <div className="dpad-row">
              <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('LEFT', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('LEFT', false) }}>◀</button>
              <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('RIGHT', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('RIGHT', false) }}>▶</button>
            </div>
            <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('DOWN', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('DOWN', false) }}>▼</button>
          </div>

          <div style={{ display: 'flex', position: 'relative', width: '160px', height: '160px', justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={() => window.mobileReload()} style={{
              position: 'absolute', top: '-5px', left: '-15px', background: 'rgba(15, 23, 42, 0.85)',
              border: '2px solid #38bdf8', color: '#38bdf8', padding: '0.4rem 0.8rem', borderRadius: '10px', fontWeight: 'bold', zIndex: 10
            }}>🔄 Reload</button>
            <button className="shoot-btn" onTouchStart={(e) => { e.preventDefault(); window.mobileShoot() }}>Ateş</button>
          </div>
        </div>
      </div>
    </>
  )
}
[cite: 2]