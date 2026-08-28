import React, { useState, useEffect } from 'react';
import { useLocalStorageSync } from './hooks/useLocalStorageSync';
import StudentPage from './components/StudentPage';
import VisitorPage from './components/VisitorPage';
import AdminPage from './components/AdminPage';
import KeerthiAdminPage from './components/KeerthiAdminPage';
import FullScreenLeaderboard from './components/FullScreenLeaderboard';

export default function App() {
  const { teams, visitors, faculty, scans, events, pointsActive, isInitialLoading } = useLocalStorageSync();
  const [activeTab, setActiveTab] = useState('student');
  const [isKeerthiRoute, setIsKeerthiRoute] = useState(false);

  // Check URL path / hash / query for /Keerthimamisadmin
  useEffect(() => {
    const checkRoute = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      
      const isKeerthi = path.includes('keerthimamisadmin') || 
                        search.includes('keerthimamisadmin') || 
                        hash.includes('keerthimamisadmin');
      setIsKeerthiRoute(isKeerthi);
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  const isFullScreenLeaderboard = typeof window !== 'undefined' && window.location.search.includes('view=leaderboard');

  if (isFullScreenLeaderboard) {
    return <FullScreenLeaderboard teams={teams} visitors={visitors} faculty={faculty} scans={scans} events={events} pointsActive={pointsActive} />;
  }

  // If directly accessing /Keerthimamisadmin
  if (isKeerthiRoute) {
    return (
      <div className="app-container">
        <header className="app-header glass-panel">
          <div className="header-logo">
            <span className="logo-spark">⚡</span>
            <h1>AGENTIC <span className="accent-text">AI DAY</span></h1>
            <span className="logo-badge">PORTAL</span>
          </div>

          <div className="header-middle-presenter">
            <span className="cse-blink">CSE</span> presents....
          </div>

          <nav className="header-nav">
            <button 
              onClick={() => {
                setIsKeerthiRoute(false);
                window.history.pushState({}, '', window.location.pathname.replace(/keerthimamisadmin/gi, '') || '/');
              }}
              className="nav-link"
            >
              <span className="nav-icon">👁️</span>
              <span className="nav-text">Public Portal</span>
            </button>
          </nav>
        </header>

        <main className="app-content">
          <KeerthiAdminPage
            teams={teams}
            visitors={visitors}
            faculty={faculty}
            scans={scans}
            events={events}
            pointsActive={pointsActive}
            onExit={() => {
              setIsKeerthiRoute(false);
              window.history.pushState({}, '', window.location.pathname.replace(/keerthimamisadmin/gi, '') || '/');
            }}
          />
        </main>

        <footer className="app-footer">
          <p>© 2026 Neuraltrix AI Private Limited. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Modern Floating Header */}
      <header className="app-header glass-panel">
        <div className="header-logo">
          <div className="logo-spark-box">⚡</div>
          <h1>AGENTIC <span className="ai-day-brand">AI DAY</span></h1>
          <span className="logo-badge">PORTAL</span>
        </div>
        
        {/* Middle CSE Blinking Banner */}
        <div className="header-middle-presenter">
          <span className="presenter-icon">🎓</span>
          <span className="cse-blink">CSE</span>
          <span className="presents-sub">presents...</span>
        </div>

        <nav className="header-nav">
          <button 
            onClick={() => setActiveTab('student')}
            className={`nav-link ${activeTab === 'student' ? 'active' : ''}`}
          >
            <span className="nav-icon purple-icon">👥</span>
            <span className="nav-text">Student Team Portal</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('visitor')}
            className={`nav-link ${activeTab === 'visitor' ? 'active' : ''}`}
          >
            <span className="nav-icon pink-icon">🎟️</span>
            <span className="nav-text">Student Visitor / Faculty</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('admin')}
            className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`}
          >
            <span className="nav-icon blue-icon">📊</span>
            <span className="nav-text">Analytics</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        {activeTab === 'student' && (
          <StudentPage 
            teams={teams} 
            scans={scans} 
            events={events}
            pointsActive={pointsActive}
            isInitialLoading={isInitialLoading}
          />
        )}
        
        {activeTab === 'visitor' && (
          <VisitorPage 
            teams={teams} 
            visitors={visitors} 
            faculty={faculty} 
            scans={scans}
            pointsActive={pointsActive}
            isInitialLoading={isInitialLoading}
          />
        )}
        
        {activeTab === 'admin' && (
          <AdminPage 
            teams={teams} 
            visitors={visitors} 
            faculty={faculty} 
            scans={scans} 
            events={events}
            pointsActive={pointsActive}
          />
        )}
      </main>
    </div>
  );
}

