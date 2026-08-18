import React, { useState } from 'react';
import { seedMockData, clearDatabase } from '../utils/db';

export default function AdminPage({ teams, visitors, faculty, scans }) {
  // Admin Authentication State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('is_admin_logged_in') === 'true';
  });
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setAdminError('');

    if (adminUsername.trim() === 'admin' && adminPassword === 'admin') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('is_admin_logged_in', 'true');
    } else {
      setAdminError('Invalid Admin ID or Password.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('is_admin_logged_in');
    setAdminUsername('');
    setAdminPassword('');
  };

  // Sort teams by points (highest first) and then by registration time
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.registeredAt - b.registeredAt;
  });

  // Sort visitors (student visitors) by points
  const sortedVisitors = [...visitors].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.registeredAt - b.registeredAt;
  });

  // Sort faculty by points
  const sortedFaculty = [...faculty].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.registeredAt - b.registeredAt;
  });

  const firstPlace = sortedTeams[0] || null;
  const secondPlace = sortedTeams[1] || null;
  const thirdPlace = sortedTeams[2] || null;
  const remainingTeams = sortedTeams.slice(3);

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
    if (window.confirm('WARNING: This will permanently delete all teams, visitors, faculty, and scans from SQLite. Are you sure?')) {
      try {
        await clearDatabase();
      } catch (err) {
        alert('Failed to reset database: ' + err.message);
      }
    }
  };

  // 1. Admin Login View (Unauthenticated)
  if (!isAdminLoggedIn) {
    return (
      <div className="fade-in">
        <div className="glass-panel registration-box">
          <div className="panel-header">
            <span className="accent-badge">ADMIN ACCESS</span>
            <h2>Admin Management System</h2>
            <p>Log in with your administrator ID and password to view dashboards and seed/reset database.</p>
          </div>

          <form onSubmit={handleAdminLogin} className="registration-form">
            {adminError && <div className="error-message alert-pop">{adminError}</div>}

            <div className="form-group">
              <label htmlFor="adminId">Admin ID</label>
              <input
                id="adminId"
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Enter admin ID..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="adminPassword">Password</label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password..."
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Login to Admin System
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Admin Dashboard (Authenticated)
  return (
    <div className="admin-dashboard fade-in">
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Admin Management & Analytics</h2>
          <p>Real-time overview of the AI Hackathon scoreboard, participant stats, and database controls.</p>
        </div>
        <button onClick={handleAdminLogout} className="btn btn-outline" style={{ minWidth: '100px' }}>
          Log Out
        </button>
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

      {/* Leaderboard Section */}
      <div className="leaderboard-section">
        <h3>🏆 Hackathon Leaderboard</h3>

        {sortedTeams.length === 0 ? (
          <div className="glass-panel empty-state">
            <p>No teams registered yet. Use the Database Tools at the bottom to seed mock data!</p>
          </div>
        ) : (
          <>
            {/* Podium (Top 3) */}
            <div className="podium-container">
              {/* 2nd Place Card */}
              <div className="podium-column second-place-col">
                {secondPlace ? (
                  <div className="podium-card glass-panel silver-glow fade-in-podium">
                    <span className="podium-medal">🥈</span>
                    <span className="podium-rank-text">2ND PLACE</span>
                    <h4 className="podium-team-name">{secondPlace.name}</h4>
                    <span className="podium-team-id">{secondPlace.id}</span>
                    <div className="podium-points-box">
                      <span className="points-num">{secondPlace.points}</span>
                      <span className="points-lbl">Pts</span>
                    </div>
                  </div>
                ) : (
                  <div className="podium-card glass-panel empty-podium">
                    <span className="podium-medal">🥈</span>
                    <p>TBD</p>
                  </div>
                )}
                <div className="podium-block silver-block">2</div>
              </div>

              {/* 1st Place Card - Taller & Elevated */}
              <div className="podium-column first-place-col">
                {firstPlace ? (
                  <div className="podium-card glass-panel gold-glow fade-in-podium">
                    <span className="podium-medal crown-animation">👑</span>
                    <span className="podium-rank-text gold-text">1ST PLACE</span>
                    <h4 className="podium-team-name">{firstPlace.name}</h4>
                    <span className="podium-team-id">{firstPlace.id}</span>
                    <div className="podium-points-box gold-bg">
                      <span className="points-num">{firstPlace.points}</span>
                      <span className="points-lbl">Pts</span>
                    </div>
                  </div>
                ) : (
                  <div className="podium-card glass-panel empty-podium">
                    <span className="podium-medal">🥇</span>
                    <p>TBD</p>
                  </div>
                )}
                <div className="podium-block gold-block">1</div>
              </div>

              {/* 3rd Place Card */}
              <div className="podium-column third-place-col">
                {thirdPlace ? (
                  <div className="podium-card glass-panel bronze-glow fade-in-podium">
                    <span className="podium-medal">🥉</span>
                    <span className="podium-rank-text">3RD PLACE</span>
                    <h4 className="podium-team-name">{thirdPlace.name}</h4>
                    <span className="podium-team-id">{thirdPlace.id}</span>
                    <div className="podium-points-box">
                      <span className="points-num">{thirdPlace.points}</span>
                      <span className="points-lbl">Pts</span>
                    </div>
                  </div>
                ) : (
                  <div className="podium-card glass-panel empty-podium">
                    <span className="podium-medal">🥉</span>
                    <p>TBD</p>
                  </div>
                )}
                <div className="podium-block bronze-block">3</div>
              </div>
            </div>

            {/* Rest of the Leaderboard Table */}
            {remainingTeams.length > 0 && (
              <div className="glass-panel leaderboard-table-panel">
                <h4>Rankings Table</h4>
                <div className="table-responsive">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Team ID</th>
                        <th>Team Name</th>
                        <th>Members</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remainingTeams.map((team, index) => (
                        <tr key={team.id} className="leaderboard-row">
                          <td className="row-rank">#{index + 4}</td>
                          <td className="row-team-id">{team.id}</td>
                          <td className="row-team-name">{team.name}</td>
                          <td className="row-members">
                            {team.members.join(', ')}
                          </td>
                          <td className="row-points">{team.points} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scanner Leaderboards Section (Student Visitor & Faculty) */}
      <div className="scanner-leaderboards-section">
        
        {/* Student Visitor Rankings Panel */}
        <div className="glass-panel leaderboard-table-panel">
          <h3 style={{ fontFamily: 'var(--font-tech)', fontSize: '15px', marginBottom: '16px' }}>
            🎟️ Student Visitor Leaderboard
          </h3>
          {sortedVisitors.length === 0 ? (
            <div className="empty-state">No visitors registered yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Scans</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVisitors.map((vis, index) => {
                    const scanCount = scans.filter(s => s.scannerId === vis.id && s.status === 'approved').length;
                    return (
                      <tr key={vis.id} className="leaderboard-row">
                        <td className="row-rank">#{index + 1}</td>
                        <td className="row-team-id">{vis.id}</td>
                        <td className="row-team-name">{vis.name}</td>
                        <td className="row-members">{vis.mobile}</td>
                        <td className="row-members">{scanCount} scans</td>
                        <td className="row-points">{vis.points} pts</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Faculty Rankings Panel */}
        <div className="glass-panel leaderboard-table-panel">
          <h3 style={{ fontFamily: 'var(--font-tech)', fontSize: '15px', marginBottom: '16px' }}>
            🎓 Faculty Leaderboard
          </h3>
          {sortedFaculty.length === 0 ? (
            <div className="empty-state">No faculty registered yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Scans</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFaculty.map((fac, index) => {
                    const scanCount = scans.filter(s => s.scannerId === fac.id && s.status === 'approved').length;
                    return (
                      <tr key={fac.id} className="leaderboard-row">
                        <td className="row-rank">#{index + 1}</td>
                        <td className="row-team-id" style={{ color: 'var(--accent-warning)' }}>{fac.id}</td>
                        <td className="row-team-name">{fac.name}</td>
                        <td className="row-members">{scanCount} scans</td>
                        <td className="row-points" style={{ color: 'var(--accent-warning)' }}>{fac.points} pts</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Admin Action Buttons */}
      <div className="glass-panel admin-controls-panel" style={{ marginTop: '24px' }}>
        <h3>🛠️ Database Tools</h3>
        <p>Manage sandbox state. Seed mock data to immediately inspect the reactive UI flow or clear the database to start fresh.</p>
        <div className="control-buttons">
          <button onClick={handleSeed} className="btn btn-primary">
            Seed Mock Data
          </button>
          <button onClick={handleReset} className="btn btn-danger">
            Reset Database
          </button>
        </div>
      </div>
    </div>
  );
}
