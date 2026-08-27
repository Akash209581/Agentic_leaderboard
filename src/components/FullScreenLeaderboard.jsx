import React from 'react';

export default function FullScreenLeaderboard({ teams, visitors, faculty, scans, events }) {
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

  // Helper to render a leaderboard box slot
  const renderLeaderboardBox = (slot, idx) => {
    if (slot.type === 'event') {
      const teamsInEvent = sortedTeams.filter(t => t.event === slot.eventName);
      return (
        <div key={idx} className="glass-panel leaderboard-box-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', flexShrink: 0 }}>
            <span>🏆 {slot.title}</span>
            <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginLeft: '12px' }}>({teamsInEvent.length} Teams)</span>
          </h3>
          <div className="table-container-scrollable" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '8px' }}>
            {teamsInEvent.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '14px' }}>
                No teams registered yet.
              </div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '50px', paddingBottom: '6px', textAlign: 'left', color: 'var(--text-dim)', fontSize: '12px' }}>RANK</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'left', color: 'var(--text-dim)', fontSize: '12px' }}>TEAM</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'right', color: 'var(--text-dim)', fontSize: '12px' }}>POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsInEvent.map((team, rIdx) => {
                    const rankClass = rIdx === 0 ? 'rank-text-gold' : rIdx === 1 ? 'rank-text-silver' : rIdx === 2 ? 'rank-text-bronze' : '';
                    const rankIcon = rIdx === 0 ? '🥇' : rIdx === 1 ? '🥈' : rIdx === 2 ? '🥉' : `#${rIdx + 1}`;
                    return (
                      <tr key={team.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className={rankClass} style={{ fontSize: '18px', padding: '6px 0' }}>{rankIcon}</td>
                        <td style={{ padding: '6px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                              src={team.leaderPhoto || team.leader_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f59e0b' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
                              alt="Leader"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                background: 'rgba(255, 255, 255, 0.05)'
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>{team.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{team.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--accent-cyan)', fontSize: '1rem', padding: '6px 0' }}>{team.points} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>pts</span></td>
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
        <div key={idx} className="glass-panel leaderboard-box-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', flexShrink: 0 }}>
            <span>🎟️/🎓 Visitors Leaderboard</span>
            <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginLeft: '12px' }}>({combinedScanners.length} Entries)</span>
          </h3>
          <div className="table-container-scrollable" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '8px' }}>
            {combinedScanners.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '14px' }}>
                No scanners registered yet.
              </div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '50px', paddingBottom: '6px', textAlign: 'left', color: 'var(--text-dim)', fontSize: '12px' }}>RANK</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'left', color: 'var(--text-dim)', fontSize: '12px' }}>VISITOR</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'right', color: 'var(--text-dim)', fontSize: '12px' }}>POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedScanners.map((sc, rIdx) => {
                    const rankClass = rIdx === 0 ? 'rank-text-gold' : rIdx === 1 ? 'rank-text-silver' : rIdx === 2 ? 'rank-text-bronze' : '';
                    const rankIcon = rIdx === 0 ? '🥇' : rIdx === 1 ? '🥈' : rIdx === 2 ? '🥉' : `#${rIdx + 1}`;
                    const scanCount = (scans || []).filter(s => s.scannerId === sc.id && s.status === 'approved').length;
                    return (
                      <tr key={sc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className={rankClass} style={{ fontSize: '18px', padding: '6px 0' }}>{rankIcon}</td>
                        <td style={{ padding: '6px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>{sc.name}</span>
                            <span className="accent-badge" style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              background: sc.role === 'Faculty' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                              color: sc.role === 'Faculty' ? 'var(--accent-warning)' : 'var(--accent-tech)',
                              border: sc.role === 'Faculty' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)'
                            }}>{sc.role}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{sc.mobile || sc.id} | {scanCount} scans</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--accent-cyan)', fontSize: '1rem', padding: '6px 0' }}>{sc.points} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>pts</span></td>
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
      <div key={idx} className="glass-panel leaderboard-box-panel empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', flexShrink: 0 }}>🏆 {slot.title}</h3>
        <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>
          TBD Standings
        </div>
      </div>
    );
  };

  return (
    <div className="full-screen-leaderboard fade-in" style={{ padding: '12px', height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', overflow: 'hidden' }}>
      <div className="leaderboards-2x2-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', minHeight: 0 }}>
        {boxSlots.map((slot, idx) => renderLeaderboardBox(slot, idx))}
      </div>
    </div>
  );
}
