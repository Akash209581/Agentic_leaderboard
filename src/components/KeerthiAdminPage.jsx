import React, { useState } from 'react';
import { seedMockData, clearDatabase, addEvent, deleteEvent } from '../utils/db';

export default function KeerthiAdminPage({ teams = [], visitors = [], faculty = [], scans = [], events = [], onExit }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('keerthi_admin_logged_in') === 'true';
  });

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // Event creation state
  const [newEventName, setNewEventName] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState('events_db'); // 'events_db' | 'teams' | 'scans'
  const [searchTeam, setSearchTeam] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanUser === 'keerthi mam' && cleanPass === 'cse@vfstr') {
      setIsAuthenticated(true);
      sessionStorage.setItem('keerthi_admin_logged_in', 'true');
    } else {
      setAuthError('Invalid credentials. Please enter valid Keerthi MAM admin username and password.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('keerthi_admin_logged_in');
    setUsername('');
    setPassword('');
  };

  // Password confirmation modal state for critical actions
  const [securityModal, setSecurityModal] = useState({
    isOpen: false,
    actionType: '', // 'reset' | 'seed' | 'delete_event'
    title: '',
    description: '',
    eventId: null,
    eventName: '',
    error: '',
    inputPassword: '',
    isProcessing: false
  });

  const handleOpenSecurityModal = (actionType, extra = {}) => {
    let title = '';
    let description = '';

    if (actionType === 'reset') {
      title = '⚠️ Security Verification: Reset Entire Database';
      description = 'This will permanently delete all registered teams, visitors, faculty, scans, and custom events. Enter your admin password to confirm.';
    } else if (actionType === 'seed') {
      title = '🌱 Security Verification: Seed Mock Data';
      description = 'This will replace existing database records with mock student teams, visitors, faculty, and scan history. Enter your admin password to proceed.';
    } else if (actionType === 'delete_event') {
      title = `🗑️ Security Verification: Delete Event "${extra.eventName}"`;
      description = `Are you sure you want to delete the event "${extra.eventName}"? Enter your admin password to confirm deletion.`;
    }

    setSecurityModal({
      isOpen: true,
      actionType,
      title,
      description,
      eventId: extra.eventId || null,
      eventName: extra.eventName || '',
      error: '',
      inputPassword: '',
      isProcessing: false
    });
  };

  const handleCloseSecurityModal = () => {
    setSecurityModal({
      isOpen: false,
      actionType: '',
      title: '',
      description: '',
      eventId: null,
      eventName: '',
      error: '',
      inputPassword: '',
      isProcessing: false
    });
  };

  const handleConfirmSecurityAction = async (e) => {
    e.preventDefault();
    if (securityModal.inputPassword.trim() !== 'cse@vfstr') {
      setSecurityModal(prev => ({
        ...prev,
        error: 'Incorrect admin password! Verification failed.'
      }));
      return;
    }

    setSecurityModal(prev => ({ ...prev, isProcessing: true, error: '' }));

    try {
      if (securityModal.actionType === 'reset') {
        await clearDatabase();
        alert('✅ Database has been reset successfully!');
      } else if (securityModal.actionType === 'seed') {
        await seedMockData();
        alert('✅ Database successfully seeded with mock demo data!');
      } else if (securityModal.actionType === 'delete_event') {
        await deleteEvent(securityModal.eventId);
        alert(`✅ Event "${securityModal.eventName}" was successfully deleted.`);
      }
      handleCloseSecurityModal();
    } catch (err) {
      setSecurityModal(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Action failed: ' + err.message
      }));
    }
  };

  const handleAddEventSubmit = async (e) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    try {
      await addEvent(newEventName.trim());
      setNewEventName('');
    } catch (err) {
      alert(err.message);
    }
  };

  // If not authenticated, render Admin Login screen
  if (!isAuthenticated) {
    return (
      <div className="fade-in">
        <div className="glass-panel registration-box">
          <div className="card-top-icon-circle">
            <span>🛡️</span>
          </div>
          <div className="panel-header">
            <span className="accent-badge-pill">— ADMINISTRATOR ACCESS —</span>
            <h2>Keerthi MAM Admin Portal</h2>
            <p>Please enter your authorized credentials to access event management & system database tools.</p>
          </div>

          {authError && (
            <div className="error-message alert-pop" style={{ marginBottom: '16px' }}>
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="registration-form">
            <div className="pill-typebox-wrapper">
              <div className="typebox-left-icon">👤</div>
              <div className="typebox-content">
                <label htmlFor="adminUsername" className="typebox-label">Admin Username</label>
                <input
                  id="adminUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Keerthi MAM"
                  required
                />
              </div>
              <div className="typebox-right-icon">🪪</div>
            </div>

            <div className="pill-typebox-wrapper">
              <div className="typebox-left-icon">🔒</div>
              <div className="typebox-content">
                <label htmlFor="adminPassword" className="typebox-label">Password</label>
                <input
                  id="adminPassword"
                  type={showAdminPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  required
                />
              </div>
              <button 
                type="button" 
                onClick={() => setShowAdminPassword(!showAdminPassword)} 
                className="typebox-right-btn"
                title="Toggle password visibility"
              >
                {showAdminPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <button type="submit" className="btn btn-pill-action btn-block">
              <span className="btn-icon-sq">🔓</span>
              <span className="btn-text-main">Unlock Admin Dashboard</span>
              <span className="btn-arrow-right">→</span>
            </button>

            {onExit && (
              <div className="card-footer-links" style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={onExit}
                  className="footer-link-btn"
                >
                  <span>←</span> Return to Public Portal
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="secure-badge-note">
          <span>🛡️</span> Secure Admin Gateway • Encrypted Session Protection
        </div>
      </div>
    );
  }

  // Filtered teams for unique code viewer
  const filteredTeams = teams.filter(t => 
    t.name?.toLowerCase().includes(searchTeam.toLowerCase()) ||
    t.leaderName?.toLowerCase().includes(searchTeam.toLowerCase()) ||
    t.leaderRegNo?.toLowerCase().includes(searchTeam.toLowerCase()) ||
    t.id?.toLowerCase().includes(searchTeam.toLowerCase())
  );

  return (
    <div className="admin-dashboard fade-in" style={{ paddingBottom: '40px' }}>
      {/* Top Admin Header Bar */}
      <div className="glass-panel" style={{ padding: '20px 28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderColor: 'rgba(139, 92, 246, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '32px' }}>🛡️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontFamily: 'var(--font-tech)' }}>Keerthi MAM Admin Control Center</h2>
              <span className="keerthi-admin-badge">AUTHORIZED ADMIN</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Manage hackathon events, database operations, team recovery codes, and live scanning configurations.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onExit && (
            <button onClick={onExit} className="btn btn-outline" style={{ fontSize: '13px', padding: '8px 16px' }}>
              👁️ View Public Portal
            </button>
          )}
          <button onClick={handleLogout} className="btn btn-danger" style={{ fontSize: '13px', padding: '8px 16px' }}>
            🔒 Logout
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveAdminTab('events_db')}
          className={`btn ${activeAdminTab === 'events_db' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 18px', fontSize: '13px' }}
        >
          ⚙️ Event Management & Database Tools
        </button>
        <button
          onClick={() => setActiveAdminTab('teams')}
          className={`btn ${activeAdminTab === 'teams' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 18px', fontSize: '13px' }}
        >
          👥 Registered Teams & Recovery Codes ({teams.length})
        </button>
        <button
          onClick={() => setActiveAdminTab('scans')}
          className={`btn ${activeAdminTab === 'scans' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 18px', fontSize: '13px' }}
        >
          ⚡ Scan Activity Overview ({scans.length})
        </button>
      </div>

      {/* TAB 1: Event Management & Database Tools */}
      {activeAdminTab === 'events_db' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          {/* Event Management Widget */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>📅</span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Event Management</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Add new events or delete existing ones. "Agentic Ai Day" is currently active.
            </p>
            
            <form onSubmit={handleAddEventSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '20px', marginTop: '16px' }}>
              <input
                type="text"
                placeholder="New Event Name (e.g. Agentic Ai Day)"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: 'bold' }}>
                + Add Event
              </button>
            </form>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {events.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  No events registered yet.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {events.map(evt => (
                    <li
                      key={evt.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        marginBottom: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--accent-cyan)' }}>🎯</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {evt.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleOpenSecurityModal('delete_event', { eventId: evt.id, eventName: evt.name })}
                        className="btn btn-danger"
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px'
                        }}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Database Tools Widget */}
          <div className="glass-panel admin-controls-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🛠️</span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Database Sandbox Tools</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Control sandbox data. Clear the database to start completely fresh for new competitions, or seed mock test data.
            </p>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
                <h4 style={{ color: 'var(--accent-danger)', margin: '0 0 6px 0', fontSize: '14px' }}>⚠️ Factory Reset Database</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                  Permanently deletes all registered teams, visitors, faculty, scans, and custom events. Resets default to <strong>Agentic Ai Day</strong>.
                </p>
                <button onClick={() => handleOpenSecurityModal('reset')} className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
                  🗑️ Reset Entire Database
                </button>
              </div>

              <div style={{ padding: '16px', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '12px' }}>
                <h4 style={{ color: 'var(--accent-cyan)', margin: '0 0 6px 0', fontSize: '14px' }}>🌱 Seed Demo & Mock Data</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                  Pre-populates demo student teams, visitors, faculty, and scan history for testing.
                </p>
                <button onClick={() => handleOpenSecurityModal('seed')} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                  ✨ Seed Mock Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Registered Teams & Unique Recovery Codes */}
      {activeAdminTab === 'teams' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>👥 Registered Student Teams & Secret Recovery Codes</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Use this table if a student team forgot their login password and needs their unique recovery code.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search team name or leader reg no..."
              value={searchTeam}
              onChange={(e) => setSearchTeam(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '8px 14px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                minWidth: '260px'
              }}
            />
          </div>

          <div className="table-responsive">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Team ID</th>
                  <th>Team Name</th>
                  <th>Event</th>
                  <th>Leader Name</th>
                  <th>Leader Reg No</th>
                  <th>Points</th>
                  <th style={{ color: 'var(--accent-gold)' }}>🔑 Unique Recovery Code</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px' }}>
                      No teams found.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((t) => (
                    <tr key={t.id} className="leaderboard-row">
                      <td style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{t.id}</td>
                      <td style={{ fontWeight: '600' }}>{t.name}</td>
                      <td>
                        <span className="accent-badge" style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
                          {t.event || 'Agentic Ai Day'}
                        </span>
                      </td>
                      <td>{t.leaderName || t.leader_name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{t.leaderRegNo || t.leader_reg_no}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--accent-tech)' }}>{t.points} pts</td>
                      <td>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          fontWeight: '800',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: 'var(--accent-gold)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          letterSpacing: '1.5px'
                        }}>
                          {t.uniqueCode || t.unique_code || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Scan Activity Overview */}
      {activeAdminTab === 'scans' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>⚡ Real-time Scan Verification Feed</h3>
          <div className="table-responsive">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Scan ID</th>
                  <th>Team ID</th>
                  <th>Scanner Name</th>
                  <th>Scanner Type</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px' }}>
                      No scan interactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  scans.slice().reverse().map((s) => (
                    <tr key={s.id} className="leaderboard-row">
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{s.id}</td>
                      <td style={{ fontWeight: 'bold' }}>{s.teamId || s.team_id}</td>
                      <td>{s.scannerName || s.scanner_name}</td>
                      <td>
                        <span className="accent-badge" style={{
                          fontSize: '10px',
                          background: s.scannerType === 'faculty' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                          color: s.scannerType === 'faculty' ? 'var(--accent-warning)' : 'var(--accent-tech)'
                        }}>
                          {s.scannerType}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          color: s.status === 'approved' ? 'var(--accent-success)' : s.status === 'rejected' ? 'var(--accent-danger)' : 'var(--accent-warning)',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          fontSize: '11px'
                        }}>
                          ● {s.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          SECURITY PASSWORD VERIFICATION MODAL
      ======================================================== */}
      {securityModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(4, 7, 20, 0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '460px',
            width: '100%',
            padding: '32px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(239, 68, 68, 0.25)',
            borderRadius: '20px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '38px', marginBottom: '10px' }}>🔒</div>
              <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 8px 0' }}>
                {securityModal.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                {securityModal.description}
              </p>
            </div>

            {securityModal.error && (
              <div className="error-message" style={{ marginBottom: '16px', fontSize: '13px' }}>
                ⚠️ {securityModal.error}
              </div>
            )}

            <form onSubmit={handleConfirmSecurityAction}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Admin Password
                </label>
                <input
                  type="password"
                  value={securityModal.inputPassword}
                  onChange={(e) => setSecurityModal(prev => ({ ...prev, inputPassword: e.target.value }))}
                  placeholder="Enter cse@vfstr..."
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(5, 8, 20, 0.8)',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleCloseSecurityModal}
                  className="btn btn-outline"
                  disabled={securityModal.isProcessing}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={securityModal.isProcessing}
                  style={{ flex: 1, fontWeight: '700' }}
                >
                  {securityModal.isProcessing ? 'Verifying...' : 'Confirm & Execute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
