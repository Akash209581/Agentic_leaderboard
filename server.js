import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 6009;

app.use(cors());
app.use(express.json());

// Initialize PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the PostgreSQL database:', err.message);
  } else {
    console.log('Connected to the PostgreSQL database.');
    release();
  }
});

// Promisify Database queries (with ? to $1 parameter mapping)
const dbRun = async (query, params = []) => {
  let count = 0;
  const pgQuery = query.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
  return await pool.query(pgQuery, params);
};

const dbAll = async (query, params = []) => {
  let count = 0;
  const pgQuery = query.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
  const res = await pool.query(pgQuery, params);
  return res.rows;
};

const dbGet = async (query, params = []) => {
  let count = 0;
  const pgQuery = query.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
  const res = await pool.query(pgQuery, params);
  return res.rows[0] || null;
};

// Create tables
const initDb = async () => {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      leader_name TEXT,
      leader_reg_no TEXT,
      member_count INTEGER,
      members TEXT, -- JSON string array
      points INTEGER DEFAULT 0,
      registered_at BIGINT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      name TEXT,
      mobile TEXT UNIQUE,
      password TEXT,
      points INTEGER DEFAULT 0,
      registered_at BIGINT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      name TEXT,
      password TEXT,
      points INTEGER DEFAULT 0,
      registered_at BIGINT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      team_id TEXT,
      scanner_id TEXT,
      scanner_name TEXT,
      scanner_type TEXT,
      code TEXT,
      status TEXT, -- 'pending', 'approved', 'rejected'
      timestamp BIGINT,
      approved_at BIGINT
    )
  `);

  console.log('Database tables initialized.');
};

initDb().catch(err => {
  console.error('Failed to initialize database tables:', err);
});

// Helper to generate a unique random 4-digit code
const generateUniqueOTP = async () => {
  const scans = await dbAll("SELECT code FROM scans WHERE status = 'pending'");
  const activeOTPs = new Set(scans.map(s => s.code));

  let otp;
  let attempts = 0;
  do {
    otp = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
  } while (activeOTPs.has(otp) && attempts < 1000);

  return otp;
};

// --- API ENDPOINTS ---

// Fetch all database state for syncing
app.get('/api/data', async (req, res) => {
  try {
    const teams = await dbAll('SELECT * FROM teams');
    const visitors = await dbAll('SELECT * FROM visitors');
    const faculty = await dbAll('SELECT * FROM faculty');
    const scans = await dbAll('SELECT * FROM scans');

    // Map database snake_case columns to React camelCase keys
    const parsedTeams = teams.map(t => ({
      id: t.id,
      name: t.name,
      leaderName: t.leader_name,
      leaderRegNo: t.leader_reg_no,
      memberCount: parseInt(t.member_count || 0, 10),
      members: JSON.parse(t.members || '[]'),
      points: parseInt(t.points || 0, 10),
      registeredAt: parseInt(t.registered_at || 0, 10)
    }));

    const parsedVisitors = visitors.map(v => ({
      id: v.id,
      name: v.name,
      mobile: v.mobile,
      points: parseInt(v.points || 0, 10),
      registeredAt: parseInt(v.registered_at || 0, 10)
    }));

    const parsedFaculty = faculty.map(f => ({
      id: f.id,
      name: f.name,
      points: parseInt(f.points || 0, 10),
      registeredAt: parseInt(f.registered_at || 0, 10)
    }));

    const parsedScans = scans.map(s => ({
      id: s.id,
      teamId: s.team_id,
      scannerId: s.scanner_id,
      scannerName: s.scanner_name,
      scannerType: s.scanner_type,
      code: s.code,
      status: s.status,
      timestamp: parseInt(s.timestamp || 0, 10),
      approvedAt: parseInt(s.approved_at || 0, 10)
    }));

    res.json({
      teams: parsedTeams,
      visitors: parsedVisitors,
      faculty: parsedFaculty,
      scans: parsedScans
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team Registration
app.post('/api/register-team', async (req, res) => {
  const { name, leaderName, leaderRegNo, memberCount, members } = req.body;

  if (!name || !leaderName || !leaderRegNo) {
    return res.status(400).json({ error: 'Team name, leader name, and leader registration number are required.' });
  }

  try {
    const existing = await dbGet('SELECT id FROM teams WHERE LOWER(name) = ?', [name.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'A team with this name already exists.' });
    }

    const countRes = await dbGet('SELECT COUNT(*) as count FROM teams');
    const teamId = `T-${1000 + parseInt(countRes.count || 0, 10) + 1}`;
    const timestamp = Date.now();
    const membersList = members || [];

    await dbRun(
      `INSERT INTO teams (id, name, leader_name, leader_reg_no, member_count, members, points, registered_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [teamId, name, leaderName, leaderRegNo, parseInt(memberCount, 10) || 1, JSON.stringify(membersList), timestamp]
    );

    const newTeam = {
      id: teamId,
      name,
      leaderName,
      leaderRegNo,
      memberCount: parseInt(memberCount, 10) || 1,
      members: membersList,
      points: 0,
      registeredAt: timestamp
    };

    res.json(newTeam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team Login
app.post('/api/login-team', async (req, res) => {
  const { name, leaderRegNo } = req.body;

  if (!name || !leaderRegNo) {
    return res.status(400).json({ error: 'Team name and leader registration number are required.' });
  }

  try {
    const team = await dbGet('SELECT * FROM teams WHERE LOWER(name) = ? AND leader_reg_no = ?', [name.toLowerCase(), leaderRegNo]);
    if (!team) {
      return res.status(401).json({ error: 'Invalid Team Name or Leader Registration Number.' });
    }

    team.members = JSON.parse(team.members || '[]');
    team.points = parseInt(team.points || 0, 10);
    team.registered_at = parseInt(team.registered_at || 0, 10);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Visitor Registration (Student Visitor)
app.post('/api/register-visitor', async (req, res) => {
  const { name, mobile, password } = req.body;

  if (!name || !mobile || !password) {
    return res.status(400).json({ error: 'Name, mobile number, and password are required.' });
  }

  try {
    const existing = await dbGet('SELECT id FROM visitors WHERE mobile = ?', [mobile]);
    if (existing) {
      return res.status(400).json({ error: 'This mobile number is already registered.' });
    }

    const countRes = await dbGet('SELECT COUNT(*) as count FROM visitors');
    const visitorId = `V-${2000 + parseInt(countRes.count || 0, 10) + 1}`;
    const timestamp = Date.now();

    await dbRun(
      `INSERT INTO visitors (id, name, mobile, password, points, registered_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [visitorId, name, mobile, password, timestamp]
    );

    const newVisitor = {
      id: visitorId,
      name,
      mobile,
      points: 0,
      registeredAt: timestamp
    };

    res.json(newVisitor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Visitor Login (Student Visitor)
app.post('/api/login-visitor', async (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ error: 'Mobile number and password are required.' });
  }

  try {
    const visitor = await dbGet('SELECT * FROM visitors WHERE mobile = ? AND password = ?', [mobile, password]);
    if (!visitor) {
      return res.status(401).json({ error: 'Invalid Mobile Number or Password.' });
    }

    res.json({
      id: visitor.id,
      name: visitor.name,
      mobile: visitor.mobile,
      points: parseInt(visitor.points || 0, 10),
      registeredAt: parseInt(visitor.registered_at || 0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty Registration
app.post('/api/register-faculty', async (req, res) => {
  const { facultyId, name, password } = req.body;

  if (!facultyId || !name || !password) {
    return res.status(400).json({ error: 'Faculty ID, name, and password are required.' });
  }

  try {
    const existing = await dbGet('SELECT id FROM faculty WHERE LOWER(id) = ?', [facultyId.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'This Faculty ID is already registered.' });
    }

    const timestamp = Date.now();
    await dbRun(
      `INSERT INTO faculty (id, name, password, points, registered_at)
       VALUES (?, ?, ?, 0, ?)`,
      [facultyId, name, password, timestamp]
    );

    const newFaculty = {
      id: facultyId,
      name,
      points: 0,
      registeredAt: timestamp
    };

    res.json(newFaculty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty Login
app.post('/api/login-faculty', async (req, res) => {
  const { facultyId, password } = req.body;

  if (!facultyId || !password) {
    return res.status(400).json({ error: 'Faculty ID and password are required.' });
  }

  try {
    const faculty = await dbGet('SELECT * FROM faculty WHERE LOWER(id) = ? AND password = ?', [facultyId.toLowerCase(), password]);
    if (!faculty) {
      return res.status(401).json({ error: 'Invalid Faculty ID or Password.' });
    }

    res.json({
      id: faculty.id,
      name: faculty.name,
      points: parseInt(faculty.points || 0, 10),
      registeredAt: parseInt(faculty.registered_at || 0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan Operations - Initiate Scan
app.post('/api/initiate-scan', async (req, res) => {
  const { teamId, scannerId, scannerName, scannerType } = req.body;

  if (!teamId || !scannerId || !scannerName || !scannerType) {
    return res.status(400).json({ error: 'Missing scanning details.' });
  }

  try {
    // Verify team exists
    const team = await dbGet('SELECT id FROM teams WHERE id = ?', [teamId]);
    if (!team) {
      return res.status(404).json({ error: 'Invalid Team QR Code.' });
    }

    // Check if scanner already approved a scan for this team
    const alreadyApproved = await dbGet(
      "SELECT id FROM scans WHERE team_id = ? AND scanner_id = ? AND status = 'approved'",
      [teamId, scannerId]
    );
    if (alreadyApproved) {
      return res.status(400).json({ error: "You have already scanned this team's QR code!" });
    }

    // Check if pending scan exists from this scanner for this team
    const existingPending = await dbGet(
      "SELECT id FROM scans WHERE team_id = ? AND scanner_id = ? AND status = 'pending'",
      [teamId, scannerId]
    );

    const otp = await generateUniqueOTP();
    const scanId = `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = Date.now();

    if (existingPending) {
      // Overwrite the existing pending OTP
      await dbRun(
        "UPDATE scans SET code = ?, timestamp = ?, id = ? WHERE id = ?",
        [otp, timestamp, scanId, existingPending.id]
      );
    } else {
      await dbRun(
        `INSERT INTO scans (id, team_id, scanner_id, scanner_name, scanner_type, code, status, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [scanId, teamId, scannerId, scannerName, scannerType, otp, timestamp]
      );
    }

    const scanRecord = {
      id: scanId,
      teamId,
      scannerId,
      scannerName,
      scannerType,
      code: otp,
      status: 'pending',
      timestamp
    };

    res.json(scanRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan Operations - Approve Scan
app.post('/api/approve-scan', async (req, res) => {
  const { teamId, code } = req.body;

  if (!teamId || !code) {
    return res.status(400).json({ error: 'Team ID and verification code are required.' });
  }

  try {
    const scan = await dbGet(
      "SELECT * FROM scans WHERE team_id = ? AND code = ? AND status = 'pending'",
      [teamId, code]
    );

    if (!scan) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const approvedAt = Date.now();

    // 1. Approve scan record
    await dbRun(
      "UPDATE scans SET status = 'approved', approved_at = ? WHERE id = ?",
      [approvedAt, scan.id]
    );

    // 2. Award +10 points to student team
    await dbRun(
      "UPDATE teams SET points = points + 10 WHERE id = ?",
      [teamId]
    );

    // 3. Award +5 points to scanner
    if (scan.scanner_type === 'visitor') {
      await dbRun(
        "UPDATE visitors SET points = points + 5 WHERE id = ?",
        [scan.scanner_id]
      );
    } else if (scan.scanner_type === 'faculty') {
      await dbRun(
        "UPDATE faculty SET points = points + 5 WHERE id = ?",
        [scan.scanner_id]
      );
    }

    res.json({ success: true, message: 'Scan approved successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan Operations - Reject Scan
app.post('/api/reject-scan', async (req, res) => {
  const { scanId } = req.body;

  if (!scanId) {
    return res.status(400).json({ error: 'Scan ID is required.' });
  }

  try {
    await dbRun(
      "UPDATE scans SET status = 'rejected' WHERE id = ?",
      [scanId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Tools - Seed Mock Data
app.post('/api/seed', async (req, res) => {
  try {
    // Clear old data first
    await dbRun('DELETE FROM teams');
    await dbRun('DELETE FROM visitors');
    await dbRun('DELETE FROM faculty');
    await dbRun('DELETE FROM scans');

    const timestamp = Date.now();

    // Seed Teams
    const teams = [
      ['T-1001', 'Alpha Coders', 'John Doe', 'REG001', 3, JSON.stringify(['John Doe', 'Alice Smith', 'Bob Johnson']), 40, timestamp - 3600000 * 5],
      ['T-1002', 'Beta Blockers', 'Mary Sue', 'REG002', 2, JSON.stringify(['Mary Sue', 'Dave Miller']), 20, timestamp - 3600000 * 4],
      ['T-1003', 'Gamma Geniuses', 'Sarah Connor', 'REG003', 4, JSON.stringify(['Sarah Connor', 'Kyle Reese', 'John Connor', 'T-800']), 50, timestamp - 3600000 * 3],
      ['T-1004', 'Delta Devs', 'Bruce Wayne', 'REG004', 3, JSON.stringify(['Bruce Wayne', 'Clark Kent', 'Diana Prince']), 10, timestamp - 3600000 * 2]
    ];
    for (const team of teams) {
      await dbRun(`INSERT INTO teams (id, name, leader_name, leader_reg_no, member_count, members, points, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, team);
    }

    // Seed Visitors (Student Visitors)
    const visitors = [
      ['V-2001', 'Elon Musk', '9876543210', 'password123', 20, timestamp - 3600000],
      ['V-2002', 'Sam Altman', '8765432109', 'password123', 10, timestamp - 300000],
      ['V-2003', 'Ada Lovelace', '7654321098', 'password123', 30, timestamp - 500000]
    ];
    for (const vis of visitors) {
      await dbRun(`INSERT INTO visitors (id, name, mobile, password, points, registered_at) VALUES (?, ?, ?, ?, ?, ?)`, vis);
    }

    // Seed Faculty
    const faculty = [
      ['F-3001', 'Dr. Alan Turing', 'admin', 20, timestamp - 3600000 * 6]
    ];
    for (const fac of faculty) {
      await dbRun(`INSERT INTO faculty (id, name, password, points, registered_at) VALUES (?, ?, ?, ?, ?)`, fac);
    }

    // Seed Scans
    const scans = [
      ['S-1', 'T-1001', 'V-2001', 'Elon Musk', 'visitor', '1111', 'approved', timestamp - 600000, timestamp - 550000],
      ['S-2', 'T-1001', 'V-2002', 'Sam Altman', 'visitor', '2222', 'approved', timestamp - 500000, timestamp - 480000],
      ['S-3', 'T-1002', 'V-2001', 'Elon Musk', 'visitor', '3333', 'approved', timestamp - 400000, timestamp - 390000],
      ['S-4', 'T-1003', 'V-2003', 'Ada Lovelace', 'visitor', '4444', 'approved', timestamp - 300000, timestamp - 280000],
      ['S-5', 'T-1003', 'F-3001', 'Dr. Alan Turing', 'faculty', '5555', 'approved', timestamp - 200000, timestamp - 190000]
    ];
    for (const scan of scans) {
      await dbRun(`INSERT INTO scans (id, team_id, scanner_id, scanner_name, scanner_type, code, status, timestamp, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, scan);
    }

    res.json({ success: true, message: 'Database seeded with mock data.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Tools - Reset Database
app.post('/api/reset', async (req, res) => {
  try {
    await dbRun('DELETE FROM teams');
    await dbRun('DELETE FROM visitors');
    await dbRun('DELETE FROM faculty');
    await dbRun('DELETE FROM scans');
    res.json({ success: true, message: 'Database reset.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend assets in production
app.use('/leaderboard', express.static(join(__dirname, 'dist')));
app.use(express.static(join(__dirname, 'dist')));

// Redirect all other queries to index.html for SPA router
app.get('/leaderboard/*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});
app.get('*splat', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
