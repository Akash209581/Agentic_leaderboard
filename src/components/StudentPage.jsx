import React, { useState, useEffect } from 'react';
import { registerTeam, loginTeam, approveScan, rejectScan } from '../utils/db';

export default function StudentPage({ teams, scans }) {
  const [currentTeamId, setCurrentTeamId] = useState(() => {
    return localStorage.getItem('current_student_team_id') || null;
  });

  const currentTeam = teams.find(t => t.id === currentTeamId) || null;

  // Toggle between Login and Registration views
  const [isRegistering, setIsRegistering] = useState(false);

  // Login Form State
  const [loginTeamName, setLoginTeamName] = useState('');
  const [loginLeaderRegNo, setLoginLeaderRegNo] = useState('');
  const [loginError, setLoginError] = useState('');

  // Registration Form State
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderRegNo, setLeaderRegNo] = useState('');
  const [otherMemberCount, setOtherMemberCount] = useState(2);
  const [otherMembers, setOtherMembers] = useState(['', '']);
  const [registerError, setRegisterError] = useState('');

  // Approval Code Input State
  const [verifyCode, setVerifyCode] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [approvalSuccess, setApprovalSuccess] = useState(false);

  // Clear errors when toggling screens
  useEffect(() => {
    setLoginError('');
    setRegisterError('');
  }, [isRegistering]);

  const handleOtherMemberCountChange = (e) => {
    const count = parseInt(e.target.value, 10);
    setOtherMemberCount(count);
    setOtherMembers(prev => {
      const next = [...prev];
      if (next.length < count) {
        while (next.length < count) next.push('');
      } else {
        next.length = count;
      }
      return next;
    });
  };

  const handleOtherMemberNameChange = (index, value) => {
    setOtherMembers(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    if (!teamName.trim()) {
      setRegisterError('Team name is required.');
      return;
    }
    if (!leaderName.trim()) {
      setRegisterError('Leader name is required.');
      return;
    }
    if (!leaderRegNo.trim()) {
      setRegisterError('Leader registration number is required (acts as your password).');
      return;
    }

    const filledOtherMembers = otherMembers.filter(m => m.trim() !== '');
    const allMembers = [leaderName.trim(), ...filledOtherMembers];

    try {
      const team = await registerTeam(
        teamName.trim(),
        leaderName.trim(),
        leaderRegNo.trim(),
        filledOtherMembers.length + 1,
        allMembers
      );
      setCurrentTeamId(team.id);
      localStorage.setItem('current_student_team_id', team.id);
    } catch (err) {
      setRegisterError(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginTeamName.trim() || !loginLeaderRegNo.trim()) {
      setLoginError('Both Team Name and Leader Registration Number are required.');
      return;
    }

    try {
      const team = await loginTeam(loginTeamName.trim(), loginLeaderRegNo.trim());
      setCurrentTeamId(team.id);
      localStorage.setItem('current_student_team_id', team.id);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('current_student_team_id');
    setCurrentTeamId(null);
    setTeamName('');
    setLeaderName('');
    setLeaderRegNo('');
    setOtherMemberCount(2);
    setOtherMembers(['', '']);
    setLoginTeamName('');
    setLoginLeaderRegNo('');
  };

  // Find if there is a pending scan for this team
  const pendingScan = currentTeam
    ? scans.find(s => s.teamId === currentTeam.id && s.status === 'pending')
    : null;

  const handleApprove = async (e) => {
    e.preventDefault();
    setApprovalError('');
    setApprovalSuccess(false);

    if (!verifyCode.trim()) {
      setApprovalError('Please enter the 4-digit code.');
      return;
    }

    try {
      const result = await approveScan(currentTeam.id, verifyCode.trim());
      if (result.success) {
        setApprovalSuccess(true);
        setVerifyCode('');
        setTimeout(() => {
          setApprovalSuccess(false);
        }, 3000);
      }
    } catch (err) {
      setApprovalError(err.message);
    }
  };

  const handleReject = async () => {
    if (pendingScan) {
      try {
        await rejectScan(pendingScan.id);
        setVerifyCode('');
        setApprovalError('');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Get approved scans for this team
  const myScanHistory = currentTeam
    ? scans
        .filter(s => s.teamId === currentTeam.id && s.status === 'approved')
        .sort((a, b) => b.approvedAt - a.approvedAt)
    : [];

  // Generate QR Code URL using api.qrserver.com
  const qrCodeUrl = currentTeam
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentTeam.id)}&color=0-0-0&bgcolor=255-255-255`
    : '';

  // 1. Not logged in view
  if (!currentTeam) {
    if (isRegistering) {
      return (
        <div className="fade-in">
          <div className="glass-panel registration-box">
            <div className="panel-header">
              <span className="accent-badge">STUDENT REGISTRATION</span>
              <h2>Create Your Hackathon Team</h2>
              <p>Register your team to generate your unique points-tracking QR code.</p>
            </div>

            <form onSubmit={handleRegister} className="registration-form">
              {registerError && <div className="error-message alert-pop">{registerError}</div>}

              <div className="form-group">
                <label htmlFor="teamName">Team Name</label>
                <input
                  id="teamName"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter a cool team name..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="leaderName">Team Leader Full Name</label>
                <input
                  id="leaderName"
                  type="text"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="Enter team leader's name..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="leaderRegNo">Leader Registration Number</label>
                <input
                  id="leaderRegNo"
                  type="text"
                  value={leaderRegNo}
                  onChange={(e) => setLeaderRegNo(e.target.value)}
                  placeholder="Leader Registration Number (used for login)..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="otherMemberCount">Number of Additional Members</label>
                <select
                  id="otherMemberCount"
                  value={otherMemberCount}
                  onChange={handleOtherMemberCountChange}
                >
                  {[0, 1, 2, 3, 4].map(num => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Other Member' : 'Other Members'}
                    </option>
                  ))}
                </select>
              </div>

              {otherMembers.length > 0 && (
                <div className="members-section">
                  <label>Additional Member Names</label>
                  {otherMembers.map((member, index) => (
                    <div key={index} className="form-group member-input fade-in-list">
                      <input
                        type="text"
                        value={member}
                        onChange={(e) => handleOtherMemberNameChange(index, e.target.value)}
                        placeholder={`Member #${index + 2} Name`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block">
                Register Team & Generate QR
              </button>

              <p className="toggle-auth-link">
                Already registered your team?{' '}
                <button type="button" onClick={() => setIsRegistering(false)}>
                  Log In Here
                </button>
              </p>
            </form>
          </div>
        </div>
      );
    }

    // Default View: Student Login
    return (
      <div className="fade-in">
        <div className="glass-panel registration-box">
          <div className="panel-header">
            <span className="accent-badge">STUDENT LOGIN</span>
            <h2>Access Team Dashboard</h2>
            <p>Log in with your Team Name and Team Leader's Registration Number.</p>
          </div>

          <form onSubmit={handleLogin} className="registration-form">
            {loginError && <div className="error-message alert-pop">{loginError}</div>}

            <div className="form-group">
              <label htmlFor="loginTeamName">Team Name</label>
              <input
                id="loginTeamName"
                type="text"
                value={loginTeamName}
                onChange={(e) => setLoginTeamName(e.target.value)}
                placeholder="Enter registered Team Name..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="loginLeaderRegNo">Leader Registration Number</label>
              <input
                id="loginLeaderRegNo"
                type="password"
                value={loginLeaderRegNo}
                onChange={(e) => setLoginLeaderRegNo(e.target.value)}
                placeholder="Enter leader registration number as password..."
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Login to Dashboard
            </button>

            <p className="toggle-auth-link">
              New hackathon team?{' '}
              <button type="button" onClick={() => setIsRegistering(true)}>
                Register Your Team
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // 2. Logged in dashboard view
  return (
    <div className="student-dashboard fade-in">
      {/* Pending Scan Modal Alert */}
      {pendingScan && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel scan-request-modal alert-pop">
            <div className="modal-header pulse-glow">
              <div className="live-dot-container">
                <span className="live-dot"></span>
              </div>
              <h3>Live Scan Request!</h3>
            </div>
            <div className="modal-body">
              <p>
                <strong>{pendingScan.scannerName}</strong> ({pendingScan.scannerType === 'visitor' ? 'Student Visitor' : 'Faculty'}) is scanning your QR code.
              </p>
              <p className="instruction">
                Ask them for the <strong>4-digit code</strong> showing on their screen to approve the points.
              </p>

              <form onSubmit={handleApprove} className="approval-form">
                {approvalError && <div className="error-message alert-pop">{approvalError}</div>}
                
                <div className="form-group code-input-container">
                  <input
                    type="text"
                    maxLength="4"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 4-Digit Code"
                    className="code-input"
                    autoFocus
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={handleReject} className="btn btn-secondary">
                    Reject
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Approve Scan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confetti or points notification animation */}
      {approvalSuccess && (
        <div className="points-popup-overlay">
          <div className="points-popup pulse-glow">
            <span className="plus-points">+10</span>
            <span className="points-label">Points Approved!</span>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left column: Team Profile */}
        <div className="grid-col-left">
          <div className="glass-panel profile-panel">
            <div className="profile-header">
              <span className="team-id-badge">{currentTeam.id}</span>
              <h2>{currentTeam.name}</h2>
            </div>

            <div className="points-display-card">
              <span className="points-title">TOTAL POINTS</span>
              <span className="points-value glow-text">{currentTeam.points}</span>
            </div>

            <div className="members-list-card">
              <h4>Team Members ({currentTeam.members.length})</h4>
              <ul>
                {currentTeam.members.map((name, idx) => (
                  <li key={idx} className="member-item">
                    <span className="bullet"></span>
                    {name} {idx === 0 && <span className="leader-tag">(Leader)</span>}
                  </li>
                ))}
              </ul>
            </div>

            <button onClick={handleLogout} className="btn btn-outline btn-block logout-btn">
              Logout
            </button>
          </div>
        </div>

        {/* Right column: QR and History */}
        <div className="grid-col-right">
          {/* QR Code Panel */}
          <div className="glass-panel qr-panel">
            <div className="panel-header">
              <h3>Your Unique QR Code</h3>
              <p>Show this QR code to student visitors and faculty members to earn points.</p>
            </div>
            
            <div className="qr-container-wrapper">
              <div className="qr-card">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt={`QR Code for ${currentTeam.id}`} className="qr-image" />
                ) : (
                  <div className="qr-placeholder">Generating QR...</div>
                )}
                <div className="qr-footer-id">{currentTeam.id}</div>
              </div>
            </div>
          </div>

          {/* History Panel */}
          <div className="glass-panel history-panel">
            <div className="panel-header">
              <h3>Scan History</h3>
              <p>Recent scan approvals from student visitors and faculty.</p>
            </div>

            <div className="history-list">
              {myScanHistory.length === 0 ? (
                <div className="empty-state">
                  <p>No scans approved yet. Find student visitors or faculty to scan your QR!</p>
                </div>
              ) : (
                myScanHistory.map((scan) => (
                  <div key={scan.id} className="history-item fade-in-list">
                    <div className="history-info">
                      <div className="history-title-row">
                        <span className="scanner-name">{scan.scannerName}</span>
                        <span className={`scanner-badge ${scan.scannerType}`}>
                          {scan.scannerType === 'visitor' ? 'STUDENT' : scan.scannerType.toUpperCase()}
                        </span>
                      </div>
                      <span className="history-time">
                        {new Date(scan.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="history-points">
                      +10 pts
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
