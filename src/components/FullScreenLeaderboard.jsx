import React, { useEffect } from 'react';

export default function FullScreenLeaderboard({ 
  teams = [], 
  visitors = [], 
  faculty = [], 
  scans = [], 
  events = [], 
  pointsActive = true,
  onExit 
}) {
  // Listen for Escape key to exit TV / Fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onExit) {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

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

  // Prepare slots for the 2x2 grid (exactly 4 boxes)
  const boxSlots = [];

  // Add event leaderboards up to Box 3
  (events || []).forEach((evt) => {
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
  if (events && events.length >= 4) {
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
      title: '🎟️/🎓 Visitors & Faculty Standings'
    });
  }

  // Fallbacks if there are fewer than 3 events
  if (boxSlots.length < 4) {
    const hasScanner = boxSlots.some(s => s.type === 'scanner');
    if (!hasScanner) {
      boxSlots.push({
        type: 'scanner',
        title: '🎟️/🎓 Visitors & Faculty Standings'
      });
    }
  }
  while (boxSlots.length < 4) {
    boxSlots.push({
      type: 'empty',
      title: 'Open Arena Division'
    });
  }

  // Helper to render each leaderboard slot
  const renderLeaderboardBox = (slot, idx) => {
    if (slot.type === 'event') {
      const teamsInEvent = sortedTeams.filter(t => t.event === slot.eventName);
      return (
        <div key={idx} className="tv-leaderboard-box glass-panel">
          <div className="tv-box-header">
            <div className="tv-box-title">
              <span className="tv-trophy">🏆</span>
              <h3>{slot.title}</h3>
            </div>
            <span className="tv-count-pill">{teamsInEvent.length} Teams</span>
          </div>

          <div className="tv-table-scroll">
            {teamsInEvent.length === 0 ? (
              <div className="tv-empty-state">
                <div className="tv-empty-icon">⚡</div>
                <h4>Waiting for Teams</h4>
                <p>No teams registered for {slot.eventName} yet.</p>
              </div>
            ) : (
              <table className="tv-leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>Rank</th>
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
                      <tr key={team.id} className={`tv-item-row ${isPodium ? 'tv-podium-row' : ''}`}>
                        <td>
                          <span className={`tv-rank-badge ${rankClass}`}>
                            {rankBadge}
                          </span>
                        </td>
                        <td>
                          <div className="tv-team-cell">
                            <div className={`tv-avatar ${rankClass}`}>
                              <img
                                src={team.leaderPhoto || team.leader_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f59e0b' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
                                alt="Leader"
                              />
                            </div>
                            <div className="tv-team-info">
                              <span className="tv-team-name">{team.name}</span>
                              <span className="tv-team-meta">{team.id} • {team.leaderName || team.leader_name}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="tv-points-pill">
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
        <div key={idx} className="tv-leaderboard-box glass-panel">
          <div className="tv-box-header">
            <div className="tv-box-title">
              <span className="tv-trophy">🎟️</span>
              <h3>Visitors & Faculty Standings</h3>
            </div>
            <span className="tv-count-pill">{combinedScanners.length} Scanners</span>
          </div>

          <div className="tv-table-scroll">
            {combinedScanners.length === 0 ? (
              <div className="tv-empty-state">
                <div className="tv-empty-icon">🎟️</div>
                <h4>No Scanners Yet</h4>
                <p>Visitor and faculty point activity will appear here in real-time.</p>
              </div>
            ) : (
              <table className="tv-leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>Rank</th>
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
                      <tr key={sc.id} className={`tv-item-row ${isPodium ? 'tv-podium-row' : ''}`}>
                        <td>
                          <span className={`tv-rank-badge ${rankClass}`}>
                            {rankBadge}
                          </span>
                        </td>
                        <td>
                          <div className="tv-team-cell">
                            <div className="tv-team-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="tv-team-name">{sc.name}</span>
                                <span className={`role-pill-badge ${sc.role.toLowerCase()}`}>
                                  {sc.role}
                                </span>
                              </div>
                              <span className="tv-team-meta">{sc.mobile || sc.id} • {scanCount} approved scans</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="tv-points-pill">
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
      <div key={idx} className="tv-leaderboard-box glass-panel empty-arena-panel">
        <div className="tv-box-header">
          <div className="tv-box-title">
            <span className="tv-trophy">🛡️</span>
            <h3>{slot.title}</h3>
          </div>
        </div>
        <div className="tv-empty-state">
          <div className="tv-empty-icon">🛡️</div>
          <h4>Open Division</h4>
          <p>Upcoming event bracket</p>
        </div>
      </div>
    );
  };

  return (
    <div className="tv-view-container fade-in">
      {/* Sleek TV Header Bar */}
      <header className="tv-header-bar">
        <div className="tv-header-left">
          <div className="tv-logo-badge">
            <span className="tv-spark-icon">⚡</span>
            <h2>AGENTIC <span className="tv-accent-text">AI DAY</span></h2>
            <span className="tv-pill-tag">TV ARENA</span>
          </div>
          <div className="tv-live-indicator">
            <span className="live-dot-pulse"></span>
            <span>LIVE SCOREBOARD</span>
          </div>
          {!pointsActive && (
            <span className="tv-paused-tag">⏸️ POINTS PAUSED</span>
          )}
        </div>

        <div className="tv-header-center">
          <span className="tv-cse-badge">🎓 CSE presents</span>
        </div>

        <div className="tv-header-right">
          {onExit && (
            <button 
              onClick={onExit}
              className="tv-exit-button"
              title="Exit Full Screen TV View (Esc)"
            >
              <span>✕ Exit Full Screen</span>
              <kbd className="tv-kbd-hint">Esc</kbd>
            </button>
          )}
        </div>
      </header>

      {/* Exactly the 4 Leaderboards in 2x2 Grid */}
      <main className="tv-grid-main">
        <div className="tv-2x2-grid">
          {boxSlots.map((slot, idx) => renderLeaderboardBox(slot, idx))}
        </div>
      </main>
    </div>
  );
}
