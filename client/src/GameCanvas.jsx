import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { io } from 'socket.io-client'

export default function GameCanvas({ onBack, userId, roomId, profile, refreshProfile }) {
  const canvasRef = useRef(null)
  const keysPressed = useRef({})
  const lastShotTime = useRef(0)

  const [userData, setUserData] = useState({
    username: profile?.username || 'Oyuncu',
    color: profile?.color || '#00f5d4',
    level: profile?.level || 1,
    xp: profile?.xp || 0,
    wins: profile?.wins || 0,
    losses: profile?.losses || 0,
    voxel: profile?.voxel || 0,
    equippedSkin: profile?.equipped?.skin || profile?.skin || 'default',
    equippedBullet: profile?.equipped?.bullet || profile?.bullet || 'normal',
    equippedTrail: profile?.equipped?.trail || profile?.trail || 'none'
  })

  const [enemyData, setEnemyData] = useState({
    name: 'Rakip',
    color: '#ff2e93',
    id: null,
    equippedSkin: 'default',
    equippedBullet: 'normal',
    equippedTrail: 'none'
  })

  const [isHost, setIsHost] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [roundMessage, setRoundMessage] = useState('')
  const [scores, setScores] = useState({ player1: 0, player2: 0 })
  const [gameOverData, setGameOverData] = useState(null)

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

  // --- KULLANICI PROFİLİNİ TAZELE VE EQUIPPED BİLGİSİNİ ÇEK ---
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
          equippedSkin: data.equipped?.skin || data.skin || 'default',
          equippedBullet: data.equipped?.bullet || data.bullet || 'normal',
          equippedTrail: data.equipped?.trail || data.trail || 'none'
        })
      }
    }
    fetchLatestProfile()
  }, [userId])

  // --- TAM EKRAN ---
  useEffect(() => {
    const enterFullscreen = () => {
      const elem = document.documentElement;
      if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    };
    const exitFullscreen = () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
    enterFullscreen();
    return () => { exitFullscreen(); };
  }, []);

  // --- ODA VE SOCKET BAĞLANTISI ---
  useEffect(() => {
    async function initRoomAndSocket() {
      if (!roomId || !userId) return

      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single()
      if (!roomData) return
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
        if (enemyProfile) {
          setEnemyData({
            name: enemyProfile.username,
            color: enemyProfile.color || '#ff2e93',
            id: enemyProfile.id,
            equippedSkin: enemyProfile.equipped?.skin || enemyProfile.skin || 'default',
            equippedBullet: enemyProfile.equipped?.bullet || enemyProfile.bullet || 'normal',
            equippedTrail: enemyProfile.equipped?.trail || enemyProfile.trail || 'none'
          })
        }
      }

      const socket = io('https://boxwars-server.onrender.com', {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000
      })
      socketRef.current = socket

      socket.emit('join_room', roomId)

      socket.on('player_move', (payload) => {
        gameStateRef.current.enemyPos = { 
          ...gameStateRef.current.enemyPos,
          x: payload.x, 
          y: payload.y, 
          hp: payload.hp, 
          maxHp: 200
        }
        if (payload.skin || payload.trail) {
          setEnemyData(prev => ({
            ...prev,
            equippedSkin: payload.skin || prev.equippedSkin,
            equippedTrail: payload.trail || prev.equippedTrail
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
    }

    initRoomAndSocket()

    return () => {
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [roomId, userId])

  const handleEarlyLeave = async () => {
    if (!gameOverData) {
      if (socketRef.current) {
        socketRef.current.emit('player_quit', {})
      }
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
      addedXp = 100
      currentXp += 100
      currentWins += 1
    } else if (resultType === 'draw') {
      addedXp = 50
      currentXp += 50
    } else {
      addedXp = -50
      currentXp -= 50
      currentLosses += 1
      if (currentXp < 0 && currentLevel > 1) {
        currentLevel -= 1
        currentXp += 200
      }
      if (currentXp < 0) currentXp = 0
    }

    while (currentXp >= 200) {
      currentXp -= 200
      currentLevel += 1
      currentVoxel += 50
    }

    await supabase.from('profiles').update({
      xp: currentXp,
      level: currentLevel,
      wins: currentWins,
      losses: currentLosses,
      voxel: currentVoxel
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

  // --- OYUN DÖNGÜSÜ VE ÇİZİM ---
  useEffect(() => {
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
      
      if (ammoRef.current <= 0) { 
        reloadGun(); 
        return 
      }

      const now = Date.now()
      if (now - lastShotTime.current < 250) return
      lastShotTime.current = now

      ammoRef.current -= 1
      const currentAmmoLeft = ammoRef.current
      setAmmo(currentAmmoLeft)

      if (currentAmmoLeft <= 0) {
        setTimeout(() => reloadGun(), 100)
      }

      const myP = gameStateRef.current.myPos
      const enP = gameStateRef.current.enemyPos
      const dx = enP.x - myP.x
      const dy = enP.y - myP.y

      let vx = 0, vy = 0
      let muzzleX = myP.x + 16, muzzleY = myP.y + 16
      const bulletSpeed = 12

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { muzzleX = myP.x + 32; vx = bulletSpeed; }
        else { muzzleX = myP.x; vx = -bulletSpeed; }
      } else {
        if (dy > 0) { muzzleY = myP.y + 32; vy = bulletSpeed; }
        else { muzzleY = myP.y; vy = -bulletSpeed; }
      }

      const bulletType = userData.equippedBullet
      let bulletColor = userData.color
      let bulletSize = 7

      if (bulletType?.includes('heavy')) {
        bulletSize = 10
      } else if (bulletType?.includes('neon')) {
        bulletColor = '#ff00ff'
      } else if (bulletType?.includes('gold')) {
        bulletColor = '#facc15'
      }

      const newBullet = {
        id: `${userId}-${Date.now()}`,
        senderId: userId,
        x: muzzleX,
        y: muzzleY,
        vx, vy,
        size: bulletSize,
        color: bulletColor,
        type: bulletType
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

    // --- SKİN ÇİZİM SİSTEMİ (ÖZEL GÖRSELLER VE EFEKTLER) ---
    const drawCustomSkin = (x, y, skinType, baseColor) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(x, y, 32, 32)

      // Marketindeki skin isimlerine göre özel görünüm çizimleri
      if (skinType?.includes('neon_purple') || skinType?.includes('purple')) {
        ctx.fillStyle = '#c084fc'
        ctx.fillRect(x + 6, y + 6, 20, 20)
        ctx.strokeStyle = '#e879f9'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 4, y + 4, 24, 24)
      } else if (skinType?.includes('gold') || skinType?.includes('golden')) {
        ctx.fillStyle = '#facc15'
        ctx.fillRect(x + 8, y + 8, 16, 16)
        ctx.strokeStyle = '#fef08a'
        ctx.lineWidth = 3
        ctx.strokeRect(x + 2, y + 2, 28, 28)
      } else if (skinType?.includes('cyber') || skinType?.includes('robot')) {
        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(x + 4, y + 10, 24, 12)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x + 8, y + 13, 6, 6)
      } else if (skinType?.includes('cat') || skinType?.includes('neko')) {
        ctx.fillStyle = baseColor
        // Kulaklar
        ctx.beginPath()
        ctx.moveTo(x + 4, y)
        ctx.lineTo(x + 10, y - 8)
        ctx.lineTo(x + 14, y)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x + 18, y)
        ctx.lineTo(x + 22, y - 8)
        ctx.lineTo(x + 28, y)
        ctx.fill()
      } else {
        // Standart iç kutu detayı
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 4, y + 4, 24, 24)
      }
    }

    // --- TRAIL (İZ) ÇİZİM SİSTEMİ ---
    const drawTrail = (trailHistory, trailType) => {
      if (!trailType || trailType === 'none') return
      trailHistory.forEach((pos, idx) => {
        const alpha = (idx + 1) / trailHistory.length * 0.4
        if (trailType?.includes('fire')) {
          ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`
        } else if (trailType?.includes('rainbow')) {
          ctx.fillStyle = `hsla(${idx * 30}, 100%, 50%, ${alpha})`
        } else {
          ctx.fillStyle = `rgba(0, 245, 212, ${alpha})`
        }
        ctx.fillRect(pos.x + 8, pos.y + 8, 16, 16)
      })
    }

    const updateGame = () => {
      let myP = gameStateRef.current.myPos
      let enP = gameStateRef.current.enemyPos

      if (!gameStateRef.current.isPaused) {
        let nextX = myP.x
        let nextY = myP.y

        if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || keysPressed.current['UP']) nextY -= 4.5
        if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] || keysPressed.current['DOWN']) nextY += 4.5
        if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] || keysPressed.current['LEFT']) nextX -= 4.5
        if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] || keysPressed.current['RIGHT']) nextX += 4.5

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
        if (now - lastMoveSend > 20 && socketRef.current) {
          lastMoveSend = now
          socketRef.current.emit('player_move', { 
            roomId, 
            x: myP.x, 
            y: myP.y, 
            hp: myP.hp,
            skin: userData.equippedSkin,
            trail: userData.equippedTrail
          })
        }

        const bullets = gameStateRef.current.bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const bullet = bullets[i]
          let hitWall = false
          
          for (let step = 0; step < 2; step++) {
            bullet.x += bullet.vx / 2
            bullet.y += bullet.vy / 2

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

          if (hitWall) {
            bullets.splice(i, 1)
            continue
          }

          const isMyBullet = bullet.senderId === userId || !bullet.senderId
          if (isMyBullet) {
            const hitBoxMargin = 6
            if (
              bullet.x >= enP.x - hitBoxMargin && bullet.x <= enP.x + 32 + hitBoxMargin &&
              bullet.y >= enP.y - hitBoxMargin && bullet.y <= enP.y + 32 + hitBoxMargin
            ) {
              bullets.splice(i, 1)
              enP.hp = Math.max(0, enP.hp - 20)

              if (socketRef.current && enemyData.id) {
                socketRef.current.emit('player_hit', { roomId, targetId: enemyData.id })
              }

              if (enP.hp <= 0) {
                triggerRoundWin()
              }
              continue
            }
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
      }

      mapObstacles.forEach((obs) => {
        ctx.fillStyle = '#1e293b'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h)
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h)
      })

      // İzleri Çiz
      drawTrail(myP.trailHistory, userData.equippedTrail)
      if (enP.trailHistory) drawTrail(enP.trailHistory, enemyData.equippedTrail)

      // Oyuncuları ve Özel Skinlerini Çiz
      drawCustomSkin(myP.x, myP.y, userData.equippedSkin, userData.color)
      drawEntityHeader(myP, userData.username, userData.color, 200)

      drawCustomSkin(enP.x, enP.y, enemyData.equippedSkin, enemyData.color)
      drawEntityHeader(enP, enemyData.name, enemyData.color, 200)

      // Mermileri Çiz
      gameStateRef.current.bullets.forEach((bullet) => {
        ctx.fillStyle = bullet.color
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2)
        ctx.fill()
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
        const updatedScores = { 
          ...prevScores, 
          player1: Math.min(2, prevScores.player1 + 1) 
        }

        if (socketRef.current) {
          socketRef.current.emit('round_won', { 
            roomId, 
            winnerId: userId, 
            scores: updatedScores 
          })
        }
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
  }, [userData, enemyData, userId, roomId])

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
            resultType: hostResultType,
            addedXp,
            p1Score: currentScores.player1,
            p2Score: currentScores.player2,
            isQuit: false
          })

          if (isHost && socketRef.current) {
            let enemyResultType = 'lose'
            if (currentScores.player2 > currentScores.player1) enemyResultType = 'win'
            else if (currentScores.player1 === currentScores.player2) enemyResultType = 'draw'

            socketRef.current.emit('game_over_sync', {
              roomId,
              gameOverData: {
                resultType: enemyResultType,
                p1Score: currentScores.player2,
                p2Score: currentScores.player1
              },
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

  return (
    <>
      <div className="portrait-warning">Lütfen Telefonu Yan Çevirin 🔄</div>

      <div className="game-wrapper" style={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', overflow: 'hidden' }}>
        <button className="back-btn-overlay" onClick={handleEarlyLeave}>⬅ Lobiye Dön (Terket)</button>

        {/* AMMO HUD */}
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '25px',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '2px solid rgba(0, 245, 212, 0.5)',
          padding: '0.6rem 1.2rem',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          color: '#fff',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '0.8rem', color: isReloading ? '#e71d36' : '#38bdf8', marginBottom: '4px', letterSpacing: '1px' }}>
            {isReloading ? 'RELOADING...' : `AMMO: ${ammo} / ${maxAmmo}`}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: maxAmmo }).map((_, i) => (
              <div key={i} style={{
                width: '9px',
                height: '18px',
                backgroundColor: i < ammo ? '#00f5d4' : 'rgba(255,255,255,0.2)',
                borderRadius: '3px',
                boxShadow: i < ammo ? '0 0 10px rgba(0, 245, 212, 0.7)' : 'none'
              }} />
            ))}
          </div>
        </div>

        {roundMessage && <div className="round-banner">{roundMessage}</div>}

        {gameOverData && (
          <div className={`game-over-modal ${gameOverData.resultType === 'win' ? '' : (gameOverData.resultType === 'draw' ? 'draw' : 'defeat')}`}>
            <div className={`result-title ${gameOverData.resultType === 'win' ? 'win' : (gameOverData.resultType === 'draw' ? 'draw' : 'lose')}`}>
              {gameOverData.resultType === 'win' ? '🏆 ZAFER' : (gameOverData.resultType === 'draw' ? '🤝 BERABERE' : '💀 MAĞLUBİYET')}
            </div>
            
            <div className="result-subtitle">
              {gameOverData.isQuit 
                ? 'Oyundan erken ayrıldığın için mağlup sayıldın (-50 XP)!' 
                : (gameOverData.resultType === 'win' ? 'Rakibini mağlup ettin (+100 XP)!' : (gameOverData.resultType === 'draw' ? 'Kıyasıya mücadele, puanlar paylaşıldı (+50 XP)!' : 'Daha güçlü geri döneceksin (-50 XP)!'))}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Maç Skoru (2 Round)</span>
                <span className="stat-value">{gameOverData.p1Score} - {gameOverData.p2Score}</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">XP Değişimi</span>
                <span className="stat-value xp" style={{ color: gameOverData.addedXp > 0 ? '#2ec4b6' : '#e71d36' }}>
                  {gameOverData.addedXp > 0 ? `+${gameOverData.addedXp}` : gameOverData.addedXp}
                </span>
              </div>
            </div>

            <button className="btn-lobby" onClick={handleReturnToLobby}>
              🏠 BEKLEME ODASINA DÖN (RÖVANŞ)
            </button>
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          width={1000} 
          height={550} 
          className="game-canvas" 
          onMouseDown={() => {
            if (window.mobileShoot) window.mobileShoot();
          }}
        />

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
            <button 
              onClick={() => window.mobileReload()} 
              style={{
                position: 'absolute',
                top: '-5px',
                left: '-15px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '2px solid #38bdf8',
                color: '#38bdf8',
                padding: '0.4rem 0.8rem',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                backdropFilter: 'blur(4px)',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                zIndex: 10
              }}
            >
              🔄 Reload
            </button>
            <button className="shoot-btn" onTouchStart={(e) => { e.preventDefault(); window.mobileShoot() }}>Ateş</button>
          </div>
        </div>
      </div>
    </>
  )
}