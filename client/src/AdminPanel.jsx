import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import './AdminPanel.css';

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [activeTable, setActiveTable] = useState('profiles'); 
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newItemForm, setNewItemForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [notification, setNotification] = useState({ message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: '' });
    }, 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'a@a.com' && password === 'a') {
      setIsLoggedIn(true);
      setError('');
      fetchTableData(activeTable);
    } else {
      setError('Erişim Reddedildi: Geçersiz Kimlik Bilgileri!');
    }
  };

  const fetchTableData = async (tableName) => {
    setLoading(true);
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(`Veri çekme hatası (${tableName}):`, error.message);
      setDataList([]);
    } else {
      setDataList(data || []);
    }
    setLoading(false);
  };

  const handleTabChange = (tableName) => {
    setActiveTable(tableName);
    setEditingIndex(null);
    setEditForm({});
    setNewItemForm({});
    fetchTableData(tableName);
  };

  const handleUpdate = async (item, index) => {
    let query = supabase.from(activeTable).update(editForm);
    
    if (item.id !== undefined) {
      query = query.eq('id', item.id);
    } else {
      query = query.eq(Object.keys(item)[0], item[Object.keys(item)[0]]);
    }

    const { error } = await query;

    if (error) {
      showNotification('Güncelleme Başarısız: ' + error.message, 'error');
    } else {
      setEditingIndex(null);
      setEditForm({});
      showNotification('Kayıt başarıyla güncellendi!');
      fetchTableData(activeTable);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Bu veriyi veritabanından kalıcı olarak silmek istediğine emin misin?')) return;

    let query = supabase.from(activeTable).delete();
    if (item.id !== undefined) {
      query = query.eq('id', item.id);
    } else {
      query = query.eq(Object.keys(item)[0], item[Object.keys(item)[0]]);
    }

    const { error } = await query;

    if (error) {
      showNotification('Silme Başarısız: ' + error.message, 'error');
    } else {
      showNotification('Kayıt başarıyla silindi!');
      fetchTableData(activeTable);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    // Duyuru eklerken içerik, aktiflik ve isteğe bağlı bitiş süresi (expires_at) ekliyoruz
    const payload = activeTable === 'announcements' 
      ? { 
          content: newItemForm.content, 
          active: true, 
          expires_at: newItemForm.expires_at || null 
        } 
      : newItemForm;

    const { error } = await supabase
      .from(activeTable)
      .insert([payload]);

    if (error) {
      showNotification('Kayıt Ekleme Başarısız: ' + error.message, 'error');
    } else {
      setShowAddModal(false);
      setNewItemForm({});
      showNotification('Yeni kayıt başarıyla eklendi!');
      fetchTableData(activeTable);
    }
  };

  const handleFeedbackAction = async (item, actionType) => {
    let updateData = {};
    if (actionType === 'read') updateData = { status: 'Okundu' };
    if (actionType === 'reviewing') updateData = { status: 'Bakılıyor' };
    if (actionType === 'thanked') updateData = { status: 'Teşekkür Edildi' };

    let query = supabase.from('feedbacks').update(updateData);
    if (item.id !== undefined) {
      query = query.eq('id', item.id);
    } else {
      query = query.eq(Object.keys(item)[0], item[Object.keys(item)[0]]);
    }

    const { error } = await query;
    if (error) {
      showNotification('İşlem başarısız: ' + error.message, 'error');
    } else {
      showNotification(`Mesaj durumu güncellendi: ${updateData.status}`);
      fetchTableData('feedbacks');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="admin-login-wrapper">
        <div className="admin-login-card">
          <div className="login-header-glow"></div>
          <h2 className="login-title">⚡ BOX WARS // KONTROL</h2>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label>GMAİL KİMLİĞİ</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="admin@boxwars.com" 
                required 
              />
            </div>
            <div className="input-group">
              <label>ERİŞİM ŞİFRESİ</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="******" 
                required 
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn">SİSTEME BAĞLAN</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {notification.message && (
        <div className={`page-notification ${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}

      <header className="admin-header">
        <div className="header-brand">
          <h1>⚡ BOX WARS // SUPABASE ÇEKİRDEK</h1>
          <span className="live-status"><span className="pulse-dot"></span> CANLI VERİTABANI BAĞLANTISI</span>
        </div>
        <div className="header-actions">
          {activeTable !== 'announcements' && (
            <button onClick={() => setShowAddModal(true)} className="action-btn create-btn">+ YENİ KAYIT EKLE</button>
          )}
          <button onClick={() => fetchTableData(activeTable)} className="action-btn refresh-btn">YENİLE</button>
          <button onClick={() => setIsLoggedIn(false)} className="action-btn logout-btn">ÇIKIŞ YAP</button>
        </div>
      </header>

      <nav className="admin-nav-tabs">
        <button 
          className={`tab-btn ${activeTable === 'profiles' ? 'active' : ''}`} 
          onClick={() => handleTabChange('profiles')}
        >
          📂 Profiles (Oyuncular)
        </button>
        <button 
          className={`tab-btn ${activeTable === 'feedbacks' ? 'active' : ''}`} 
          onClick={() => handleTabChange('feedbacks')}
        >
          💬 Feedbacks (Mesajlar)
        </button>
        <button 
          className={`tab-btn ${activeTable === 'announcements' ? 'active' : ''}`} 
          onClick={() => handleTabChange('announcements')}
        >
          📢 Announcements (Duyurular)
        </button>
      </nav>

      <main className="admin-content">
        {loading ? (
          <div className="loading-state">
            <div className="cyber-spinner"></div>
            <p>Veritabanı tablosu taranıyor...</p>
          </div>
        ) : (
          <div className="table-container">
            
            {/* Announcements sekmesinde hızlı duyuru ve bitiş zamanı ekleme formu */}
            {activeTable === 'announcements' && (
              <form onSubmit={handleCreate} style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                background: '#131b2e',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 245, 212, 0.3)',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <input 
                  type="text" 
                  placeholder="Duyuru metni..." 
                  value={newItemForm.content || ''}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, content: e.target.value }))}
                  style={{
                    flex: 2,
                    minWidth: '250px',
                    background: '#030712',
                    border: '1px solid #00f5d4',
                    color: '#00f5d4',
                    padding: '10px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    outline: 'none'
                  }}
                  required
                />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: '200px' }}>
                  <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Son Tarih:</span>
                  <input 
                    type="datetime-local" 
                    value={newItemForm.expires_at || ''}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, expires_at: e.target.value }))}
                    style={{
                      width: '100%',
                      background: '#030712',
                      border: '1px solid #00f5d4',
                      color: '#00f5d4',
                      padding: '9px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                </div>

                <button type="submit" className="save-btn" style={{ padding: '10px 20px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + DUYURU EKLE
                </button>
              </form>
            )}

            <table className="cyber-table">
              <thead>
                <tr>
                  {dataList.length > 0 && Object.keys(dataList[0])
                    .filter((key) => key !== 'id')
                    .map((key) => (
                      <th key={key}>{key.toUpperCase()}</th>
                    ))}
                  <th style={{ textAlign: 'right' }}>İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {dataList.length === 0 ? (
                  <tr>
                    <td colSpan="100" className="empty-row">Bu tabloda henüz hiç veri bulunmuyor.</td>
                  </tr>
                ) : (
                  dataList.map((item, index) => (
                    <tr key={item.id || index} className="table-row">
                      {Object.keys(item).map((key) => {
                        if (key === 'id') return null;
                        return (
                          <td key={key} className="data-cell">
                            {editingIndex === index ? (
                              <input 
                                type="text"
                                value={editForm[key] !== undefined ? editForm[key] : (item[key] ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditForm(prev => ({ ...prev, [key]: val }));
                                }}
                                className="edit-input"
                              />
                            ) : (
                              <span className="cell-text">{String(item[key] ?? '')}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="actions-cell">
                        {activeTable === 'feedbacks' && (
                          <div className="feedback-quick-actions">
                            <button onClick={() => handleFeedbackAction(item, 'read')} className="fb-btn read-btn" title="Okundu Olarak İşaretle">✓ Okundu</button>
                            <button onClick={() => handleFeedbackAction(item, 'reviewing')} className="fb-btn review-btn" title="Bakılıyor Olarak İşaretle">👁️ Bakılıyor</button>
                            <button onClick={() => handleFeedbackAction(item, 'thanked')} className="fb-btn thank-btn" title="Teşekkür Et">⭐ Teşekkür Et</button>
                          </div>
                        )}

                        {editingIndex === index ? (
                          <>
                            <button onClick={() => handleUpdate(item, index)} className="save-btn">KAYDET</button>
                            <button onClick={() => { setEditingIndex(null); setEditForm({}); }} className="cancel-btn">İPTAL</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { 
                              setEditingIndex(index); 
                              setEditForm({ ...item }); 
                            }} className="edit-btn">DÜZENLE</button>
                            <button onClick={() => handleDelete(item)} className="delete-btn">SİL</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header-glow"></div>
            <h3>[ {activeTable.toUpperCase()} - YENİ KAYIT ]</h3>
            <form onSubmit={handleCreate} className="modal-form">
              {activeTable === 'profiles' && (
                <>
                  <div className="modal-input-group">
                    <label>Kullanıcı Adı (İsim)</label>
                    <input 
                      type="text" 
                      placeholder="örn: CyberNinja" 
                      value={newItemForm.username || ''}
                      onChange={(e) => setNewItemForm(prev => ({...prev, username: e.target.value}))} 
                      required 
                    />
                  </div>
                  <div className="modal-input-group">
                    <label>XP / Skor Değeri</label>
                    <input 
                      type="number" 
                      placeholder="örn: 1500" 
                      value={newItemForm.xp !== undefined ? newItemForm.xp : (newItemForm.score !== undefined ? newItemForm.score : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewItemForm(prev => ({...prev, xp: val, score: val}));
                      }} 
                    />
                  </div>
                </>
              )}
              {activeTable === 'feedbacks' && (
                <>
                  <div className="modal-input-group">
                    <label>Gönderen İsim</label>
                    <input 
                      type="text" 
                      placeholder="örn: Ahmet" 
                      value={newItemForm.sender || ''}
                      onChange={(e) => setNewItemForm(prev => ({...prev, sender: e.target.value}))} 
                      required 
                    />
                  </div>
                  <div className="modal-input-group">
                    <label>Mesaj İçeriği</label>
                    <input 
                      type="text" 
                      placeholder="örn: Harika bir oyun olmuş!" 
                      value={newItemForm.message || ''}
                      onChange={(e) => setNewItemForm(prev => ({...prev, message: e.target.value}))} 
                      required 
                    />
                  </div>
                  <div className="modal-input-group">
                    <label>Durum</label>
                    <input 
                      type="text" 
                      placeholder="örn: Yeni" 
                      value={newItemForm.status || ''}
                      onChange={(e) => setNewItemForm(prev => ({...prev, status: e.target.value}))} 
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="submit" className="save-btn">EKLE</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="cancel-btn">İPTAL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}