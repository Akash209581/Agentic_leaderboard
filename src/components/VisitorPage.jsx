import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  registerVisitor, 
  loginVisitor,
  registerFaculty, 
  loginFaculty, 
  initiateScan 
} from '../utils/db';

export default function VisitorPage({ teams, visitors, faculty, scans }) {
  // Portal toggle: 'visitor' or 'faculty'
  const [userRole, setUserRole] = useState('visitor');
  
  // Auth state
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('current_user_id') || null);
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('current_user_role') || null);

  const currentUser = currentUserRole === 'visitor'
    ? visitors.find(v => v.id === currentUserId)
    : faculty.find(f => f.id === currentUserId);

  // Student Visitor Login & Register Form State
  const [visName, setVisName] = useState('');
  const [visMobile, setVisMobile] = useState('');
  const [visPassword, setVisPassword] = useState('');
  const [visIsRegistering, setVisIsRegistering] = useState(false);
  const [visError, setVisError] = useState('');

  // Faculty Register & Login State
  const [facId, setFacId] = useState('');
  const [facName, setFacName] = useState('');
  const [facPassword, setFacPassword] = useState('');
  const [facConfirmPassword, setFacConfirmPassword] = useState('');
  const [facIsRegistering, setFacIsRegistering] = useState(false);
  const [facError, setFacError] = useState('');

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
      setCurrentUserId(user.id);
      setCurrentUserRole('visitor');
      localStorage.setItem('current_user_role', 'visitor');
      localStorage.setItem('current_user_id', user.id);
    } catch (err) {
      setVisError(err.message);
    }
  };

  // Student Visitor Login Submit
  const handleVisitorLogin = async (e) => {
    e.preventDefault();
    setVisError('');

    if (!visMobile.trim() || !visPassword) {
      setVisError('Mobile number and password are required.');
      return;
    }

    try {
      const user = await loginVisitor(visMobile.trim(), visPassword);
      setCurrentUserId(user.id);
      setCurrentUserRole('visitor');
      localStorage.setItem('current_user_role', 'visitor');
      localStorage.setItem('current_user_id', user.id);
    } catch (err) {
      setVisError(err.message);
    }
  };

  // Faculty Register Submit
  const handleFacultyRegister = async (e) => {
    e.preventDefault();
    setFacError('');

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
      setCurrentUserId(user.id);
      setCurrentUserRole('faculty');
      localStorage.setItem('current_user_role', 'faculty');
      localStorage.setItem('current_user_id', user.id);
    } catch (err) {
      setFacError(err.message);
    }
  };

  // Faculty Login Submit
  const handleFacultyLogin = async (e) => {
    e.preventDefault();
    setFacError('');

    if (!facId.trim() || !facPassword) {
      setFacError('Faculty ID and password are required.');
      return;
    }

    try {
      const user = await loginFaculty(facId.trim(), facPassword);
      setCurrentUserId(user.id);
      setCurrentUserRole('faculty');
      localStorage.setItem('current_user_role', 'faculty');
      localStorage.setItem('current_user_id', user.id);
    } catch (err) {
      setFacError(err.message);
    }
  };

  const handleLogout = () => {
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

  // --- Auth Pages (Unauthenticated) ---
  if (!currentUser) {
    return (
      <div className="fade-in">
        {/* Sub-tab navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${userRole === 'visitor' ? 'active' : ''}`}
            onClick={() => setUserRole('visitor')}
          >
            Student Visitor
          </button>
          <button 
            className={`tab-btn ${userRole === 'faculty' ? 'active' : ''}`}
            onClick={() => setUserRole('faculty')}
          >
            Faculty Portal
          </button>
        </div>

        {/* Student Visitor Portal */}
        {userRole === 'visitor' && (
          <div className="glass-panel registration-box fade-in-tab">
            <div className="panel-header">
              <span className="accent-badge">STUDENT VISITOR SIGN-IN</span>
              <h2>Student Visitor Dashboard</h2>
              <p>Log in or sign up to scan student team QR codes and earn points.</p>
            </div>

            {visError && <div className="error-message alert-pop">{visError}</div>}

            {visIsRegistering ? (
              <form onSubmit={handleVisitorRegister} className="registration-form">
                <div className="form-group">
                  <label htmlFor="visName">Full Name</label>
                  <input
                    id="visName"
                    type="text"
                    value={visName}
                    onChange={(e) => setVisName(e.target.value)}
                    placeholder="Enter your full name..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="visMobile">Mobile Number</label>
                  <input
                    id="visMobile"
                    type="tel"
                    maxLength="10"
                    value={visMobile}
                    onChange={(e) => setVisMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit mobile number..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="visPassword">Password</label>
                  <input
                    id="visPassword"
                    type="password"
                    value={visPassword}
                    onChange={(e) => setVisPassword(e.target.value)}
                    placeholder="Create a password..."
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  Register Visitor
                </button>

                <p className="toggle-auth-link">
                  Already registered?{' '}
                  <button type="button" onClick={() => setVisIsRegistering(false)}>
                    Sign In Here
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleVisitorLogin} className="registration-form">
                <div className="form-group">
                  <label htmlFor="visMobileLogin">Mobile Number</label>
                  <input
                    id="visMobileLogin"
                    type="tel"
                    maxLength="10"
                    value={visMobile}
                    onChange={(e) => setVisMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter registered mobile number..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="visPasswordLogin">Password</label>
                  <input
                    id="visPasswordLogin"
                    type="password"
                    value={visPassword}
                    onChange={(e) => setVisPassword(e.target.value)}
                    placeholder="Enter your password..."
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  Login & Start Scanning
                </button>

                <p className="toggle-auth-link">
                  New visitor student?{' '}
                  <button type="button" onClick={() => setVisIsRegistering(true)}>
                    Create Account Here
                  </button>
                </p>
              </form>
            )}
          </div>
        )}

        {/* Faculty Portal */}
        {userRole === 'faculty' && (
          <div className="glass-panel registration-box fade-in-tab">
            <div className="panel-header">
              <span className="accent-badge">FACULTY PORTAL</span>
              <h2>{facIsRegistering ? 'Faculty Account Creation' : 'Faculty Sign-In'}</h2>
              <p>Access scanner to validate student hackathon team QR codes and distribute points.</p>
            </div>

            {facError && <div className="error-message alert-pop">{facError}</div>}

            {facIsRegistering ? (
              <form onSubmit={handleFacultyRegister} className="registration-form">
                <div className="form-group">
                  <label htmlFor="facId">Faculty ID (Unique)</label>
                  <input
                    id="facId"
                    type="text"
                    value={facId}
                    onChange={(e) => setFacId(e.target.value)}
                    placeholder="Enter Faculty ID..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="facName">Full Name</label>
                  <input
                    id="facName"
                    type="text"
                    value={facName}
                    onChange={(e) => setFacName(e.target.value)}
                    placeholder="Enter your name..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="facPassword">Password</label>
                  <input
                    id="facPassword"
                    type="password"
                    value={facPassword}
                    onChange={(e) => setFacPassword(e.target.value)}
                    placeholder="Create a password..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="facConfirmPassword">Confirm Password</label>
                  <input
                    id="facConfirmPassword"
                    type="password"
                    value={facConfirmPassword}
                    onChange={(e) => setFacConfirmPassword(e.target.value)}
                    placeholder="Confirm your password..."
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  Register Faculty
                </button>

                <p className="toggle-auth-link">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setFacIsRegistering(false)}>
                    Sign In
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleFacultyLogin} className="registration-form">
                <div className="form-group">
                  <label htmlFor="facIdLogin">Faculty ID</label>
                  <input
                    id="facIdLogin"
                    type="text"
                    value={facId}
                    onChange={(e) => setFacId(e.target.value)}
                    placeholder="Enter Faculty ID..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="facPasswordLogin">Password</label>
                  <input
                    id="facPasswordLogin"
                    type="password"
                    value={facPassword}
                    onChange={(e) => setFacPassword(e.target.value)}
                    placeholder="Enter password..."
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  Sign In
                </button>

                <p className="toggle-auth-link">
                  Need a faculty account?{' '}
                  <button type="button" onClick={() => setFacIsRegistering(true)}>
                    Register Here
                  </button>
                </p>
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
              <h3>Scan Initiated!</h3>
            </div>
            <div className="modal-body">
              <p>
                Verification code generated for team: <strong>{scanPendingRecord.teamId}</strong>
              </p>
              
              <div className="otp-display-box">
                <span className="otp-label">GIVE THIS CODE TO THE STUDENTS</span>
                <span className="otp-value">{scanPendingRecord.code}</span>
              </div>

              <div className="waiting-spinner-container">
                <div className="spinner"></div>
                <p>Waiting for student approval...</p>
              </div>

              <div className="modal-actions">
                <button 
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
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-content glass-panel alert-pop" style={{ maxWidth: '380px', border: '1px solid rgba(6, 182, 212, 0.3)', boxShadow: '0 0 30px rgba(6, 182, 212, 0.15)' }}>
            <div className="modal-header">
              <span className="accent-badge">HARDWARE ACCESS</span>
              <h3 style={{ marginTop: '8px', fontFamily: 'var(--font-tech)', fontSize: '18px' }}>Allow Camera Access?</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
                HackForce requires access to your device camera to scan student registration QR codes and process scan validation.
              </p>
              <div className="modal-actions">
                <button 
                  onClick={() => setShowCameraPrompt(false)} 
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowCameraPrompt(false);
                    setCameraActive(true);
                  }} 
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Allow Camera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Scanner Profile */}
        <div className="grid-col-left">
          <div className="glass-panel profile-panel">
            <div className="profile-header">
              <span className={`role-badge ${currentUserRole}`}>
                {currentUserRole === 'visitor' ? 'STUDENT VISITOR' : 'FACULTY'}
              </span>
              <h2>{currentUser.name}</h2>
              <span className="visitor-id-text">ID: {currentUser.id}</span>
              {currentUserRole === 'visitor' && <span className="visitor-id-text">Mobile: {currentUser.mobile}</span>}
            </div>

            <div className="points-display-card scanner-points">
              <span className="points-title">YOUR POINTS</span>
              <span className="points-value glow-text-cyan">{currentUser.points}</span>
            </div>

            <button onClick={handleLogout} className="btn btn-outline btn-block logout-btn">
              Logout
            </button>
          </div>
        </div>

        {/* Right Column: Scan Operations */}
        <div className="grid-col-right">
          {/* Scanner Card */}
          <div className="glass-panel scanner-card-panel">
            <div className="panel-header">
              <h3>Scan Team QR Code</h3>
              <p>Scan a team's code to reward them and earn 5 points for yourself.</p>
            </div>

            {scanError && <div className="error-message alert-pop">{scanError}</div>}

            <div className="scan-options-container">
              {/* Start Camera Trigger Button */}
              <button 
                onClick={() => {
                  if (cameraActive) {
                    setCameraActive(false);
                  } else {
                    setShowCameraPrompt(true);
                  }
                }}
                className={`btn ${cameraActive ? 'btn-danger' : 'btn-primary'} btn-block`}
                style={{ fontSize: '15px', padding: '12px' }}
                disabled={isScanning}
              >
                {cameraActive ? '🛑 Close Camera Scanner' : '📷 Scan Student QR Code (Camera)'}
              </button>

              {cameraActive && (
                <div className="network-warning-box" style={{ 
                  background: 'rgba(245, 158, 11, 0.1)', 
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fcd34d',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  textAlign: 'left'
                }}>
                  ⚠️ <strong>Notice:</strong> Modern browsers require a secure HTTPS connection to access the webcam over network IP addresses. If the camera doesn't start, please test on <strong>localhost</strong> or use the manual select fields below.
                </div>
              )}

              {/* Virtual Scanner / Live Camera View */}
              <div className="virtual-scanner-screen" style={{ minHeight: cameraActive ? '300px' : 'auto' }}>
                {cameraActive ? (
                  <div id="qr-camera-view" style={{ 
                    width: '100%', 
                    maxWidth: '400px', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)'
                  }}></div>
                ) : (
                  <div className="scanner-frame">
                    <div className="scanner-laser"></div>
                    <div className="scanner-overlay-text">
                      {isScanning ? 'TRANSMITTING SCAN DATA...' : 'READY FOR SCAN'}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Option 1: Dropdown selector (Highly recommended for local testing) */}
              <div className="scan-method-block">
                <h4>Method 1: Quick Scan Selector (For evaluation/testing)</h4>
                <div className="scan-selector-row">
                  <select 
                    value={selectedTeamId} 
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="scan-select"
                  >
                    <option value="">-- Select Student Team --</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.id})
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => handleScanTeam(selectedTeamId)}
                    className="btn btn-primary"
                    disabled={isScanning}
                  >
                    Simulate Scan
                  </button>
                </div>
              </div>

              {/* Form Option 2: Manual Text Input */}
              <div className="scan-method-block">
                <h4>Method 2: Scan by Team ID Input</h4>
                <form onSubmit={(e) => { e.preventDefault(); handleScanTeam(manualTeamId); }} className="scan-input-row">
                  <input 
                    type="text" 
                    value={manualTeamId}
                    onChange={(e) => setManualTeamId(e.target.value)}
                    placeholder="Enter Team ID (e.g. T-1001)"
                    className="scan-text-input"
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isScanning}
                  >
                    Scan ID
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="glass-panel history-panel">
            <div className="panel-header">
              <h3>Your Scanning Log</h3>
              <p>List of student teams you have successfully scanned.</p>
            </div>

            <div className="history-list">
              {myHistory.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't successfully scanned any teams yet.</p>
                </div>
              ) : (
                myHistory.map((scan) => (
                  <div key={scan.id} className="history-item fade-in-list">
                    <div className="history-info">
                      <div className="history-title-row">
                        <span className="scanner-name">Scanned: {teams.find(t => t.id === scan.teamId)?.name || scan.teamId}</span>
                        <span className="scanner-badge team-id-badge-small">{scan.teamId}</span>
                      </div>
                      <span className="history-time">
                        {new Date(scan.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="history-points">
                      +5 pts
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
