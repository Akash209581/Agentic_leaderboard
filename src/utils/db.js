// Database helper calling the Express PostgreSQL backend API

const safeParseJSON = async (res) => {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch (e) {
      return { error: 'Invalid JSON response from server.' };
    }
  }
  return { error: `Server error (Status Code ${res.status}).` };
};

const safeFetch = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    const data = await safeParseJSON(res);
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Network Error: Could not connect to the backend server. Please make sure your server is running.');
    }
    throw err;
  }
};

export const getTeams = async () => {
  try {
    const data = await safeFetch('/api/data');
    return data.teams || [];
  } catch (err) {
    console.error('Error fetching teams:', err.message);
    return [];
  }
};

export const getVisitors = async () => {
  try {
    const data = await safeFetch('/api/data');
    return data.visitors || [];
  } catch (err) {
    console.error('Error fetching visitors:', err.message);
    return [];
  }
};

export const getFaculty = async () => {
  try {
    const data = await safeFetch('/api/data');
    return data.faculty || [];
  } catch (err) {
    console.error('Error fetching faculty:', err.message);
    return [];
  }
};

export const getScans = async () => {
  try {
    const data = await safeFetch('/api/data');
    return data.scans || [];
  } catch (err) {
    console.error('Error fetching scans:', err.message);
    return [];
  }
};

// Team Operations
export const registerTeam = async (name, leaderName, leaderRegNo, memberCount, members) => {
  const data = await safeFetch('/api/register-team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, leaderName, leaderRegNo, memberCount, members })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

export const loginTeam = async (name, leaderRegNo) => {
  const data = await safeFetch('/api/login-team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, leaderRegNo })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Visitor (Student Visitor) Operations
export const registerVisitor = async (name, mobile, password) => {
  const data = await safeFetch('/api/register-visitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mobile, password })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

export const loginVisitor = async (mobile, password) => {
  const data = await safeFetch('/api/login-visitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, password })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Faculty Operations
export const registerFaculty = async (facultyId, name, password) => {
  const data = await safeFetch('/api/register-faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facultyId, name, password })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

export const loginFaculty = async (facultyId, password) => {
  const data = await safeFetch('/api/login-faculty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facultyId, password })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Scan Operations
export const initiateScan = async (teamId, scannerId, scannerName, scannerType) => {
  const data = await safeFetch('/api/initiate-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, scannerId, scannerName, scannerType })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Approve Scan
export const approveScan = async (teamId, code) => {
  const data = await safeFetch('/api/approve-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, code })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Reject Scan
export const rejectScan = async (scanId) => {
  const data = await safeFetch('/api/reject-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanId })
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Seed Mock Data
export const seedMockData = async () => {
  const data = await safeFetch('/api/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};

// Reset Database
export const clearDatabase = async () => {
  const data = await safeFetch('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  window.dispatchEvent(new Event('local-db-update'));
  return data;
};
