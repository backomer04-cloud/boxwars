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
  const [scores, setScores] = useState({ player1: 0, player2: 0 })
  const [gameOverData, setGameOverData] = useState(null)

  const socketRef = useRef(null)
  const gameStateRef = useRef({
    myPos: { x: 80, y: 250, hp: 200, maxHp: 200 },
    enemyPos: { x: 850, y: 250, hp: 200, maxHp: 200 },
    bullets: []
  })

  // --- TAM EKRAN (FULLSCREEN) ENTEGRASYONU ---
  useEffect(() => {
    const enterFullscreen = () => {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    };

    const exitFullscreen = () => {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    };

    enterFullscreen();

    return () => {
      exitFullscreen();
    };
  }, []);

  // --- ODA VE SOCKET.IO BAĞLANTISI ---
  useEffect(() => {
    async function initRoomAndSocket() {
      if (!roomId || !userId) return

      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single()
      if (!roomData) return
      const hosting = roomData.host_id === userId
      setIsHost(hosting)
      setPlayerSide(hosting ? 'left' : 'right')

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

      // HAKEM SİSTEMİ: Host kararı netleştirir, burası ortak senkronize olur
      socket.on('game_over_sync', (payload) => {
        setGameOverData(payload.gameOverData)
        setScores(payload.scores)
        applyPenaltiesAndDatabase(payload.gameOverData.resultType)
      })

      socket.on('player_quit', () => {
        handleEarlyLeaveRemote()
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
      await applyPenaltiesAndDatabase('lose', true)
    }
    onBack()
  }

  const handleEarlyLeaveRemote = async () => {
    if (!gameOverData) {
      await applyPenaltiesAndDatabase('win', false)
      setGameOverData({
        resultType: 'win',
        addedXp: 100,
        p1Score: scores.player1,
        p2Score: scores.player2,
        isQuit: false
      })
    }
  }

  // --- XP VE SKOR HESAPLAMASI ---
  const applyPenaltiesAndDatabase = async (resultType) => {
    let newXp = userData.xp || 0
    let newLevel = userData.level || 1
    let newWins = userData.wins || 0
    let newLosses = userData.losses || 0
    let addedXp = 0

    if (resultType === 'win') {
      addedXp = 100
      newXp += 100
      newWins += 1
    } else if (resultType === 'draw') {
      addedXp = 50
      newXp += 50
    } else {
      addedXp = -50
      newXp -= 50
      newLosses += 1
      if (newXp < 0 && newLevel > 1) {
        newLevel -= 1
        newXp += 200
      }
      if (newXp < 0) newXp = 0
    }

    while (newXp >= 200) {
      newXp -= 200
      newLevel += 1
    }

    await supabase.from('profiles').update({ xp: newXp, level: newLevel, wins: newWins, losses: newLosses }).eq('id', userId)
    refreshProfile()

    return { addedXp }
  }

  useEffect(() => {
    if (gameOverData) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const isRound2 = currentRound === 2
    gameStateRef.current.myPos.x = playerSide === 'left' ? (isRound2 ? 850 : 80) : (isRound2 ? 80 : 850)
    gameStateRef.current.myPos.y = 250
    gameStateRef.current.myPos.hp = 200

    gameStateRef.current.enemyPos.x = playerSide === 'left' ? (isRound2 ? 80 : 850) : (isRound2 ? 850 : 80)
    gameStateRef.current.enemyPos.y = 250
    gameStateRef.current.enemyPos.hp = 200

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
    }
    const handleKeyUp = (e) => { keysPressed.current[e.code] = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // --- GÜÇLENDİRİLMİŞ MERMİ SPAM KORUMASI (SUNUCU YÜKÜNÜ AZALTIR) ---
    const shoot = () => {
      const now = Date.now()
      if (now - lastShotTime.current < 280) return // Saniyede en fazla ~3.5 mermi sınırı

      const myBulletsCount = gameStateRef.current.bullets.filter(b => b.senderId === userId).length
      if (myBulletsCount >= 4) return // Ekranda aynı anda max 4 aktif mermi

      lastShotTime.current = now

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
        if (dx > 0) {
          muzzleX = myP.x + 32; muzzleY = myP.y + 16; vx = bulletSpeed; vy = 0
        } else {
          muzzleX = myP.x; muzzleY = myP.y + 16; vx = -bulletSpeed; vy = 0
        }
      } else {
        if (dy > 0) {
          muzzleX = myP.x + 16; muzzleY = myP.y + 32; vx = 0; vy = bulletSpeed
        } else {
          muzzleX = myP.x + 16; muzzleY = myP.y; vx = 0; vy = -bulletSpeed
        }
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
      const newScores = { ...scores, player1: scores.player1 + 1 }
      const updatedScores = { player1: newScores.player1, player2: newScores.player2 }
      setScores(updatedScores)

      if (socketRef.current) {
        socketRef.current.emit('round_won', { roomId, winnerId: userId, scores: updatedScores })
      }
      handleRoundTransition(updatedScores)
    }

    updateGame()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationFrameId)
    }
  }, [currentRound, gameOverData, userData.color, userData.username, playerSide, enemyData.color, enemyData.name, enemyData.id, userId, roomId])

  const handleRoundEndRemote = (winnerId, remoteScores) => {
    if (winnerId !== userId) {
      const newScores = { ...scores, player2: scores.player2 + 1 }
      const updatedScores = remoteScores || newScores
      setScores(updatedScores)
      handleRoundTransition(updatedScores)
    }
  }

  // HAKEM SİSTEMİ MERKEZİ: Sadece Host (Hakem) tüm maç sonuçlarını hesaplayıp kararı kilitler ve senkronize eder
  const handleRoundTransition = async (currentScores) => {
    if (currentRound === 1) {
      setRoundMessage('1. Round Bitti! Taraf Değiştiriliyor...')
      setTimeout(() => {
        setRoundMessage('')
        setCurrentRound(2)
      }, 2000)
    } else {
      // 2. Round bittiğinde Hakem (Host) tüm sonuçları kesinleştirir
      let hostResultType = 'lose'
      if (currentScores.player1 > currentScores.player2) hostResultType = 'win'
      else if (currentScores.player1 === currentScores.player2) hostResultType = 'draw'

      const { addedXp } = await applyPenaltiesAndDatabase(hostResultType)

      const hostFinalData = {
        resultType: hostResultType,
        addedXp,
        p1Score: currentScores.player1,
        p2Score: currentScores.player2,
        isQuit: false
      }
      setGameOverData(hostFinalData)

      // Eğer bu cihaz Hakemse (Host), rakibin sonuçlarını da hesaplayıp kesin olarak emir verir (Hakem Kararı)
      if (isHost && socketRef.current) {
        let enemyResultType = 'lose'
        if (currentScores.player2 > currentScores.player1) enemyResultType = 'win'
        else if (currentScores.player1 === currentScores.player2) enemyResultType = 'draw'

        const enemyXpChange = enemyResultType === 'win' ? 100 : (enemyResultType === 'draw' ? 50 : -50)

        socketRef.current.emit('game_over_sync', {
          roomId,
          gameOverData: {
            resultType: enemyResultType,
            addedXp: enemyXpChange,
            p1Score: currentScores.player2,
            p2Score: currentScores.player1,
            isQuit: false
          },
          scores: { player1: currentScores.player2, player2: currentScores.player1 }
        })
      }
    }
  }

  return (
    <>
      <div className="portrait-warning">Lütfen Telefonu Yan Çevirin 🔄</div>

      <div className="game-wrapper">
        <button className="back-btn-overlay" onClick={handleEarlyLeave}>⬅ Lobiye Dön (Terket)</button>

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
                <span className="stat-label">Skor</span>
                <span className="stat-value">{gameOverData.p1Score} - {gameOverData.p2Score}</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">XP Değişimi</span>
                <span className="stat-value xp" style={{ color: gameOverData.addedXp > 0 ? '#2ec4b6' : '#e71d36' }}>
                  {gameOverData.addedXp > 0 ? `+${gameOverData.addedXp}` : gameOverData.addedXp}
                </span>
              </div>
            </div>

            <button className="btn-lobby" onClick={onBack}>
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

          <button className="shoot-btn" onTouchStart={(e) => { e.preventDefault(); window.mobileShoot() }}>Ateş</button>
        </div>
      </div>
    </>
  )
}