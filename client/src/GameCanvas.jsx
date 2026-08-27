import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { supabase } from '../supabaseClient' // Supabase istemci yolun projene göre değişebilir, kontrol etmeyi unutma!

export default function GameCanvas({ roomId, profile, onGameOver }) {
  const canvasRef = useRef(null)
  const socketRef = useRef(null)

  // Veritabanındaki `equipped` jsonb yapısına tam uyumlu userData state'i
  const [userData, setUserData] = useState({
    username: profile?.username || 'Oyuncu',
    color: profile?.color || '#00f5d4',
    level: profile?.level || 1,
    xp: profile?.xp || 0,
    wins: profile?.wins || 0,
    losses: profile?.losses || 0,
    voxel: profile?.voxel || 0,
    equippedSkin: profile?.equipped?.skin || profile?.equipped_skin || 'default',
    equippedBullet: profile?.equipped?.bullet || profile?.equipped_bullet || 'default_bullet',
    equippedTrail: profile?.equipped?.trail || profile?.equipped_trail || 'none'
  })

  const [enemyData, setEnemyData] = useState({
    name: 'Rakip',
    color: '#ff2e93',
    id: null,
    equippedSkin: 'default',
    equippedBullet: 'default_bullet',
    equippedTrail: 'none'
  })

  useEffect(() => {
    // 409 çakışmasını (polling/websocket) engellemek için transport ayarları eklendi
    const socket = io('https://boxwars-server.onrender.com', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    })
    socketRef.current = socket

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let animationFrameId
    let keys = {}

    // Oyuncu ve mermi state'leri
    let playerPos = { x: 100, y: 300 }
    let enemyPos = { x: 700, y: 300 }
    let bullets = []

    // Klavye Dinleyicileri
    const handleKeyDown = (e) => { keys[e.key] = true }
    const handleKeyUp = (e) => { keys[e.key] = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Fare Tıklaması ile Ateş Etme
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      const angle = Math.atan2(clickY - playerPos.y, clickX - playerPos.x)
      const newBullet = {
        x: playerPos.x,
        y: playerPos.y,
        vx: Math.cos(angle) * 7,
        vy: Math.sin(angle) * 7,
        bulletType: userData.equippedBullet,
        owner: socket.id
      }

      bullets.push(newBullet)
      socket.emit('shoot', { roomId, bullet: newBullet })
    }

    canvas.addEventListener('click', handleCanvasClick)

    // Odaya Giriş ve Rakip Bilgisini Çekme
    const initRoomAndSocket = async () => {
      socket.emit('join_room', { roomId, profile: userData })

      socket.on('init_game', async (data) => {
        const enemyId = data.players?.find(id => id !== socket.id)
        if (enemyId) {
          // Supabase'den rakip profilini güvenle çekiyoruz
          const { data: enemyProfile } = await supabase.from('profiles').select('*').eq('id', enemyId).single()
          if (enemyProfile) {
            setEnemyData({
              name: enemyProfile.username || 'Rakip',
              color: enemyProfile.color || '#ff2e93',
              id: enemyProfile.id,
              equippedSkin: enemyProfile.equipped?.skin || enemyProfile.equipped_skin || 'default',
              equippedBullet: enemyProfile.equipped?.bullet || enemyProfile.equipped_bullet || 'default_bullet',
              equippedTrail: enemyProfile.equipped?.trail || enemyProfile.equipped_trail || 'none'
            })
          }
        }
      })

      socket.on('player_move', (data) => {
        if (data.id !== socket.id) {
          enemyPos = { x: data.x, y: data.y }
        }
      })

      socket.on('bullet_fired', (bullet) => {
        if (bullet.owner !== socket.id) {
          bullets.push(bullet)
        }
      })
    }

    initRoomAndSocket()

    // Özel Skin Çizim Fonksiyonu (Mor Neon dahil)
    const drawCustomSkin = (x, y, skinType, baseColor) => {
      ctx.fillStyle = (skinType === 'skin_neon_purple') ? '#9333ea' : baseColor
      ctx.fillRect(x - 16, y - 16, 32, 32)

      // Neon mor parlama efekti veya diğer skin detayları
      if (skinType === 'skin_neon_purple') {
        ctx.strokeStyle = '#c084fc'
        ctx.lineWidth = 3
        ctx.strokeRect(x - 18, y - 18, 36, 36)
      } else if (skinType === 'cyber' || skinType === 'robot') {
        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(x - 10, y - 8, 20, 6)
      } else if (skinType === 'cat' || skinType === 'neko') {
        ctx.fillStyle = baseColor
        ctx.beginPath()
        ctx.moveTo(x - 12, y - 16); ctx.lineTo(x - 6, y - 24); ctx.lineTo(x - 2, y - 16); ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x + 2, y - 16); ctx.lineTo(x + 6, y - 24); ctx.lineTo(x + 12, y - 16); ctx.fill()
      }
    }

    // Oyun Döngüsü (Game Loop)
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Oyuncu Hareket Mantığı
      let speed = 4
      if (keys['w'] || keys['ArrowUp']) playerPos.y -= speed
      if (keys['s'] || keys['ArrowDown']) playerPos.y += speed
      if (keys['a'] || keys['ArrowLeft']) playerPos.x -= speed
      if (keys['d'] || keys['ArrowRight']) playerPos.x += speed

      // Sunucuya pozisyon bildir
      socket.emit('player_move', { roomId, x: playerPos.x, y: playerPos.y })

      // Oyuncuyu Çiz
      drawCustomSkin(playerPos.x, playerPos.y, userData.equippedSkin, userData.color)

      // Rakibi Çiz
      drawCustomSkin(enemyPos.x, enemyPos.y, enemyData.equippedSkin, enemyData.color)

      // Mermileri Güncelle ve Çiz
      bullets.forEach((b, index) => {
        b.x += b.vx
        b.y += b.vy

        ctx.fillStyle = b.bulletType === 'laser' ? '#f43f5e' : '#fbbf24'
        ctx.beginPath()
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2)
        ctx.fill()

        // Ekran dışına çıkan mermileri temizle
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
          bullets.splice(index, 1)
        }
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.removeEventListener('click', handleCanvasClick)
      cancelAnimationFrame(animationFrameId)
      socket.disconnect()
    }
  }, [roomId, userData.equippedBullet, userData.equippedSkin])

  return (
    <div style={{ textAlign: 'center', background: '#0f172a', color: '#fff', padding: '10px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '0 20px', fontWeight: 'bold' }}>
        <span style={{ color: userData.color }}>{userData.username} (Skin: {userData.equippedSkin})</span>
        <span>VS</span>
        <span style={{ color: enemyData.color }}>{enemyData.name} (Skin: {enemyData.equippedSkin})</span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{ border: '3px solid #334155', borderRadius: '8px', background: '#1e293b', cursor: 'crosshair' }}
      />
    </div>
  )
}