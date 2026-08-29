import React, { useState, useEffect } from 'react';
import { seedMockData, clearDatabase, addEvent, deleteEvent } from '../utils/db';
import FullScreenLeaderboard from './FullScreenLeaderboard';

export default function AdminPage({ teams, visitors, faculty, scans, events = [], pointsActive = true }) {
  // Event Management Input State
  const [newEventName, setNewEventName] = useState('');
  const [isTvViewOpen, setIsTvViewOpen] = useState(false);

  // Sync fullscreen change with state
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsTvViewOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleEnterTvView = () => {
    setIsTvViewOpen(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleExitTvView = () => {
    setIsTvViewOpen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Sort teams by points (highest first) and then by registration time
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.registeredAt - b.registeredAt;
  });

  // Sort combined scanners (student visitors + faculty) by points
  const combinedScanners = [
    ...visitors.map(v => ({ ...v, role: 'Visitor' })),
    ...faculty.map(f => ({ ...f, role: 'Faculty' }))
  ].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.registeredAt - b.registeredAt;
  });

  const totalTeamsCount = teams.length;
  const totalVisitorsCount = visitors.length;
  const totalFacultyCount = faculty.length;
  const totalApprovedScans = scans.filter(s => s.status === 'approved').length;

  const totalPointsAwarded = 
    teams.reduce((acc, t) => acc + t.points, 0) +
    visitors.reduce((acc, v) => acc + v.points, 0) +
    faculty.reduce((acc, f) => acc + f.points, 0);

  const handleSeed = async () => {
    if (window.confirm('This will seed the database with mock student teams, visitors, faculty, and scan history. Proceed?')) {
      try {
        await seedMockData();
      } catch (err) {
        alert('Failed to seed mock data: ' + err.message);
      }
    }
  };

  const handleReset = async () => {
    if (window.confirm('WARNING: This will permanently delete all teams, visitors, faculty, scans, and custom events. Are you sure?')) {
      try {
        await clearDatabase();
      } catch (err) {
        alert('Failed to reset database: ' + err.message);
      }
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

  const handleDeleteEventClick = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete event "${name}"? Registered teams in this event will remain but will not appear on any event leaderboard until reassigned.`)) {
      try {
        await deleteEvent(id);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Prepare slots for the 2x2 grid (exactly 4 boxes)
  const boxSlots = [];

  // Add event leaderboards up to Box 3
  events.forEach((evt) => {
    if (boxSlots.length < 3) {
      boxSlots.push({
        type: 'event',
        title: `${evt.name} Standings`,
        eventName: evt.name,
        eventId: evt.id
      });
    }
  });

  // If there is a 4th event, put it in Box 4
  if (events.length >= 4) {
    boxSlots.push({
      type: 'event',
      title: `${events[3].name} Standings`,
      eventName: events[3].name,
      eventId: events[3].id
    });
  } else {
    // If only 3 events, 4th box is Visitors Leaderboard (combined Visitor & Faculty)
    boxSlots.push({
      type: 'scanner',
      title: '🎟️/🎓 Visitors Leaderboard'
    });
  }

  // Fallbacks if there are fewer than 3 events
  if (boxSlots.length < 4) {
    const hasScanner = boxSlots.some(s => s.type === 'scanner');
    if (!hasScanner) {
      boxSlots.push({
        type: 'scanner',
        title: '🎟️/🎓 Visitors Leaderboard'
      });
    }
  }
  while (boxSlots.length < 4) {
    boxSlots.push({
      type: 'empty',
      title: 'TBD Standings'
    });
  }

  // Detect if Scanner leaderboard is displayed in the 2x2 grid
  const isScannerInGrid = boxSlots.some(s => s.type === 'scanner');

  // Helper to render a leaderboard box slot
  const renderLeaderboardBox = (slot, idx) => {
    if (slot.type === 'event') {
      const teamsInEvent = sortedTeams.filter(t => t.event === slot.eventName);
      return (
        <div key={idx} className="glass-panel leaderboard-box-panel">
          <div className="leaderboard-box-header">
            <div className="box-header-title">
              <span className="trophy-icon">🏆</span>
              <h4>{slot.title}</h4>
            </div>
            <span className="team-count-pill">{teamsInEvent.length} Teams</span>
          </div>

          <div className="table-container-scrollable">
            {teamsInEvent.length === 0 ? (
              <div className="empty-leaderboard-state">
                <div className="empty-state-icon">⚡</div>
                <h5>Waiting for Teams</h5>
                <p>No teams registered for {slot.eventName} yet.</p>
              </div>
            ) : (
              <table className="modern-leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th>Team</th>
                    <th style={{ textAlign: 'right' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsInEvent.map((team, rIdx) => {
                    const isPodium = rIdx < 3;
                    const rankClass = rIdx === 0 ? 'rank-gold' : rIdx === 1 ? 'rank-silver' : rIdx === 2 ? 'rank-bronze' : 'rank-normal';
                    const rankBadge = rIdx === 0 ? '🥇 1st' : rIdx === 1 ? '🥈 2nd' : rIdx === 2 ? '🥉 3rd' : `#${rIdx + 1}`;
                    
                    return (
                      <tr key={team.id} className={`leaderboard-item-row ${isPodium ? 'podium-row' : ''}`}>
                        <td>
                          <span className={`modern-rank-badge ${rankClass}`}>
                            {rankBadge}
                          </span>
                        </td>
                        <td>
                          <div className="team-cell-content">
                            <div className={`avatar-ring ${rankClass}`}>
                              <img
                                src={team.leaderPhoto || team.leader_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f59e0b' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
                                alt="Leader"
                              />
                            </div>
                            <div className="team-meta">
                              <span className="team-title-text">{team.name}</span>
                              <span className="team-sub-id">{team.id} • {team.leaderName || team.leader_name}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="points-pill-highlight">
                            {team.points} <small>PTS</small>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      );
    }

    if (slot.type === 'scanner') {
      return (
        <div key={idx} className="glass-panel leaderboard-box-panel">
          <div className="leaderboard-box-header">
            <div className="box-header-title">
              <span className="trophy-icon">🎟️</span>
              <h4>Visitors & Faculty Standings</h4>
            </div>
            <span className="team-count-pill">{combinedScanners.length} Scanners</span>
          </div>

          <div className="table-container-scrollable">
            {combinedScanners.length === 0 ? (
              <div className="empty-leaderboard-state">
                <div className="empty-state-icon">🎟️</div>
                <h5>No Scanners Yet</h5>
                <p>Visitor and faculty point activity will appear here in real-time.</p>
              </div>
            ) : (
              <table className="modern-leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th>Participant</th>
                    <th style={{ textAlign: 'right' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedScanners.map((sc, rIdx) => {
                    const isPodium = rIdx < 3;
                    const rankClass = rIdx === 0 ? 'rank-gold' : rIdx === 1 ? 'rank-silver' : rIdx === 2 ? 'rank-bronze' : 'rank-normal';
                    const rankBadge = rIdx === 0 ? '🥇 1st' : rIdx === 1 ? '🥈 2nd' : rIdx === 2 ? '🥉 3rd' : `#${rIdx + 1}`;
                    const scanCount = scans.filter(s => s.scannerId === sc.id && s.status === 'approved').length;
                    
                    return (
                      <tr key={sc.id} className={`leaderboard-item-row ${isPodium ? 'podium-row' : ''}`}>
                        <td>
                          <span className={`modern-rank-badge ${rankClass}`}>
                            {rankBadge}
                          </span>
                        </td>
                        <td>
                          <div className="team-cell-content">
                            <div className="team-meta">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="team-title-text">{sc.name}</span>
                                <span className={`role-pill-badge ${sc.role.toLowerCase()}`}>
                                  {sc.role}
                                </span>
                              </div>
                              <span className="team-sub-id">{sc.mobile || sc.id} • {scanCount} approved scans</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="points-pill-highlight">
                            {sc.points} <small>PTS</small>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={idx} className="glass-panel leaderboard-box-panel empty-arena-panel">
        <div className="leaderboard-box-header">
          <div className="box-header-title">
            <span className="trophy-icon">🏆</span>
            <h4>{slot.title}</h4>
          </div>
        </div>
        <div className="empty-leaderboard-state">
          <div className="empty-state-icon">🛡️</div>
          <h5>Open Division</h5>
          <p>Upcoming event bracket</p>
        </div>
      </div>
    );
  };

  if (isTvViewOpen) {
    return (
      <FullScreenLeaderboard 
        teams={teams}
        visitors={visitors}
        faculty={faculty}
        scans={scans}
        events={events}
        pointsActive={pointsActive}
        onExit={handleExitTvView}
      />
    );
  }

  return (
    <div className="admin-dashboard fade-in">
      <div className="analytics-hero-header glass-panel">
        <div className="hero-header-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div className="live-status-pill">
              <span className="live-dot-pulse"></span>
              <span>LIVE LEADERBOARD</span>
            </div>
            <div style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              background: pointsActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: pointsActive ? '#10b981' : '#ef4444',
              border: pointsActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              {pointsActive ? '● POINTS ALLOCATION ACTIVE' : '⏸️ POINTS ALLOCATION PAUSED'}
            </div>
          </div>
          <h2>Analytics & Standings Arena</h2>
          <p>Real-time telemetry, participant stats, and live scoreboard updates for Agentic AI Day.</p>
        </div>
        
        <div className="hero-header-actions">
          <button 
            onClick={handleEnterTvView}
            className="tv-view-launch-btn"
            title="Launch Full Screen TV Arena Scoreboard"
          >
            <span className="tv-btn-spark">⚡</span>
            <span className="tv-btn-icon">📺</span>
            <span className="tv-btn-label">TV View (Full Screen)</span>
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card card-cyan">
          <div className="stat-icon-wrapper team-icon">
            <span>👥</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Teams</span>
            <span className="stat-value">{totalTeamsCount}</span>
            <span className="stat-hint">Registered squads</span>
          </div>
        </div>

        <div className="glass-panel stat-card card-purple">
          <div className="stat-icon-wrapper visitor-icon">
            <span>🎟️</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">Student Visitors</span>
            <span className="stat-value">{totalVisitorsCount}</span>
            <span className="stat-hint">Audience scanners</span>
          </div>
        </div>

        <div className="glass-panel stat-card card-amber">
          <div className="stat-icon-wrapper faculty-icon">
            <span>🎓</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Faculty</span>
            <span className="stat-value">{totalFacultyCount}</span>
            <span className="stat-hint">Evaluators</span>
          </div>
        </div>

        <div className="glass-panel stat-card card-emerald">
          <div className="stat-icon-wrapper scan-icon">
            <span>⚡</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">Approved Scans</span>
            <span className="stat-value">{totalApprovedScans}</span>
            <span className="stat-hint">Verified QR scans</span>
          </div>
        </div>

        <div className="glass-panel stat-card card-gold">
          <div className="stat-icon-wrapper points-icon">
            <span>🏆</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Points</span>
            <span className="stat-value">{totalPointsAwarded}</span>
            <span className="stat-hint">Awarded in arena</span>
          </div>
        </div>
      </div>

      {/* 2x2 Leaderboards Grid */}
      <div className="leaderboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>🏆 Live Standings (Scoreboards)</h3>
          <button 
            onClick={handleEnterTvView}
            className="tv-view-btn-secondary"
            title="Launch Full Screen TV Mode"
          >
            <span>📺 Open TV View</span>
          </button>
        </div>
        <div className="leaderboards-2x2-grid">
          {boxSlots.map((slot, idx) => renderLeaderboardBox(slot, idx))}
        </div>
      </div>

      {/* Backup Scanner Leaderboard if not visible in 2x2 grid */}
      {!isScannerInGrid && (
        <div style={{ marginTop: '24px', marginBottom: '24px' }}>
          <div className="glass-panel leaderboard-box-panel">
            <div className="leaderboard-box-header">
              <div className="box-header-title">
                <span className="trophy-icon">🎟️</span>
                <h4>Visitors & Faculty Standings</h4>
              </div>
              <span className="team-count-pill">{combinedScanners.length} Scanners</span>
            </div>

            <div className="table-container-scrollable">
              {combinedScanners.length === 0 ? (
                <div className="empty-leaderboard-state">
                  <div className="empty-state-icon">🎟️</div>
                  <h5>No Scanners Yet</h5>
                  <p>Visitor and faculty point activity will appear here in real-time.</p>
                </div>
              ) : (
                <table className="modern-leaderboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Rank</th>
                      <th>Participant</th>
                      <th style={{ textAlign: 'right' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedScanners.map((sc, rIdx) => {
                      const isPodium = rIdx < 3;
                      const rankClass = rIdx === 0 ? 'rank-gold' : rIdx === 1 ? 'rank-silver' : rIdx === 2 ? 'rank-bronze' : 'rank-normal';
                      const rankBadge = rIdx === 0 ? '🥇 1st' : rIdx === 1 ? '🥈 2nd' : rIdx === 2 ? '🥉 3rd' : `#${rIdx + 1}`;
                      const scanCount = scans.filter(s => s.scannerId === sc.id && s.status === 'approved').length;
                      
                      return (
                        <tr key={sc.id} className={`leaderboard-item-row ${isPodium ? 'podium-row' : ''}`}>
                          <td>
                            <span className={`modern-rank-badge ${rankClass}`}>
                              {rankBadge}
                            </span>
                          </td>
                          <td>
                            <div className="team-cell-content">
                              <div className="team-meta">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="team-title-text">{sc.name}</span>
                                  <span className={`role-pill-badge ${sc.role.toLowerCase()}`}>
                                    {sc.role}
                                  </span>
                                </div>
                                <span className="team-sub-id">{sc.mobile || sc.id} • {scanCount} approved scans</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="points-pill-highlight">
                              {sc.points} <small>PTS</small>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
