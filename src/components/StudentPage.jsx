import React, { useState, useEffect } from 'react';
import { registerTeam, loginTeam, approveScan, rejectScan, forgotPasswordTeam } from '../utils/db';

export default function StudentPage({ teams, scans, events = [], pointsActive = true, isInitialLoading = false }) {
  const [currentTeamId, setCurrentTeamId] = useState(() => {
    return sessionStorage.getItem('current_student_team_id') || null;
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
  const [dismissedScanIds, setDismissedScanIds] = useState([]);
  const [optimisticBonus, setOptimisticBonus] = useState(0);

  // Reset optimistic bonus when server points update
  useEffect(() => {
    setOptimisticBonus(0);
  }, [currentTeam?.points]);

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

  const availableEvents = (events && events.length > 0)
    ? events
    : [{ id: 'default-1', name: 'Agentic AI Day' }];

  // Default to first event if not set
  useEffect(() => {
    if (!teamEvent && availableEvents.length > 0) {
      setTeamEvent(availableEvents[0].name);
    }
  }, [events, teamEvent, availableEvents]);

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

  const [isRegisteringLoading, setIsRegisteringLoading] = useState(false);

  const compressImage = (file, maxWidth = 600, maxHeight = 600, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image for compression.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoChange = async (e) => {
    setPhotoError('');
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image size should be less than 5MB.');
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setLeaderPhoto(compressedDataUrl);
    } catch (err) {
      setPhotoError('Failed to process image file.');
    }
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

    setIsRegisteringLoading(true);
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
      if (team && team.id) {
        setCurrentTeamId(team.id);
        sessionStorage.setItem('current_student_team_id', team.id);
        localStorage.removeItem('current_student_team_id');
      } else {
        throw new Error(team.error || 'Team registration failed. Please try again.');
      }
    } catch (err) {
      setRegisterError(err.message);
    } finally {
      setIsRegisteringLoading(false);
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
      if (team && team.id) {
        setCurrentTeamId(team.id);
        sessionStorage.setItem('current_student_team_id', team.id);
        localStorage.removeItem('current_student_team_id');
      } else {
        throw new Error(team.error || 'Invalid credentials.');
      }
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('current_student_team_id');
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
      if (team && team.id) {
        setCurrentTeamId(team.id);
        sessionStorage.setItem('current_student_team_id', team.id);
        localStorage.removeItem('current_student_team_id');
      }
      
      // Reset FP states just in case
      setIsForgotPassword(false);
      setFpTeamName('');
      setFpLeaderName('');
      setFpUniqueCode('');
    } catch (err) {
      setFpError(err.message);
    }
  };

  // Find latest pending scan for this team accurately (ignoring stale scans older than 3 mins and dismissed scans)
  const pendingScans = currentTeam
    ? scans
        .filter(s => 
          s.teamId === currentTeam.id && 
          s.status === 'pending' && 
          (!s.timestamp || Date.now() - s.timestamp < 180000) &&
          !dismissedScanIds.includes(s.id)
        )
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    : [];
  const pendingScan = pendingScans[0] || null;

  const executeApprove = async (codeToVerify, targetScan) => {
    const scanToApprove = targetScan || pendingScan;
    if (!scanToApprove) return;

    const trimmedCode = (codeToVerify || '').trim();
    if (!trimmedCode) {
      setApprovalError('Please enter the 4-digit code.');
      return;
    }

    if (!pointsActive) {
      setApprovalError('Point allocation is currently STOPPED by Administrator.');
      return;
    }

    const targetScanId = scanToApprove.id;

    // 1. Immediately dismiss modal so entry card vanishes instantly
    setDismissedScanIds(prev => [...prev, targetScanId]);
    // 2. Immediately award optimistic points (+10)
    setOptimisticBonus(prev => prev + 10);
    // 3. Immediately show points celebration
    setApprovalSuccess(true);
    setVerifyCode('');
    setApprovalError('');

    try {
      const result = await approveScan(currentTeam.id, trimmedCode);
      if (result.success) {
        setTimeout(() => {
          setApprovalSuccess(false);
        }, 2500);
      }
    } catch (err) {
      // Revert optimistic actions on error
      setDismissedScanIds(prev => prev.filter(id => id !== targetScanId));
      setOptimisticBonus(prev => Math.max(0, prev - 10));
      setApprovalSuccess(false);
      setApprovalError(err.message || 'Invalid verification code.');
    }
  };

  const handleVerifyCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setVerifyCode(val);
    setApprovalError('');
    if (val.length === 4) {
      executeApprove(val, pendingScan);
    }
  };

  const handleApprove = (e) => {
    e.preventDefault();
    if (verifyCode.trim().length === 4) {
      executeApprove(verifyCode, pendingScan);
    } else {
      setApprovalError('Please enter all 4 digits of the code.');
    }
  };

  const handleReject = async () => {
    if (pendingScan) {
      const scanId = pendingScan.id;
      setDismissedScanIds(prev => [...prev, scanId]);
      try {
        await rejectScan(scanId);
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

  // Show clean loading state during initial sync if student was previously signed in
  if (isInitialLoading && currentTeamId && !currentTeam) {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="spinner" style={{ margin: '0 auto 16px auto', width: '36px', height: '36px' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Connecting to team dashboard...</p>
      </div>
    );
  }

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
                    {availableEvents.map(evt => (
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

              {registerError && (
                <div className="error-message alert-pop" style={{ marginTop: '8px', marginBottom: '8px' }}>
                  {registerError}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isRegisteringLoading} 
                className="btn btn-pill-action btn-block"
                style={{ opacity: isRegisteringLoading ? 0.75 : 1, cursor: isRegisteringLoading ? 'wait' : 'pointer' }}
              >
                <span className="btn-icon-sq">{isRegisteringLoading ? '⏳' : '✨'}</span>
                <span className="btn-text-main">
                  {isRegisteringLoading ? 'Registering Team & Generating QR...' : 'Register Team & Generate QR'}
                </span>
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
              <span className="accent-badge">LIVE SCAN REQUEST</span>
              <h3>Incoming Approval!</h3>
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
                    onChange={handleVerifyCodeChange}
                    placeholder="••••"
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

      <div className="student-dashboard-container">
        {/* Left Column: Team Profile & Points */}
        <div className="dashboard-sidebar-card glass-panel">
          <div className="profile-hero-section">
            <div className="profile-photo-wrapper">
              <img
                src={currentTeam.leaderPhoto || currentTeam.leader_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
                alt="Leader"
                className="profile-leader-img"
              />
              <span className="leader-crown-badge">👑</span>
            </div>

            <div className="profile-info-block">
              <div className="profile-badges-row">
                <span className="badge-team-id">{currentTeam.id}</span>
                {currentTeam.event && <span className="badge-event-tag">{currentTeam.event}</span>}
              </div>
              <h2 className="profile-team-name">{currentTeam.name}</h2>
            </div>
          </div>

          {/* Glowing Points Banner */}
          <div className="points-display-banner">
            <div className="points-banner-glow"></div>
            <div className="points-banner-content">
              <span className="points-banner-title">⚡ TOTAL POINTS EARNED</span>
              <div className="points-banner-num-row">
                <span className="points-big-num">{(currentTeam.points || 0) + optimisticBonus}</span>
                <span className="points-unit-tag">PTS</span>
              </div>
              <span className="points-live-status">● Live Real-Time Standings</span>
            </div>
          </div>

          {/* Members List */}
          <div className="team-members-block">
            <div className="members-block-header">
              <span>👥 Squad Members</span>
              <span className="members-count-pill">{currentTeam.members?.length || 0} Members</span>
            </div>
            <div className="members-pill-list">
              {currentTeam.members?.map((name, idx) => (
                <div key={idx} className="member-pill-tile">
                  <div className="member-pill-avatar">
                    {idx === 0 ? '👑' : '👤'}
                  </div>
                  <span className="member-pill-name">{name}</span>
                  {idx === 0 ? (
                    <span className="member-role-badge leader">Leader</span>
                  ) : (
                    <span className="member-role-badge member">Member</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleLogout} className="btn-logout-pill">
            <span>🔒</span>
            <span>Logout Team</span>
          </button>
        </div>

        {/* Right Column: QR Code Card & Scan History Card */}
        <div className="dashboard-main-content">
          {/* Points Paused Alert Banner */}
          {!pointsActive && (
            <div className="alert-pop" style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '16px',
              padding: '14px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>⏸️</span>
              <div>
                <strong style={{ color: '#dc2626', fontSize: '14px' }}>Points Allocation is Currently Paused</strong>
                <p style={{ margin: '2px 0 0 0', color: '#991b1b', fontSize: '12.5px' }}>
                  The Administrator has temporarily paused points scoring. Incoming scan approvals are currently on hold.
                </p>
              </div>
            </div>
          )}

          {/* QR Code Presentation Card */}
          <div className="qr-presentation-card glass-panel">
            <div className="panel-header-inline">
              <div className="panel-header-icon-box">
                <span>📱</span>
              </div>
              <div>
                <h3>Your Official Team QR Code</h3>
                <p>Present this QR code to visiting students & faculty to claim score points.</p>
              </div>
            </div>

            <div className="qr-interactive-stage">
              <div className="qr-frame-box">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt={`QR Code for ${currentTeam.id}`} className="qr-stage-image" />
                ) : (
                  <div className="qr-placeholder-box">Generating QR...</div>
                )}
                <div className="qr-stage-badge">
                  <span>🏷️</span>
                  <span>ID: <strong>{currentTeam.id}</strong></span>
                </div>
              </div>

              <div className="qr-instructions-box">
                <h4>How Points Work:</h4>
                <div className="instruction-step">
                  <span className="step-num">1</span>
                  <span>Visitor or Faculty scans your QR using their phone camera.</span>
                </div>
                <div className="instruction-step">
                  <span className="step-num">2</span>
                  <span>A popup appears on this screen asking for a 4-digit code.</span>
                </div>
                <div className="instruction-step">
                  <span className="step-num">3</span>
                  <span>Enter the code on their screen to instantly earn <strong>+10 points</strong>!</span>
                </div>
              </div>
            </div>
          </div>

          {/* History Panel */}
          <div className="scan-history-card glass-panel">
            <div className="panel-header-inline">
              <div className="panel-header-icon-box history">
                <span>📜</span>
              </div>
              <div>
                <h3>Live Scan Approvals & Audit Feed</h3>
                <p>Real-time log of verified scans approved by your team.</p>
              </div>
            </div>

            <div className="scan-history-feed">
              {myScanHistory.length === 0 ? (
                <div className="empty-history-state">
                  <div className="empty-icon-circle">📡</div>
                  <h4>No Scans Yet</h4>
                  <p>Invite visitors and faculty to scan your team's QR code!</p>
                </div>
              ) : (
                myScanHistory.map((scan) => (
                  <div key={scan.id} className="scan-feed-item fade-in-list">
                    <div className="scan-feed-avatar">
                      {scan.scannerType === 'visitor' ? '🎟️' : '🎓'}
                    </div>
                    <div className="scan-feed-details">
                      <div className="scan-feed-top-row">
                        <span className="scanner-name-text">{scan.scannerName}</span>
                        <span className={`scanner-type-pill ${scan.scannerType}`}>
                          {scan.scannerType === 'visitor' ? 'STUDENT VISITOR' : 'FACULTY'}
                        </span>
                      </div>
                      <span className="scan-timestamp-text">
                        🕒 {new Date(scan.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • Verified
                      </span>
                    </div>
                    <div className="scan-points-badge">
                      +10 PTS
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
