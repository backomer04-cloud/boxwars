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
    losses: profile?.losses || 0
  })

  const [enemyData, setEnemyData] = useState({
    name: 'Rakip',
    color: '#ff2e93',
    id: null
  })

  const [isHost, setIsHost] = useState(false)
  const [playerSide, setPlayerSide] = useState('left')
  const [currentRound, setCurrentRound] = useState(1)
  const [roundMessage, setRoundMessage] = useState('')
  const [scores, setScores] = useState({ player1: 0, player2: 0 }) // player1: Benim galibiyetim, player2: Rakibin galibiyeti
  const [gameOverData, setGameOverData] = useState(null)

  const [ammo, setAmmo] = useState(6)
  const maxAmmo = 6
  const [isReloading, setIsReloading] = useState(false)

  const socketRef = useRef(null)
  const gameStateRef = useRef({
    myPos: { x: 80, y: 250, hp: 200, maxHp: 200 },
    enemyPos: { x: 850, y: 250, hp: 200, maxHp: 200 },
    bullets: []
  })

  // --- TAM EKRAN (FULLSCREEN) ---
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

  // --- ODA VE SOCKET.IO BAĞLANTISI ---
  useEffect(() => {
    async function initRoomAndSocket() {
      if (!roomId || !userId) return

      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single()
      if (!roomData) return
      const hosting = roomData.host_id === userId
      setIsHost(hosting)
      const side = hosting ? 'left' : 'right'
      setPlayerSide(side)

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
            id: enemyProfile.id
          })
        }
      }

      const socket = io('https://boxwars-server.onrender.com')
      socketRef.current = socket

      socket.emit('join_room', roomId)

      socket.on('player_move', (payload) => {
        gameStateRef.current.enemyPos = { x: payload.x, y: payload.y, hp: payload.hp, maxHp: 200 }
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
        // Kesin senkronizasyon: Oyun bittiğinde her iki tarafta da sonuç ekranı direkt açılır
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

  // --- GARANTİ VERİTABANI VE PROFİL GÜNCELLEME İŞLEMCİSİ ---
  const applyPenaltiesAndDatabase = async (resultType) => {
    let currentXp = profile?.xp ?? userData.xp ?? 0
    let currentLevel = profile?.level ?? userData.level ?? 1
    let currentWins = profile?.wins ?? userData.wins ?? 0
    let currentLosses = profile?.losses ?? userData.losses ?? 0
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
    }

    const { error } = await supabase.from('profiles').update({
      xp: currentXp,
      level: currentLevel,
      wins: currentWins,
      losses: currentLosses
    }).eq('id', userId)

    if (error) {
      console.error('Veritabanı kayıt hatası:', error.message)
    }

    if (refreshProfile) {
      refreshProfile()
    }

    return { addedXp }
  }

  const reloadGun = () => {
    if (isReloading) return
    setIsReloading(true)
    setTimeout(() => {
      setAmmo(maxAmmo)
      setIsReloading(false)
    }, 1200)
  }

  // --- OYUN DÖNGÜSÜ ---
  useEffect(() => {
    if (gameOverData) return

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

    const handleKeyDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      keysPressed.current[e.code] = true
      if (e.code === 'Space') shoot()
      if (e.code === 'KeyR') reloadGun()
    }
    const handleKeyUp = (e) => { keysPressed.current[e.code] = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const shoot = () => {
      if (isReloading) return
      if (ammo <= 0) {
        reloadGun()
        return
      }

      const now = Date.now()
      if (now - lastShotTime.current < 250) return
      lastShotTime.current = now

      let currentAmmoLeft = 6
      setAmmo((prev) => {
        const next = Math.max(0, prev - 1)
        currentAmmoLeft = next
        return next
      })

      if (currentAmmoLeft === 0) {
        setTimeout(() => reloadGun(), 100)
      }

      const myP = gameStateRef.current.myPos
      const enP = gameStateRef.current.enemyPos

      const dx = enP.x - myP.x
      const dy = enP.y - myP.y

      let vx = 0
      let vy = 0
      let muzzleX = myP.x + 16
      let muzzleY = myP.y + 16
      const bulletSpeed = 12

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { muzzleX = myP.x + 32; muzzleY = myP.y + 16; vx = bulletSpeed; vy = 0 }
        else { muzzleX = myP.x; muzzleY = myP.y + 16; vx = -bulletSpeed; vy = 0 }
      } else {
        if (dy > 0) { muzzleX = myP.x + 16; muzzleY = myP.y + 32; vx = 0; vy = bulletSpeed }
        else { muzzleX = myP.x + 16; muzzleY = myP.y; vx = 0; vy = -bulletSpeed }
      }

      const newBullet = {
        id: `${userId}-${Date.now()}`,
        senderId: userId,
        x: muzzleX,
        y: muzzleY,
        vx: vx,
        vy: vy,
        size: 7,
        color: userData.color
      }

      gameStateRef.current.bullets.push(newBullet)

      if (socketRef.current) {
        socketRef.current.emit('player_shoot', { roomId, bullet: newBullet })
      }
    }

    window.mobileMove = (dir, active) => { keysPressed.current[dir] = active }
    window.mobileShoot = shoot
    window.mobileReload = reloadGun

    const checkRectCollision = (r1, r2) => {
      return r1.x < r2.x + r2.w && r1.x + 32 > r2.x && r1.y < r2.y + r2.h && r1.y + 32 > r2.y
    }

    let animationFrameId
    let isRoundOver = false
    let lastMoveSend = 0

    const updateGame = () => {
      if (isRoundOver) return

      let myP = gameStateRef.current.myPos
      let enP = gameStateRef.current.enemyPos
      let nextX = myP.x
      let nextY = myP.y

      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || keysPressed.current['UP']) nextY -= 4.5
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] || keysPressed.current['DOWN']) nextY += 4.5
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] || keysPressed.current['LEFT']) nextX -= 4.5
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] || keysPressed.current['RIGHT']) nextX += 4.5

      nextX = Math.max(0, Math.min(canvas.width - 32, nextX))
      nextY = Math.max(0, Math.min(canvas.height - 32, nextY))

      let canMoveX = true
      let canMoveY = true
      mapObstacles.forEach((obs) => {
        if (checkRectCollision({ x: nextX, y: myP.y }, obs)) canMoveX = false
        if (checkRectCollision({ x: myP.x, y: nextY }, obs)) canMoveY = false
      })

      if (canMoveX) myP.x = nextX
      if (canMoveY) myP.y = nextY

      const now = Date.now()
      if (now - lastMoveSend > 20 && socketRef.current) {
        lastMoveSend = now
        socketRef.current.emit('player_move', { roomId, x: myP.x, y: myP.y, hp: myP.hp })
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

            if (enP.hp <= 0 && !isRoundOver) {
              isRoundOver = true
              triggerRoundWin()
            }
            continue
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

      ctx.fillStyle = userData.color
      ctx.fillRect(myP.x, myP.y, 32, 32)
      drawEntityHeader(myP, userData.username, userData.color, 200)

      ctx.fillStyle = enemyData.color
      ctx.fillRect(enP.x, enP.y, 32, 32)
      drawEntityHeader(enP, enemyData.name, enemyData.color, 200)

      bullets.forEach((bullet) => {
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
      const updatedScores = { 
        ...scores, 
        player1: Math.min(2, scores.player1 + 1) 
      }
      setScores(updatedScores)

      if (socketRef.current) {
        socketRef.current.emit('round_won', { 
          roomId, 
          winnerId: userId, 
          scores: updatedScores 
        })
      }
      handleRoundTransition(updatedScores)
    }

    updateGame()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationFrameId)
    }
  }, [currentRound, gameOverData, userData.color, userData.username, playerSide, enemyData.color, enemyData.name, enemyData.id, userId, roomId, ammo, isReloading, scores])

  const handleRoundEndRemote = (winnerId, remoteScores) => {
    if (winnerId !== userId) {
      const updatedScores = {
        player1: remoteScores ? remoteScores.player2 : scores.player1,
        player2: remoteScores ? Math.min(2, remoteScores.player1) : Math.min(2, scores.player2 + 1)
      }
      setScores(updatedScores)
      handleRoundTransition(updatedScores)
    }
  }

  // --- KESİN 2 ROUNDLUK GEÇİŞ VE MAÇ SONU YÖNETİMİ ---
  const handleRoundTransition = async (currentScores) => {
    if (currentRound === 1) {
      setRoundMessage('1. Round Bitti! Taraf Değiştiriliyor...')
      setTimeout(() => {
        setRoundMessage('')
        setCurrentRound(2)
        setAmmo(maxAmmo)
        setIsReloading(false)

        const isCurrentlyLeft = playerSide === 'left'
        gameStateRef.current.myPos.x = isCurrentlyLeft ? 850 : 80
        gameStateRef.current.myPos.y = 250
        gameStateRef.current.myPos.hp = 200

        gameStateRef.current.enemyPos.x = isCurrentlyLeft ? 80 : 850
        gameStateRef.current.enemyPos.y = 250
        gameStateRef.current.enemyPos.hp = 200

        gameStateRef.current.bullets = []
      }, 2000)
    } else {
      // === 2. ROUND BİTTİ -> MAÇ SONU HER İKİ TARAFTA KESİN BİTİRİLİR ===
      let hostResultType = 'lose'
      if (currentScores.player1 > currentScores.player2) hostResultType = 'win'
      else if (currentScores.player1 === currentScores.player2) hostResultType = 'draw'

      const { addedXp } = await applyPenaltiesAndDatabase(hostResultType)

      const finalMyData = {
        resultType: hostResultType,
        addedXp,
        p1Score: currentScores.player1,
        p2Score: currentScores.player2,
        isQuit: false
      }
      setGameOverData(finalMyData)

      // Host, karşı tarafa oyunun bittiğini kesin olarak bildirir
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
    }
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

        <canvas ref={canvasRef} width={1000} height={550} className="game-canvas" />

        <div className="mobile-controls-overlay">
          <div className="dpad">
            <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('UP', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('UP', false) }}>▲</button>
            <div className="dpad-row">
              <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('LEFT', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('LEFT', false) }}>◀</button>
              <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('RIGHT', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('RIGHT', false) }}>▶</button>
            </div>
            <button onTouchStart={(e) => { e.preventDefault(); window.mobileMove('DOWN', true) }} onTouchEnd={(e) => { e.preventDefault(); window.mobileMove('DOWN', false) }}>▼</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            <button 
              onClick={() => window.mobileReload()} 
              style={{
                background: 'rgba(56, 189, 248, 0.2)',
                border: '2px solid #38bdf8',
                color: '#38bdf8',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                backdropFilter: 'blur(4px)',
                cursor: 'pointer'
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