import React, { useState } from 'react';
import { useLocalStorageSync } from './hooks/useLocalStorageSync';
import StudentPage from './components/StudentPage';
import VisitorPage from './components/VisitorPage';
import AdminPage from './components/AdminPage';
import FullScreenLeaderboard from './components/FullScreenLeaderboard';

export default function App() {
  const { teams, visitors, faculty, scans, events } = useLocalStorageSync();
  const [activeTab, setActiveTab] = useState('student');

  const isFullScreenLeaderboard = typeof window !== 'undefined' && window.location.search.includes('view=leaderboard');

  if (isFullScreenLeaderboard) {
    return <FullScreenLeaderboard teams={teams} visitors={visitors} faculty={faculty} scans={scans} events={events} />;
  }

  return (
    <div className="app-container">
      {/* Premium Cyberpunk Header */}
      <header className="app-header glass-panel">
        <div className="header-logo">
          <span className="logo-spark">⚡</span>
          <h1>HACK<span className="accent-text">FORCE</span> QR</h1>
          <span className="logo-badge">AI Hackathon Portal</span>
        </div>
        
        <nav className="header-nav">
          <button 
            onClick={() => setActiveTab('student')}
            className={`nav-link ${activeTab === 'student' ? 'active' : ''}`}
          >
            <span className="nav-icon">👨‍💻</span>
            <span className="nav-text">Student Team Portal</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('visitor')}
            className={`nav-link ${activeTab === 'visitor' ? 'active' : ''}`}
          >
            <span className="nav-icon">🎟️</span>
            <span className="nav-text">Student Visitor / Faculty</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('admin')}
            className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`}
          >
            <span className="nav-icon">🛡️</span>
            <span className="nav-text">Admin Panel</span>
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
          />
        )}
        
        {activeTab === 'visitor' && (
          <VisitorPage 
            teams={teams} 
            visitors={visitors} 
            faculty={faculty} 
            scans={scans} 
          />
        )}
        
        {activeTab === 'admin' && (
          <AdminPage 
            teams={teams} 
            visitors={visitors} 
            faculty={faculty} 
            scans={scans} 
            events={events}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2026 Neuraltrix AI Private Limited. All rights reserved.</p>
      </footer>
    </div>
  );
}
