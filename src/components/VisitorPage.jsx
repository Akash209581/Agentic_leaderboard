import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  registerVisitor, 
  loginVisitor,
  registerFaculty, 
  loginFaculty, 
  initiateScan 
} from '../utils/db';

export default function VisitorPage({ teams, visitors, faculty, scans, pointsActive = true, isInitialLoading = false }) {
  // Portal toggle: 'visitor' or 'faculty'
  const [userRole, setUserRole] = useState('visitor');
  
  // Auth state
  const [currentUserId, setCurrentUserId] = useState(() => sessionStorage.getItem('current_user_id') || null);
  const [currentUserRole, setCurrentUserRole] = useState(() => sessionStorage.getItem('current_user_role') || null);

  const currentUser = currentUserRole === 'visitor'
    ? visitors.find(v => v.id === currentUserId)
    : faculty.find(f => f.id === currentUserId);

  // Student Visitor Login & Register Form State
  const [visName, setVisName] = useState('');
  const [visMobile, setVisMobile] = useState('');
  const [visPassword, setVisPassword] = useState('');
  const [showVisPassword, setShowVisPassword] = useState(false);
  const [visIsRegistering, setVisIsRegistering] = useState(false);
  const [visError, setVisError] = useState('');
  const [isDuplicateVis, setIsDuplicateVis] = useState(false);

  // Faculty Register & Login State
  const [facId, setFacId] = useState('');
  const [facName, setFacName] = useState('');
  const [facPassword, setFacPassword] = useState('');
  const [facConfirmPassword, setFacConfirmPassword] = useState('');
  const [showFacPassword, setShowFacPassword] = useState(false);
  const [facIsRegistering, setFacIsRegistering] = useState(false);
  const [facError, setFacError] = useState('');
  const [isDuplicateFac, setIsDuplicateFac] = useState(false);

  // Scan Action State
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [manualTeamId, setManualTeamId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanPendingRecord, setScanPendingRecord] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanSuccessPoints, setScanSuccessPoints] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [showCameraPrompt, setShowCameraPrompt] = useState(false);

  // Clear errors when toggling roles or sub-screens
  useEffect(() => {
    setVisError('');
    setFacError('');
    setIsDuplicateVis(false);
    setIsDuplicateFac(false);
    setVisName('');
    setVisMobile('');
    setVisPassword('');
    setFacId('');
    setFacName('');
    setFacPassword('');
    setFacConfirmPassword('');
  }, [userRole, visIsRegistering, facIsRegistering]);

  // HTML5 Camera QR Code Scanner Hook
  useEffect(() => {
    let html5QrCode = null;

    if (cameraActive) {
      setScanError('');
      html5QrCode = new Html5Qrcode("qr-camera-view");

      const config = { 
        fps: 10, 
        qrbox: (width, height) => {
          const size = Math.min(width, height) * 0.75;
          return { width: size, height: size };
        }
      };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
          handleScanTeam(decodedText);
          setCameraActive(false);
        },
        () => {
          // Silent catch for frames
        }
      ).catch(err => {
        console.error("Camera start failure: ", err);
        setScanError(`Camera Error: ${err.message || 'Could not open camera.'}`);
        setCameraActive(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop()
          .catch(err => console.error("Error shutting down camera scanner:", err));
      }
    };
  }, [cameraActive]);

  // Sync scan pending validation
  useEffect(() => {
    if (scanPendingRecord) {
      const currentScan = scans.find(s => s.id === scanPendingRecord.id);
      if (currentScan) {
        if (currentScan.status === 'approved') {
          setScanPendingRecord(null);
          setIsScanning(false);
          setScanSuccessPoints(true);
          setSelectedTeamId('');
          setManualTeamId('');
          setTimeout(() => {
            setScanSuccessPoints(false);
          }, 3000);
        } else if (currentScan.status === 'rejected') {
          setScanPendingRecord(null);
          setIsScanning(false);
          setScanError('Scan request was rejected by the student team.');
        }
      }
    }
  }, [scans, scanPendingRecord]);

  // Student Visitor Registration Submit
  const handleVisitorRegister = async (e) => {
    e.preventDefault();
    setVisError('');
    setIsDuplicateVis(false);

    if (!visName.trim() || !visMobile.trim() || !visPassword) {
      setVisError('All fields are required.');
      return;
    }

    if (visMobile.trim().length !== 10) {
      setVisError('Mobile number must be exactly 10 digits.');
      return;
    }

    try {
      const user = await registerVisitor(visName.trim(), visMobile.trim(), visPassword);
      if (user && user.id) {
        setCurrentUserId(user.id);
        setCurrentUserRole('visitor');
        sessionStorage.setItem('current_user_role', 'visitor');
        sessionStorage.setItem('current_user_id', user.id);
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_user_id');
      } else {
        throw new Error(user.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already registered')) {
        setIsDuplicateVis(true);
        setVisError('This mobile number is already registered! Please log in with your existing password.');
      } else {
        setVisError(msg);
      }
    }
  };

  // Student Visitor Login Submit
  const handleVisitorLogin = async (e) => {
    e.preventDefault();
    setVisError('');
    setIsDuplicateVis(false);

    if (!visMobile.trim() || !visPassword) {
      setVisError('Mobile number and password are required.');
      return;
    }

    try {
      const user = await loginVisitor(visMobile.trim(), visPassword);
      if (user && user.id) {
        setCurrentUserId(user.id);
        setCurrentUserRole('visitor');
        sessionStorage.setItem('current_user_role', 'visitor');
        sessionStorage.setItem('current_user_id', user.id);
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_user_id');
      } else {
        throw new Error(user.error || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setVisError(err.message);
    }
  };

  // Faculty Register Submit
  const handleFacultyRegister = async (e) => {
    e.preventDefault();
    setFacError('');
    setIsDuplicateFac(false);

    if (!facId.trim() || !facName.trim() || !facPassword) {
      setFacError('All fields are required.');
      return;
    }

    if (facPassword !== facConfirmPassword) {
      setFacError('Passwords do not match.');
      return;
    }

    try {
      const user = await registerFaculty(facId.trim(), facName.trim(), facPassword);
      if (user && user.id) {
        setCurrentUserId(user.id);
        setCurrentUserRole('faculty');
        sessionStorage.setItem('current_user_role', 'faculty');
        sessionStorage.setItem('current_user_id', user.id);
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_user_id');
      } else {
        throw new Error(user.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already registered')) {
        setIsDuplicateFac(true);
        setFacError('This Faculty ID is already registered! Please log in with your existing password.');
      } else {
        setFacError(msg);
      }
    }
  };

  // Faculty Login Submit
  const handleFacultyLogin = async (e) => {
    e.preventDefault();
    setFacError('');
    setIsDuplicateFac(false);

    if (!facId.trim() || !facPassword) {
      setFacError('Faculty ID and password are required.');
      return;
    }

    try {
      const user = await loginFaculty(facId.trim(), facPassword);
      if (user && user.id) {
        setCurrentUserId(user.id);
        setCurrentUserRole('faculty');
        sessionStorage.setItem('current_user_role', 'faculty');
        sessionStorage.setItem('current_user_id', user.id);
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_user_id');
      } else {
        throw new Error(user.error || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setFacError(err.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('current_user_role');
    sessionStorage.removeItem('current_user_id');
    localStorage.removeItem('current_user_role');
    localStorage.removeItem('current_user_id');
    setCurrentUserId(null);
    setCurrentUserRole(null);
    setScanPendingRecord(null);
    setIsScanning(false);
    setScanError('');
  };

  // Initiate QR scan simulation
  const handleScanTeam = async (teamIdInput) => {
    setScanError('');

    if (!pointsActive) {
      setScanError('Point allocation is currently STOPPED by Administrator. QR scanning is temporarily paused.');
      return;
    }

    const targetTeamId = teamIdInput.trim().toUpperCase();

    if (!targetTeamId) {
      setScanError('Please select or enter a Team ID.');
      return;
    }

    const matchedTeam = teams.find(t => t.id === targetTeamId);
    if (!matchedTeam) {
      setScanError(`Team ID ${targetTeamId} not found in the database.`);
      return;
    }

    try {
      setIsScanning(true);
      const scanRecord = await initiateScan(
        targetTeamId,
        currentUser.id,
        currentUser.name,
        currentUserRole
      );
      setScanPendingRecord(scanRecord);
    } catch (err) {
      setIsScanning(false);
      setScanError(err.message);
    }
  };

  // Scan History for current visitor/faculty
  const myHistory = currentUser
    ? scans
        .filter(s => s.scannerId === currentUser.id && s.status === 'approved')
        .sort((a, b) => b.approvedAt - a.approvedAt)
    : [];

  // Show clean loading state during initial sync if user was previously signed in
  if (isInitialLoading && currentUserId && !currentUser) {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="spinner" style={{ margin: '0 auto 16px auto', width: '36px', height: '36px' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Connecting to session...</p>
      </div>
    );
  }

  // --- Auth Pages (Unauthenticated) ---
  if (!currentUser) {
    return (
      <div className="fade-in">
        {/* Modern Floating Segmented Sub-Tabs */}
        <div className="segmented-tabs-wrapper">
          <div className="segmented-tab-container">
            <button 
              type="button"
              className={`segmented-tab-btn ${userRole === 'visitor' ? 'active' : ''}`}
              onClick={() => setUserRole('visitor')}
            >
              <span className="seg-tab-icon">🎟️</span>
              <span>Student Visitor</span>
            </button>
            <button 
              type="button"
              className={`segmented-tab-btn ${userRole === 'faculty' ? 'active' : ''}`}
              onClick={() => setUserRole('faculty')}
            >
              <span className="seg-tab-icon">🎓</span>
              <span>Faculty Portal</span>
            </button>
          </div>
        </div>

        {/* Student Visitor Portal */}
        {userRole === 'visitor' && (
          <div className="glass-panel registration-box fade-in-tab">
            <div className="card-top-icon-circle">
              <span>👤🪪</span>
            </div>
            <div className="panel-header">
              <span className="accent-badge-pill">— STUDENT VISITOR SIGN-IN —</span>
              <h2>Student Visitor Dashboard</h2>
              <p>Log in or sign up to scan student team QR codes and earn points.</p>
            </div>

            {visError && (
              <div className="error-message alert-pop" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span>{visError}</span>
                {isDuplicateVis && (
                  <button
                    type="button"
                    onClick={() => {
                      setVisIsRegistering(false);
                      setVisError('');
                      setIsDuplicateVis(false);
                    }}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 12px', alignSelf: 'center', background: '#ffffff', color: '#dc2626' }}
                  >
                    👉 Click Here to Sign In Instead
                  </button>
                )}
              </div>
            )}

            {visIsRegistering ? (
              <form onSubmit={handleVisitorRegister} className="registration-form">
                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">👤</div>
                  <div className="typebox-content">
                    <label htmlFor="visName" className="typebox-label">Full Name</label>
                    <input
                      id="visName"
                      type="text"
                      value={visName}
                      onChange={(e) => setVisName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">📱</div>
                  <div className="typebox-content">
                    <label htmlFor="visMobile" className="typebox-label">Mobile Number</label>
                    <input
                      id="visMobile"
                      type="tel"
                      maxLength="10"
                      value={visMobile}
                      onChange={(e) => setVisMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 10-digit mobile number"
                      required
                    />
                  </div>
                  <div className="typebox-right-icon">🪪</div>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🔒</div>
                  <div className="typebox-content">
                    <label htmlFor="visPassword" className="typebox-label">Password</label>
                    <input
                      id="visPassword"
                      type={showVisPassword ? 'text' : 'password'}
                      value={visPassword}
                      onChange={(e) => setVisPassword(e.target.value)}
                      placeholder="Create a secure password"
                      required
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowVisPassword(!showVisPassword)} 
                    className="typebox-right-btn"
                    title="Toggle password visibility"
                  >
                    {showVisPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                <button type="submit" className="btn btn-pill-action btn-block">
                  <span className="btn-icon-sq">✨</span>
                  <span className="btn-text-main">Create Visitor Account</span>
                  <span className="btn-arrow-right">→</span>
                </button>

                <div className="card-divider-text">
                  <span>Already registered?</span>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setVisIsRegistering(false)}
                    className="link-create-account"
                  >
                    Sign In Here →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVisitorLogin} className="registration-form">
                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">📱</div>
                  <div className="typebox-content">
                    <label htmlFor="visMobileLogin" className="typebox-label">Mobile Number</label>
                    <input
                      id="visMobileLogin"
                      type="tel"
                      maxLength="10"
                      value={visMobile}
                      onChange={(e) => setVisMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter registered mobile number"
                      required
                    />
                  </div>
                  <div className="typebox-right-icon">🪪</div>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🔒</div>
                  <div className="typebox-content">
                    <label htmlFor="visPasswordLogin" className="typebox-label">Password</label>
                    <input
                      id="visPasswordLogin"
                      type={showVisPassword ? 'text' : 'password'}
                      value={visPassword}
                      onChange={(e) => setVisPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowVisPassword(!showVisPassword)} 
                    className="typebox-right-btn"
                    title="Toggle password visibility"
                  >
                    {showVisPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                <button type="submit" className="btn btn-pill-action btn-block">
                  <span className="btn-icon-sq">📷</span>
                  <span className="btn-text-main">Login & Start Scanning</span>
                  <span className="btn-arrow-right">→</span>
                </button>

                <div className="card-divider-text">
                  <span>New visitor student?</span>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setVisIsRegistering(true)}
                    className="link-create-account"
                  >
                    Create Account Here →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Faculty Portal */}
        {userRole === 'faculty' && (
          <div className="glass-panel registration-box fade-in-tab">
            <div className="card-top-icon-circle">
              <span>🎓</span>
            </div>
            <div className="panel-header">
              <span className="accent-badge-pill">— FACULTY PORTAL —</span>
              <h2>{facIsRegistering ? 'Faculty Account Creation' : 'Faculty Sign-In'}</h2>
              <p>Access scanner to validate student hackathon team QR codes and distribute points.</p>
            </div>

            {facError && (
              <div className="error-message alert-pop" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span>{facError}</span>
                {isDuplicateFac && (
                  <button
                    type="button"
                    onClick={() => {
                      setFacIsRegistering(false);
                      setFacError('');
                      setIsDuplicateFac(false);
                    }}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 12px', alignSelf: 'center', background: '#ffffff', color: '#dc2626' }}
                  >
                    👉 Click Here to Sign In Instead
                  </button>
                )}
              </div>
            )}

            {facIsRegistering ? (
              <form onSubmit={handleFacultyRegister} className="registration-form">
                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🪪</div>
                  <div className="typebox-content">
                    <label htmlFor="facId" className="typebox-label">Faculty ID (Unique)</label>
                    <input
                      id="facId"
                      type="text"
                      value={facId}
                      onChange={(e) => setFacId(e.target.value)}
                      placeholder="Enter Faculty ID"
                      required
                    />
                  </div>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">👤</div>
                  <div className="typebox-content">
                    <label htmlFor="facName" className="typebox-label">Full Name</label>
                    <input
                      id="facName"
                      type="text"
                      value={facName}
                      onChange={(e) => setFacName(e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🔒</div>
                  <div className="typebox-content">
                    <label htmlFor="facPassword" className="typebox-label">Password</label>
                    <input
                      id="facPassword"
                      type={showFacPassword ? 'text' : 'password'}
                      value={facPassword}
                      onChange={(e) => setFacPassword(e.target.value)}
                      placeholder="Create password"
                      required
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowFacPassword(!showFacPassword)} 
                    className="typebox-right-btn"
                  >
                    {showFacPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🔒</div>
                  <div className="typebox-content">
                    <label htmlFor="facConfirmPassword" className="typebox-label">Confirm Password</label>
                    <input
                      id="facConfirmPassword"
                      type={showFacPassword ? 'text' : 'password'}
                      value={facConfirmPassword}
                      onChange={(e) => setFacConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-pill-action btn-block">
                  <span className="btn-icon-sq">🎓</span>
                  <span className="btn-text-main">Register Faculty</span>
                  <span className="btn-arrow-right">→</span>
                </button>

                <div className="card-divider-text">
                  <span>Already registered?</span>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setFacIsRegistering(false)}
                    className="link-create-account"
                  >
                    Sign In Here →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleFacultyLogin} className="registration-form">
                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🪪</div>
                  <div className="typebox-content">
                    <label htmlFor="facIdLogin" className="typebox-label">Faculty ID</label>
                    <input
                      id="facIdLogin"
                      type="text"
                      value={facId}
                      onChange={(e) => setFacId(e.target.value)}
                      placeholder="Enter Faculty ID"
                      required
                    />
                  </div>
                </div>

                <div className="pill-typebox-wrapper">
                  <div className="typebox-left-icon">🔒</div>
                  <div className="typebox-content">
                    <label htmlFor="facPasswordLogin" className="typebox-label">Password</label>
                    <input
                      id="facPasswordLogin"
                      type={showFacPassword ? 'text' : 'password'}
                      value={facPassword}
                      onChange={(e) => setFacPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowFacPassword(!showFacPassword)} 
                    className="typebox-right-btn"
                  >
                    {showFacPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                <button type="submit" className="btn btn-pill-action btn-block">
                  <span className="btn-icon-sq">📷</span>
                  <span className="btn-text-main">Login & Start Evaluation</span>
                  <span className="btn-arrow-right">→</span>
                </button>

                <div className="card-divider-text">
                  <span>New faculty member?</span>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setFacIsRegistering(true)}
                    className="link-create-account"
                  >
                    Register Faculty Account →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Dashboard View (Authenticated) ---
  return (
    <div className="visitor-dashboard fade-in">
      {/* Scan Code Overlay */}
      {scanPendingRecord && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel scan-pending-modal alert-pop">
            <div className="modal-header pulse-glow">
              <div className="live-dot-container">
                <span className="live-dot yellow"></span>
              </div>
              <span className="accent-badge">SCAN INITIATED</span>
              <h3>Verification Code</h3>
            </div>
            <div className="modal-body">
              <p>
                Verification code generated for team: <strong>{scanPendingRecord.teamId}</strong>
              </p>
              
              <div className="otp-display-box">
                <span className="otp-label">🔑 GIVE THIS CODE TO THE STUDENTS</span>
                <div className="otp-digits-row">
                  {String(scanPendingRecord.code).split('').map((digit, idx) => (
                    <span key={idx} className="otp-digit-card">{digit}</span>
                  ))}
                </div>
                <p className="otp-helper-text">Students must enter this 4-digit code on their device to approve points.</p>
              </div>

              <div className="waiting-spinner-container">
                <div className="spinner"></div>
                <p>Waiting for student approval...</p>
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  onClick={() => {
                    setScanPendingRecord(null);
                    setIsScanning(false);
                  }} 
                  className="btn btn-outline btn-block"
                >
                  Cancel Scan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success points card overlay */}
      {scanSuccessPoints && (
        <div className="points-popup-overlay">
          <div className="points-popup success-glow pulse-glow">
            <span className="plus-points">+5</span>
            <span className="points-label">Scan Approved! Points Added.</span>
          </div>
        </div>
      )}

      {/* Pre-camera Confirmation Modal */}
      {showCameraPrompt && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel alert-pop" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-icon-badge">📷</div>
              <span className="accent-badge">HARDWARE ACCESS</span>
              <h3>Allow Camera Access?</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
                Agentic AI Day requires access to your device camera to scan student registration QR codes and process scan validation.
              </p>
              <div className="modal-actions">
                <button 
                  type="button"
                  onClick={() => setShowCameraPrompt(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowCameraPrompt(false);
                    setCameraActive(true);
                  }} 
                  className="btn btn-primary"
                >
                  Allow Camera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="student-dashboard-container">
        {/* Left Column: Visitor Profile & Score */}
        <div className="dashboard-sidebar-card glass-panel">
          <div className="profile-hero-section">
            <div className="profile-photo-wrapper">
              <div className="profile-leader-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                {currentUserRole === 'visitor' ? '🎟️' : '🎓'}
              </div>
              <span className="leader-crown-badge">{currentUserRole === 'visitor' ? '⭐' : '🏛️'}</span>
            </div>

            <div className="profile-info-block">
              <div className="profile-badges-row">
                <span className={`scanner-type-pill ${currentUserRole}`}>
                  {currentUserRole === 'visitor' ? 'STUDENT VISITOR' : 'FACULTY'}
                </span>
                <span className="badge-team-id">{currentUser.id}</span>
              </div>
              <h2 className="profile-team-name">{currentUser.name}</h2>
              {currentUser.mobile && (
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                  📱 {currentUser.mobile}
                </span>
              )}
            </div>
          </div>

          {/* Glowing Points Banner */}
          <div className="points-display-banner">
            <div className="points-banner-glow"></div>
            <div className="points-banner-content">
              <span className="points-banner-title">⚡ YOUR SCAN REWARD POINTS</span>
              <div className="points-banner-num-row">
                <span className="points-big-num">{currentUser.points || 0}</span>
                <span className="points-unit-tag">PTS</span>
              </div>
              <span className="points-live-status">● +5 Points Per Verified Team Scan</span>
            </div>
          </div>

          {/* Quick Guide */}
          <div className="team-members-block">
            <div className="members-block-header">
              <span>🎯 How Scanning Works</span>
            </div>
            <div className="members-pill-list">
              <div className="member-pill-tile">
                <div className="member-pill-avatar">1</div>
                <span className="member-pill-name">Scan or select any student team's QR</span>
              </div>
              <div className="member-pill-tile">
                <div className="member-pill-avatar">2</div>
                <span className="member-pill-name">A 4-digit code will appear on your screen</span>
              </div>
              <div className="member-pill-tile">
                <div className="member-pill-avatar">3</div>
                <span className="member-pill-name">Give code to team leader to collect <strong>+5 PTS</strong></span>
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn-logout-pill">
            <span>🔒</span>
            <span>Logout Portal</span>
          </button>
        </div>

        {/* Right Column: QR Scanner & Scan Feed */}
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
                  The Administrator has temporarily paused points scoring. You will be able to scan again once scoring is resumed.
                </p>
              </div>
            </div>
          )}

          {/* Scanner Interactive Card */}
          <div className="qr-presentation-card glass-panel">
            <div className="panel-header-inline">
              <div className="panel-header-icon-box">
                <span>📷</span>
              </div>
              <div>
                <h3>Scan Team QR Code</h3>
                <p>Scan a team's code to reward them (+10 pts) and earn 5 points for yourself.</p>
              </div>
            </div>

            {scanError && <div className="error-message alert-pop" style={{ marginBottom: '16px' }}>{scanError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Primary Camera Button */}
              <button 
                onClick={() => {
                  if (cameraActive) {
                    setCameraActive(false);
                  } else {
                    setShowCameraPrompt(true);
                  }
                }}
                className="btn btn-pill-action"
                style={{
                  background: !pointsActive
                    ? '#94a3b8'
                    : cameraActive 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                      : 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)'
                }}
                disabled={isScanning || !pointsActive}
              >
                <span className="btn-icon-sq">{!pointsActive ? '⏸️' : cameraActive ? '🛑' : '📷'}</span>
                <span className="btn-text-main">
                  {!pointsActive ? 'Point Scanning Paused by Admin' : cameraActive ? 'Close Camera Scanner' : 'Launch Camera Scanner'}
                </span>
                <span className="btn-arrow-right">→</span>
              </button>

              {cameraActive && (
                <div className="network-warning-box" style={{ 
                  background: '#fef3c7', 
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  textAlign: 'left'
                }}>
                  ⚠️ <strong>Camera Tip:</strong> If the webcam doesn't open over local Wi-Fi, use the manual quick-select or ID options below.
                </div>
              )}

              {/* Camera view or Viewfinder Frame */}
              <div className="virtual-scanner-screen" style={{ minHeight: cameraActive ? '280px' : 'auto' }}>
                {cameraActive ? (
                  <div id="qr-camera-view" style={{ 
                    width: '100%', 
                    maxWidth: '380px', 
                    margin: '0 auto',
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: '2px solid #6366f1',
                    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.2)'
                  }}></div>
                ) : (
                  <div className="scanner-frame" style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', marginBottom: '4px' }}>📡</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '12px', fontWeight: '800', color: '#6366f1', letterSpacing: '1px' }}>
                      {isScanning ? 'TRANSMITTING SCAN DATA...' : 'READY FOR SCAN'}
                    </div>
                  </div>
                )}
              </div>

              {/* Option 1: Dropdown Selector */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '16px', textAlign: 'left' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                  Option 1: Quick Squad Selector
                </span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="pill-typebox-wrapper" style={{ flex: 1, minWidth: '220px', margin: 0 }}>
                    <div className="typebox-left-icon">👥</div>
                    <div className="typebox-content">
                      <label className="typebox-label">Select Registered Squad</label>
                      <select 
                        value={selectedTeamId} 
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                      >
                        <option value="">-- Choose Team --</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleScanTeam(selectedTeamId)}
                    className="btn btn-pill-action"
                    style={{ width: 'auto', padding: '10px 20px', marginTop: 0 }}
                    disabled={isScanning || !selectedTeamId}
                  >
                    <span>⚡ Scan Squad</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Manual Text Input */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '16px', textAlign: 'left' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                  Option 2: Scan by Team ID
                </span>
                <form onSubmit={(e) => { e.preventDefault(); handleScanTeam(manualTeamId); }} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="pill-typebox-wrapper" style={{ flex: 1, minWidth: '220px', margin: 0 }}>
                    <div className="typebox-left-icon">🪪</div>
                    <div className="typebox-content">
                      <label className="typebox-label">Team ID Number</label>
                      <input 
                        type="text" 
                        value={manualTeamId}
                        onChange={(e) => setManualTeamId(e.target.value)}
                        placeholder="Enter Team ID (e.g. T-1001)"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-pill-action"
                    style={{ width: 'auto', padding: '10px 20px', marginTop: 0 }}
                    disabled={isScanning || !manualTeamId}
                  >
                    <span>⚡ Scan ID</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="scan-history-card glass-panel">
            <div className="panel-header-inline">
              <div className="panel-header-icon-box history">
                <span>📜</span>
              </div>
              <div>
                <h3>Your Verified Scan Log</h3>
                <p>Teams you have successfully scanned and awarded points to.</p>
              </div>
            </div>

            <div className="scan-history-feed">
              {myHistory.length === 0 ? (
                <div className="empty-history-state">
                  <div className="empty-icon-circle">📡</div>
                  <h4>No Scans Yet</h4>
                  <p>Scan your first student team above to collect reward points!</p>
                </div>
              ) : (
                myHistory.map((scan) => {
                  const teamObj = teams.find(t => t.id === scan.teamId);
                  return (
                    <div key={scan.id} className="scan-feed-item fade-in-list">
                      <div className="scan-feed-avatar">
                        👥
                      </div>
                      <div className="scan-feed-details">
                        <div className="scan-feed-top-row">
                          <span className="scanner-name-text">{teamObj?.name || scan.teamId}</span>
                          <span className="badge-team-id">{scan.teamId}</span>
                        </div>
                        <span className="scan-timestamp-text">
                          🕒 {new Date(scan.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • Awarded
                        </span>
                      </div>
                      <div className="scan-points-badge">
                        +5 PTS
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
