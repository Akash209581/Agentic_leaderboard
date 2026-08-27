import React, { useState } from 'react';
import { seedMockData, clearDatabase, addEvent, deleteEvent } from '../utils/db';

export default function AdminPage({ teams, visitors, faculty, scans, events = [] }) {
  // Event Management Input State
  const [newEventName, setNewEventName] = useState('');

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
          <h3>
            <span>🏆 {slot.title}</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>({teamsInEvent.length} Teams)</span>
          </h3>
          <div className="table-container-scrollable">
            {teamsInEvent.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                No teams registered yet.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Rank</th>
                    <th>Team</th>
                    <th style={{ textAlign: 'right' }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsInEvent.map((team, rIdx) => {
                    const rankClass = rIdx === 0 ? 'rank-text-gold' : rIdx === 1 ? 'rank-text-silver' : rIdx === 2 ? 'rank-text-bronze' : '';
                    const rankIcon = rIdx === 0 ? '🥇' : rIdx === 1 ? '🥈' : rIdx === 2 ? '🥉' : `#${rIdx + 1}`;
                    return (
                      <tr key={team.id}>
                        <td className={rankClass} style={{ fontSize: '20px' }}>{rankIcon}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img
                              src={team.leaderPhoto || team.leader_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2306b6d4' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
                              alt="Leader"
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                background: 'rgba(255, 255, 255, 0.05)'
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: '600' }}>{team.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                                <span>{team.id}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-cyan)' }}>{team.points} pts</td>
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
          <h3>
            <span>🎟️/🎓 Visitors Leaderboard</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>({combinedScanners.length} Entries)</span>
          </h3>
          <div className="table-container-scrollable">
            {combinedScanners.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                No scanners registered yet.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Rank</th>
                    <th>Visitor</th>
                    <th style={{ textAlign: 'right' }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedScanners.map((sc, rIdx) => {
                    const rankClass = rIdx === 0 ? 'rank-text-gold' : rIdx === 1 ? 'rank-text-silver' : rIdx === 2 ? 'rank-text-bronze' : '';
                    const rankIcon = rIdx === 0 ? '🥇' : rIdx === 1 ? '🥈' : rIdx === 2 ? '🥉' : `#${rIdx + 1}`;
                    const scanCount = scans.filter(s => s.scannerId === sc.id && s.status === 'approved').length;
                    return (
                      <tr key={sc.id}>
                        <td className={rankClass} style={{ fontSize: '16px' }}>{rankIcon}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '600' }}>{sc.name}</span>
                            <span className="accent-badge" style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              background: sc.role === 'Faculty' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                              color: sc.role === 'Faculty' ? 'var(--accent-warning)' : 'var(--accent-tech)',
                              border: sc.role === 'Faculty' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)'
                            }}>{sc.role}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{sc.mobile || sc.id} | {scanCount} scans</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-cyan)' }}>{sc.points} pts</td>
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
      <div key={idx} className="glass-panel leaderboard-box-panel empty-state">
        <h3>🏆 {slot.title}</h3>
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          TBD Standings
        </div>
      </div>
    );
  };

  return (
    <div className="admin-dashboard fade-in">
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Admin Management & Analytics</h2>
          <p>Real-time overview of the AI Hackathon scoreboards, participant stats, and event setups.</p>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon team-icon">👥</div>
          <div className="stat-info">
            <span className="stat-label">Total Teams</span>
            <span className="stat-value">{totalTeamsCount}</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon visitor-icon">🎟️</div>
          <div className="stat-info">
            <span className="stat-label">Student Visitors</span>
            <span className="stat-value">{totalVisitorsCount}</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon faculty-icon">🎓</div>
          <div className="stat-info">
            <span className="stat-label">Total Faculty</span>
            <span className="stat-value">{totalFacultyCount}</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon scan-icon">⚡</div>
          <div className="stat-info">
            <span className="stat-label">Approved Scans</span>
            <span className="stat-value">{totalApprovedScans}</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon points-icon">🏆</div>
          <div className="stat-info">
            <span className="stat-label">Total Points</span>
            <span className="stat-value">{totalPointsAwarded}</span>
          </div>
        </div>
      </div>

      {/* 2x2 Leaderboards Grid */}
      <div className="leaderboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>🏆 Hackathon Standings (2x2 Scoreboards)</h3>
          <button 
            onClick={() => window.open('?view=leaderboard', '_blank')}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '12px' }}
            title="Open TV Presentation Leaderboard"
          >
            <span>📺</span>
            <span>Presentation View</span>
          </button>
        </div>
        <div className="leaderboards-2x2-grid">
          {boxSlots.map((slot, idx) => renderLeaderboardBox(slot, idx))}
        </div>
      </div>

      {/* Backup Scanner Leaderboard if not visible in 2x2 grid (i.e. if 4+ events occupy the grid) */}
      {!isScannerInGrid && (
        <div style={{ marginTop: '24px', marginBottom: '24px' }}>
          <div className="glass-panel leaderboard-table-panel">
            <h3 style={{ fontFamily: 'var(--font-tech)', fontSize: '15px', marginBottom: '16px' }}>
              🎟️/🎓 Visitors Leaderboard (Combined)
            </h3>
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Role</th>
                    <th>Name</th>
                    <th>Identifier</th>
                    <th>Scans</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedScanners.map((sc, index) => {
                    const scanCount = scans.filter(s => s.scannerId === sc.id && s.status === 'approved').length;
                    return (
                      <tr key={sc.id} className="leaderboard-row">
                        <td className="row-rank">#{index + 1}</td>
                        <td>
                          <span className="accent-badge" style={{
                            background: sc.role === 'Faculty' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                            color: sc.role === 'Faculty' ? 'var(--accent-warning)' : 'var(--accent-tech)',
                            border: sc.role === 'Faculty' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)'
                          }}>{sc.role}</span>
                        </td>
                        <td className="row-team-name">{sc.name}</td>
                        <td className="row-members">{sc.mobile || sc.id}</td>
                        <td className="row-members">{scanCount} scans</td>
                        <td className="row-points">{sc.points} pts</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Event Management & Database Tools Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
        {/* Event Management Widget */}
        <div className="glass-panel">
          <h3>📅 Event Management</h3>
          <p>Add new events or delete existing ones. Seed events are loaded by default.</p>
          
          <form onSubmit={handleAddEventSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px', marginTop: '12px' }}>
            <input
              type="text"
              placeholder="Event Name (e.g. AI Hack)"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
              Add
            </button>
          </form>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {events.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No events registered yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {events.map(evt => (
                  <li
                    key={evt.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      marginBottom: '6px'
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{evt.name}</span>
                    <button
                      onClick={() => handleDeleteEventClick(evt.id, evt.name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-danger)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
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
        <div className="glass-panel admin-controls-panel">
          <h3>🛠️ Database Tools</h3>
          <p>Manage sandbox state. Clear the database to start fresh.</p>
          <div className="control-buttons" style={{ marginTop: '16px' }}>
            <button onClick={handleReset} className="btn btn-danger">
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
