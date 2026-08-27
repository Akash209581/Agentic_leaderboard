import React, { useState, useEffect } from 'react';
import { registerTeam, loginTeam, approveScan, rejectScan, forgotPasswordTeam } from '../utils/db';

export default function StudentPage({ teams, scans, events = [] }) {
  const [currentTeamId, setCurrentTeamId] = useState(() => {
    return localStorage.getItem('current_student_team_id') || null;
  });

  const [teamEvent, setTeamEvent] = useState('');
  const [leaderPhoto, setLeaderPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');

  const currentTeam = teams.find(t => t.id === currentTeamId) || null;

  // Toggle between Login and Registration views
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Login Form State
  const [loginTeamName, setLoginTeamName] = useState('');
  const [loginLeaderRegNo, setLoginLeaderRegNo] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
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

  // Forgot Password State
  const [fpTeamName, setFpTeamName] = useState('');
  const [fpLeaderName, setFpLeaderName] = useState('');
  const [fpUniqueCode, setFpUniqueCode] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpSuccessMessage, setFpSuccessMessage] = useState('');

  // Clear errors when toggling screens
  useEffect(() => {
    setLoginError('');
    setRegisterError('');
    setFpError('');
    setFpSuccessMessage('');
  }, [isRegistering, isForgotPassword]);

  // Default to first event if events are loaded
  useEffect(() => {
    if (events && events.length > 0 && !teamEvent) {
      setTeamEvent(events[0].name);
    }
  }, [events, teamEvent]);

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

  const handlePhotoChange = (e) => {
    setPhotoError('');
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image size should be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLeaderPhoto(reader.result);
    };
    reader.onerror = () => {
      setPhotoError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
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

    if (!teamEvent) {
      setRegisterError('Event selection is required.');
      return;
    }

    if (!leaderPhoto) {
      setRegisterError('Leader photo is required.');
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
        allMembers,
        teamEvent,
        leaderPhoto
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
    setTeamEvent('');
    setLeaderPhoto('');
    setLoginTeamName('');
    setLoginLeaderRegNo('');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpSuccessMessage('');

    if (!fpTeamName.trim() || !fpLeaderName.trim() || !fpUniqueCode.trim()) {
      setFpError('All fields are required.');
      return;
    }

    try {
      const result = await forgotPasswordTeam(fpTeamName.trim(), fpLeaderName.trim(), fpUniqueCode.trim());
      
      // Automatically log the user in using the retrieved registration number
      const team = await loginTeam(fpTeamName.trim(), result.leaderRegNo);
      setCurrentTeamId(team.id);
      localStorage.setItem('current_student_team_id', team.id);
      
      // Reset FP states just in case
      setIsForgotPassword(false);
      setFpTeamName('');
      setFpLeaderName('');
      setFpUniqueCode('');
    } catch (err) {
      setFpError(err.message);
    }
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
            <div className="card-top-icon-circle">
              <span>🎓</span>
            </div>
            <div className="panel-header">
              <span className="accent-badge-pill">— STUDENT REGISTRATION —</span>
              <h2>Create Your Hackathon Team</h2>
              <p>Register your team to generate your unique points-tracking QR code.</p>
            </div>

            <form onSubmit={handleRegister} className="registration-form">
              {registerError && <div className="error-message alert-pop">{registerError}</div>}

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">👥</div>
                <div className="typebox-content">
                  <label htmlFor="teamName" className="typebox-label">Team Name</label>
                  <input
                    id="teamName"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter a cool team name"
                    required
                  />
                </div>
              </div>

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">👤</div>
                <div className="typebox-content">
                  <label htmlFor="leaderName" className="typebox-label">Team Leader Full Name</label>
                  <input
                    id="leaderName"
                    type="text"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="Enter team leader's name"
                    required
                  />
                </div>
              </div>

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">🪪</div>
                <div className="typebox-content">
                  <label htmlFor="leaderRegNo" className="typebox-label">Leader Registration Number</label>
                  <input
                    id="leaderRegNo"
                    type="text"
                    value={leaderRegNo}
                    onChange={(e) => setLeaderRegNo(e.target.value)}
                    placeholder="Leader Registration Number (used for login)"
                    required
                  />
                </div>
              </div>

              <div className="pill-typebox-wrapper" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="typebox-left-icon">📸</div>
                  <div className="typebox-content">
                    <label htmlFor="leaderPhoto" className="typebox-label">Leader Photo (Mandatory)</label>
                    <input
                      id="leaderPhoto"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      required
                      style={{
                        padding: '4px 0',
                        fontSize: '12px',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>
                {photoError && <div style={{ color: 'var(--accent-danger)', fontSize: '11px', marginTop: '2px' }}>{photoError}</div>}
                {leaderPhoto && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '46px' }}>
                    <img
                      src={leaderPhoto}
                      alt="Preview"
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-indigo)' }}
                    />
                    <span style={{ fontSize: '11.5px', color: 'var(--accent-emerald)', fontWeight: '600' }}>✓ Image uploaded</span>
                  </div>
                )}
              </div>

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">🎯</div>
                <div className="typebox-content">
                  <label htmlFor="teamEvent" className="typebox-label">Event</label>
                  <select
                    id="teamEvent"
                    value={teamEvent}
                    onChange={(e) => setTeamEvent(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Event --</option>
                    {events.map(evt => (
                      <option key={evt.id} value={evt.name}>
                        {evt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">👥</div>
                <div className="typebox-content">
                  <label htmlFor="otherMemberCount" className="typebox-label">Additional Members</label>
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
              </div>

              {otherMembers.length > 0 && (
                <div className="members-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', textAlign: 'left', marginLeft: '4px' }}>
                    Additional Member Names
                  </label>
                  {otherMembers.map((member, index) => (
                    <div key={index} className="pill-typebox-wrapper fade-in-list">
                      <div className="typebox-left-icon">👤</div>
                      <div className="typebox-content">
                        <label className="typebox-label">Member #{index + 2} Name</label>
                        <input
                          type="text"
                          value={member}
                          onChange={(e) => handleOtherMemberNameChange(index, e.target.value)}
                          placeholder={`Enter Member #${index + 2} Full Name`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="btn btn-pill-action btn-block">
                <span className="btn-icon-sq">✨</span>
                <span className="btn-text-main">Register Team & Generate QR</span>
                <span className="btn-arrow-right">→</span>
              </button>

              <div className="card-footer-links">
                <button type="button" onClick={() => { setIsRegistering(false); setIsForgotPassword(false); }} className="footer-link-btn">
                  <span>←</span> Back to Login
                </button>
              </div>
            </form>
          </div>
          <div className="secure-badge-note">
            <span>🛡️</span> Secure Portal • Your data is protected with enterprise-grade security
          </div>
        </div>
      );
    }
    
    if (isForgotPassword) {
      return (
        <div className="fade-in">
          <div className="glass-panel registration-box">
            <div className="card-top-icon-circle">
              <span>🔑</span>
            </div>
            <div className="panel-header">
              <span className="accent-badge-pill">— FORGOT PASSWORD —</span>
              <h2>Retrieve Registration No.</h2>
              <p>Enter the details below and get the unique code from the Admin page to retrieve your login password.</p>
            </div>

            <form onSubmit={handleForgotPassword} className="registration-form">
              {fpError && <div className="error-message alert-pop">{fpError}</div>}
              {fpSuccessMessage && <div className="success-message alert-pop" style={{ color: 'var(--accent-emerald)' }}>{fpSuccessMessage}</div>}

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">👥</div>
                <div className="typebox-content">
                  <label htmlFor="fpTeamName" className="typebox-label">Team Name</label>
                  <input
                    id="fpTeamName"
                    type="text"
                    value={fpTeamName}
                    onChange={(e) => setFpTeamName(e.target.value)}
                    placeholder="Enter registered Team Name"
                    required
                  />
                </div>
              </div>

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">👤</div>
                <div className="typebox-content">
                  <label htmlFor="fpLeaderName" className="typebox-label">Team Leader Full Name</label>
                  <input
                    id="fpLeaderName"
                    type="text"
                    value={fpLeaderName}
                    onChange={(e) => setFpLeaderName(e.target.value)}
                    placeholder="Enter team leader's name"
                    required
                  />
                </div>
              </div>

              <div className="pill-typebox-wrapper">
                <div className="typebox-left-icon">🔑</div>
                <div className="typebox-content">
                  <label htmlFor="fpUniqueCode" className="typebox-label">Unique Code</label>
                  <input
                    id="fpUniqueCode"
                    type="text"
                    value={fpUniqueCode}
                    onChange={(e) => setFpUniqueCode(e.target.value)}
                    placeholder="Get unique code from Admin"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-pill-action btn-block">
                <span className="btn-icon-sq">🔓</span>
                <span className="btn-text-main">Retrieve Registration Number</span>
                <span className="btn-arrow-right">→</span>
              </button>

              <div className="card-footer-links">
                <button type="button" onClick={() => setIsForgotPassword(false)} className="footer-link-btn">
                  <span>←</span> Back to Login
                </button>
              </div>
            </form>
          </div>
          <div className="secure-badge-note">
            <span>🛡️</span> Secure Portal • Your data is protected with enterprise-grade security
          </div>
        </div>
      );
    }

    // Default View: Student Login (Exact match to Mockup Image)
    return (
      <div className="fade-in">
        <div className="glass-panel registration-box">
          <div className="card-top-icon-circle">
            <span>🎓</span>
          </div>
          <div className="panel-header">
            <span className="accent-badge-pill">— STUDENT LOGIN —</span>
            <h2>Access Team Dashboard</h2>
            <p>Log in with your Team Name and Team Leader's Registration Number.</p>
          </div>

          <form onSubmit={handleLogin} className="registration-form">
            {loginError && <div className="error-message alert-pop">{loginError}</div>}

            <div className="pill-typebox-wrapper">
              <div className="typebox-left-icon">👥</div>
              <div className="typebox-content">
                <label htmlFor="loginTeamName" className="typebox-label">Team Name</label>
                <input
                  id="loginTeamName"
                  type="text"
                  value={loginTeamName}
                  onChange={(e) => setLoginTeamName(e.target.value)}
                  placeholder="Enter registered Team Name"
                  required
                />
              </div>
              <div className="typebox-right-icon">🪪</div>
            </div>

            <div className="pill-typebox-wrapper">
              <div className="typebox-left-icon">🔒</div>
              <div className="typebox-content">
                <label htmlFor="loginLeaderRegNo" className="typebox-label">Leader Registration Number</label>
                <input
                  id="loginLeaderRegNo"
                  type={showStudentPassword ? 'text' : 'password'}
                  value={loginLeaderRegNo}
                  onChange={(e) => setLoginLeaderRegNo(e.target.value)}
                  placeholder="Enter leader registration number as password"
                  required
                />
              </div>
              <button 
                type="button" 
                onClick={() => setShowStudentPassword(!showStudentPassword)} 
                className="typebox-right-btn"
                title="Toggle password visibility"
              >
                {showStudentPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <button type="submit" className="btn btn-pill-action btn-block">
              <span className="btn-icon-sq">🔒</span>
              <span className="btn-text-main">Login to Dashboard</span>
              <span className="btn-arrow-right">→</span>
            </button>

            <div className="card-footer-links">
              <button 
                type="button" 
                onClick={() => setIsForgotPassword(true)} 
                className="footer-link-btn"
              >
                <span>🔗</span> Forgot Password?
              </button>
              
              <span className="footer-link-divider">|</span>
              
              <button 
                type="button" 
                onClick={() => { setIsRegistering(true); setIsForgotPassword(false); }} 
                className="footer-link-btn"
              >
                <span>👥+</span> Register Your Team
              </button>
            </div>
          </form>
        </div>

        <div className="secure-badge-note">
          <span>🛡️</span> Secure Portal • Your data is protected with enterprise-grade security
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
            <div className="profile-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img
                src={currentTeam.leaderPhoto || currentTeam.leader_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f59e0b' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
                alt="Leader"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--accent-tech)'
                }}
              />
              <div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span className="team-id-badge">{currentTeam.id}</span>
                  {currentTeam.event && <span className="accent-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-tech)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>{currentTeam.event}</span>}
                </div>
                <h2>{currentTeam.name}</h2>
              </div>
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
