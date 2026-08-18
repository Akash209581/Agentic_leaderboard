// Database helper calling the Express SQLite backend API

export const getTeams = async () => {
  const res = await fetch('/api/data');
  const data = await res.json();
  return data.teams || [];
};

export const getVisitors = async () => {
  const res = await fetch('/api/data');
  const data = await res.json();
  return data.visitors || [];
};

export const getFaculty = async () => {
  const res = await fetch('/api/data');
  const data = await res.json();
  return data.faculty || [];
};

export const getScans = async () => {
  const res = await fetch('/api/data');
  const data = await res.json();
  return data.scans || [];
};

// Team Operations
export const registerTeam = async (name, leaderName, leaderRegNo, memberCount, members) => {
  const res = await fetch('/api/register-team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, leaderName, leaderRegNo, memberCount, members })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register team.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

export const loginTeam = async (name, leaderRegNo) => {
  const res = await fetch('/api/login-team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, leaderRegNo })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to login team.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Visitor (Student Visitor) Operations
export const registerVisitor = async (name, mobile, password) => {
  const res = await fetch('/api/register-visitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mobile, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register visitor.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

export const loginVisitor = async (mobile, password) => {
  const res = await fetch('/api/login-visitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to login visitor.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Faculty Operations
export const registerFaculty = async (facultyId, name, password) => {
  const res = await fetch('/api/register-faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facultyId, name, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register faculty.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

export const loginFaculty = async (facultyId, password) => {
  const res = await fetch('/api/login-faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facultyId, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to login faculty.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Scan Operations
export const initiateScan = async (teamId, scannerId, scannerName, scannerType) => {
  const res = await fetch('/api/initiate-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, scannerId, scannerName, scannerType })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to initiate scan.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Approve Scan
export const approveScan = async (teamId, code) => {
  const res = await fetch('/api/approve-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, code })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to approve scan.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Reject Scan
export const rejectScan = async (scanId) => {
  const res = await fetch('/api/reject-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reject scan.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Seed Mock Data
export const seedMockData = async () => {
  const res = await fetch('/api/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to seed mock data.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Reset Database
export const clearDatabase = async () => {
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset database.');
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};
