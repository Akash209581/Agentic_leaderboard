import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 6009;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize Database connection (PostgreSQL if DATABASE_URL is set, otherwise SQLite)
const connectionString = process.env.DATABASE_URL;
const useSqlite = !connectionString;

let pool = null;
let sqliteDb = null;

if (useSqlite) {
  const dbPath = join(__dirname, 'hackathon.db');
  console.log(`No DATABASE_URL found. Using local SQLite database at: ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to the SQLite database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });
} else {
  let sslOption = false;
  if (process.env.DB_SSL === 'true') {
    sslOption = { rejectUnauthorized: false };
  } else if (process.env.DB_SSL === 'false') {
    sslOption = false;
  } else if (connectionString) {
    const lowerUrl = connectionString.toLowerCase();
    if (lowerUrl.includes('sslmode=disable') || lowerUrl.includes('ssl=false') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
      sslOption = false;
    } else if (lowerUrl.includes('supabase') || lowerUrl.includes('sslmode=require') || lowerUrl.includes('ssl=true') || lowerUrl.includes('pgbouncer=true')) {
      sslOption = { rejectUnauthorized: false };
    }
  }

  pool = new Pool({
    connectionString,
    ssl: sslOption
  });

  // Prevent Node process crash on idle client errors (common with Supabase / PgBouncer)
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  pool.connect((err, client, release) => {
    if (err) {
      console.error('Error connecting to the PostgreSQL database:', err.message);
    } else {
      console.log('Connected to the PostgreSQL database.');
      release();
    }
  });
}

// Promisify Database queries (transparent compatibility for SQLite and PostgreSQL)
const dbRun = async (query, params = []) => {
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ rows: [], count: this.changes });
      });
    });
  } else {
    let count = 0;
    const pgQuery = query.replace(/\?/g, () => {
      count++;
      return `$${count}`;
    });
    return await pool.query(pgQuery, params);
  }
};

const dbAll = async (query, params = []) => {
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  } else {
    let count = 0;
    const pgQuery = query.replace(/\?/g, () => {
      count++;
      return `$${count}`;
    });
    const res = await pool.query(pgQuery, params);
    return res.rows;
  }
};

const dbGet = async (query, params = []) => {
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  } else {
    let count = 0;
    const pgQuery = query.replace(/\?/g, () => {
      count++;
      return `$${count}`;
    });
    const res = await pool.query(pgQuery, params);
    return res.rows[0] || null;
  }
};

// Helper to ensure target database exists in PostgreSQL
const ensureDatabaseExists = async () => {
  if (!connectionString) return;
  try {
    const parsed = new URL(connectionString);
    const dbName = parsed.pathname.replace(/^\//, '');
    if (!dbName || dbName === 'postgres') return;

    const defaultUrl = new URL(connectionString);
    defaultUrl.pathname = '/postgres';

    const tempPool = new Pool({
      connectionString: defaultUrl.toString(),
      ssl: sslOption
    });

    try {
      const checkRes = await tempPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (checkRes.rows.length === 0) {
        console.log(`Database "${dbName}" does not exist. Creating database "${dbName}"...`);
        const safeDbName = dbName.replace(/"/g, '""');
        await tempPool.query(`CREATE DATABASE "${safeDbName}"`);
        console.log(`Database "${dbName}" created successfully.`);
      }
    } catch (err) {
      console.warn(`Auto-creation check for database "${dbName}":`, err.message);
    } finally {
      await tempPool.end();
    }
  } catch (err) {
    // Ignore URL parsing errors
  }
};

// Create tables
const initDb = async () => {
  await ensureDatabaseExists();

  await dbRun(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      leader_name TEXT,
      leader_reg_no TEXT UNIQUE,
      member_count INTEGER,
      members TEXT, -- JSON string array
      points INTEGER DEFAULT 0,
      registered_at BIGINT,
      event TEXT,
      leader_photo TEXT,
      unique_code TEXT UNIQUE
    )
  `);

  try {
    await dbRun("ALTER TABLE teams ADD COLUMN event TEXT");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await dbRun("ALTER TABLE teams ADD COLUMN unique_code TEXT");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await dbRun("ALTER TABLE teams ADD COLUMN leader_photo TEXT");
  } catch (err) {
    // Ignore error if column already exists
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      created_at BIGINT
    )
  `);

  // Seed default events if events table is empty or contains old default events
  try {
    const existingEvents = await dbAll("SELECT * FROM events");
    const oldDefaultNames = ['Web Development', 'AI/ML Hackathon', 'Cybersecurity CTF', 'App Development'];
    const hasOnlyOldDefaults = existingEvents.length > 0 && existingEvents.every(e => oldDefaultNames.includes(e.name));

    if (existingEvents.length === 0 || hasOnlyOldDefaults) {
      await dbRun("DELETE FROM events WHERE name IN ('Web Development', 'AI/ML Hackathon', 'Cybersecurity CTF', 'App Development')");
      const checkCurrent = await dbAll("SELECT * FROM events WHERE name = 'Agentic Ai Day'");
      if (checkCurrent.length === 0) {
        await dbRun("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)", ['E-1', 'Agentic Ai Day', Date.now()]);
      }
      // Also update any teams previously assigned to old events
      await dbRun("UPDATE teams SET event = 'Agentic Ai Day' WHERE event IN ('Web Development', 'AI/ML Hackathon', 'Cybersecurity CTF', 'App Development')");
      console.log('Default event Agentic Ai Day configured.');
    }
  } catch (err) {
    console.error('Error seeding default events:', err.message);
  }

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

  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Ensure default points_active setting exists
  try {
    const pointsSetting = await dbGet("SELECT value FROM settings WHERE key = 'points_active'");
    if (!pointsSetting) {
      await dbRun("INSERT INTO settings (key, value) VALUES ('points_active', 'true')");
    }
  } catch (err) {
    console.error('Error initializing settings:', err.message);
  }

  console.log('Database tables initialized.');
};

initDb().catch(err => {
  console.error('Failed to initialize database tables:', err);
});

// Helper to check if points system is active
const isPointsSystemActive = async () => {
  try {
    const setting = await dbGet("SELECT value FROM settings WHERE key = 'points_active'");
    return !setting || setting.value === 'true' || setting.value === '1';
  } catch (err) {
    return true;
  }
};

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port, timestamp: new Date().toISOString() });
});

// Serve leader photo for a specific team (separate from bulk /api/data to avoid MB-per-poll)
app.get('/api/team-photo/:id', async (req, res) => {
  try {
    const team = await dbGet('SELECT leader_photo FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    res.json({ leaderPhoto: team.leader_photo || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all database state for syncing
app.get('/api/data', async (req, res) => {
  try {
    // Exclude leader_photo from bulk response - each base64 photo can be 2MB+
    // Photos are fetched individually via /api/team-photo/:id
    const teams = await dbAll('SELECT id, name, leader_name, leader_reg_no, member_count, members, points, registered_at, event, unique_code FROM teams');
    const visitors = await dbAll('SELECT * FROM visitors');
    const faculty = await dbAll('SELECT * FROM faculty');
    const scans = await dbAll('SELECT * FROM scans ORDER BY timestamp DESC');
    const events = await dbAll('SELECT * FROM events ORDER BY created_at ASC');
    const pointsActive = await isPointsSystemActive();

    // Map database snake_case columns to React camelCase keys
    const parsedTeams = teams.map(t => ({
      id: t.id,
      name: t.name,
      leaderName: t.leader_name,
      leaderRegNo: t.leader_reg_no,
      memberCount: parseInt(t.member_count || 0, 10),
      members: JSON.parse(t.members || '[]'),
      points: parseInt(t.points || 0, 10),
      registeredAt: parseInt(t.registered_at || 0, 10),
      event: t.event,
      leaderPhoto: null, // Loaded separately via /api/team-photo/:id
      uniqueCode: t.unique_code
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
      scans: parsedScans,
      events,
      pointsActive
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Toggle Points Active / Stopped
app.post('/api/toggle-points', async (req, res) => {
  const { pointsActive } = req.body;
  const activeValue = (pointsActive === true || pointsActive === 'true' || pointsActive === '1') ? 'true' : 'false';

  try {
    const existing = await dbGet("SELECT key FROM settings WHERE key = 'points_active'");
    if (existing) {
      await dbRun("UPDATE settings SET value = ? WHERE key = 'points_active'", [activeValue]);
    } else {
      await dbRun("INSERT INTO settings (key, value) VALUES ('points_active', ?)", [activeValue]);
    }

    res.json({ success: true, pointsActive: activeValue === 'true' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete Team
app.post('/api/delete-team', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Team ID is required.' });
  }
  try {
    await dbRun('DELETE FROM teams WHERE id = ?', [id]);
    await dbRun('DELETE FROM scans WHERE team_id = ?', [id]);
    res.json({ success: true, message: `Team ${id} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete Visitor
app.post('/api/delete-visitor', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Visitor ID is required.' });
  }
  try {
    await dbRun('DELETE FROM visitors WHERE id = ?', [id]);
    await dbRun('DELETE FROM scans WHERE scanner_id = ?', [id]);
    res.json({ success: true, message: `Visitor ${id} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete Faculty
app.post('/api/delete-faculty', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Faculty ID is required.' });
  }
  try {
    await dbRun('DELETE FROM faculty WHERE id = ?', [id]);
    await dbRun('DELETE FROM scans WHERE scanner_id = ?', [id]);
    res.json({ success: true, message: `Faculty ${id} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team Registration
app.post('/api/register-team', async (req, res) => {
  const { name, leaderName, leaderRegNo, memberCount, members, event, leaderPhoto } = req.body;

  if (!name || !leaderName || !leaderRegNo || !event) {
    return res.status(400).json({ error: 'Team name, leader name, registration number, and event are required.' });
  }

  if (!leaderPhoto) {
    return res.status(400).json({ error: 'Leader photo is required.' });
  }

  try {
    const existingName = await dbGet('SELECT id FROM teams WHERE LOWER(name) = ?', [name.toLowerCase()]);
    if (existingName) {
      return res.status(400).json({ error: 'A team with this name already exists.' });
    }

    const existingReg = await dbGet('SELECT id FROM teams WHERE leader_reg_no = ?', [leaderRegNo]);
    if (existingReg) {
      return res.status(400).json({ error: 'A team leader with this registration number is already registered.' });
    }

    const countRes = await dbGet('SELECT COUNT(*) as count FROM teams');
    const teamId = `T-${1000 + parseInt(countRes.count || 0, 10) + 1}`;
    const timestamp = Date.now();
    const membersList = members || [];
    
    // Generate a 6-character alphanumeric unique code
    const uniqueCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    await dbRun(
      `INSERT INTO teams (id, name, leader_name, leader_reg_no, member_count, members, points, registered_at, event, leader_photo, unique_code)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [teamId, name, leaderName, leaderRegNo, parseInt(memberCount, 10) || 1, JSON.stringify(membersList), timestamp, event, leaderPhoto, uniqueCode]
    );

    const newTeam = {
      id: teamId,
      name,
      leaderName,
      leaderRegNo,
      memberCount: parseInt(memberCount, 10) || 1,
      members: membersList,
      points: 0,
      registeredAt: timestamp,
      event,
      leaderPhoto,
      uniqueCode
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

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
  const { teamName, leaderName, uniqueCode } = req.body;

  if (!teamName || !leaderName || !uniqueCode) {
    return res.status(400).json({ error: 'Team name, leader name, and unique code are required.' });
  }

  // Universal master code check
  if (uniqueCode !== '4721') {
    return res.status(401).json({ error: 'Invalid admin unique code.' });
  }

  try {
    const team = await dbGet('SELECT leader_reg_no FROM teams WHERE LOWER(name) = ? AND LOWER(leader_name) = ?', 
      [teamName.toLowerCase(), leaderName.toLowerCase()]);
      
    if (!team) {
      return res.status(401).json({ error: 'Invalid team name or leader name provided.' });
    }

    res.json({ leaderRegNo: team.leader_reg_no });
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

  // Validate mobile is exactly 10 digits
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
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

// Event Management - Add Event
app.post('/api/add-event', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Event name is required.' });
  }
  try {
    const existing = await dbGet('SELECT id FROM events WHERE LOWER(name) = ?', [name.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'An event with this name already exists.' });
    }
    const id = `E-${Date.now()}`;
    await dbRun('INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)', [id, name.trim(), Date.now()]);
    res.json({ success: true, event: { id, name: name.trim() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Event Management - Delete Event
app.post('/api/delete-event', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Event ID is required.' });
  }
  try {
    await dbRun('DELETE FROM events WHERE id = ?', [id]);
    res.json({ success: true });
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

  // Check if points system is active
  const active = await isPointsSystemActive();
  if (!active) {
    return res.status(403).json({ error: 'Point allocation is currently STOPPED by Administrator. QR scanning is temporarily paused.' });
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

    // Clean up any stale pending scans for this team older than 2 minutes
    await dbRun(
      "UPDATE scans SET status = 'cancelled' WHERE team_id = ? AND status = 'pending' AND timestamp < ?",
      [teamId, Date.now() - 120000]
    );

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

  // Check if points system is active
  const active = await isPointsSystemActive();
  if (!active) {
    return res.status(403).json({ error: 'Point allocation is currently STOPPED by Administrator.' });
  }

  try {
    const scan = await dbGet(
      "SELECT * FROM scans WHERE team_id = ? AND code = ? AND status = 'pending' ORDER BY timestamp DESC LIMIT 1",
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

    // 2. Cancel any other pending scans for this team so no dangling state remains
    await dbRun(
      "UPDATE scans SET status = 'cancelled' WHERE team_id = ? AND status = 'pending'",
      [teamId]
    );

    // 3. Award +10 points to student team
    await dbRun(
      "UPDATE teams SET points = points + 10 WHERE id = ?",
      [teamId]
    );

    // 4. Award +5 points to scanner
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
    const defaultPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2306b6d4' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    const teams = [
      ['T-1001', 'Alpha Coders', 'John Doe', 'REG001', 3, JSON.stringify(['John Doe', 'Alice Smith', 'Bob Johnson']), 40, timestamp - 3600000 * 5, 'Agentic Ai Day', defaultPhoto, 'A1B2C3'],
      ['T-1002', 'Beta Blockers', 'Mary Sue', 'REG002', 2, JSON.stringify(['Mary Sue', 'Dave Miller']), 20, timestamp - 3600000 * 4, 'Agentic Ai Day', defaultPhoto, 'D4E5F6'],
      ['T-1003', 'Gamma Geniuses', 'Sarah Connor', 'REG003', 4, JSON.stringify(['Sarah Connor', 'Kyle Reese', 'John Connor', 'T-800']), 50, timestamp - 3600000 * 3, 'Agentic Ai Day', defaultPhoto, 'G7H8I9'],
      ['T-1004', 'Delta Devs', 'Bruce Wayne', 'REG004', 3, JSON.stringify(['Bruce Wayne', 'Clark Kent', 'Diana Prince']), 10, timestamp - 3600000 * 2, 'Agentic Ai Day', defaultPhoto, 'J0K1L2']
    ];
    for (const team of teams) {
      await dbRun(`INSERT INTO teams (id, name, leader_name, leader_reg_no, member_count, members, points, registered_at, event, leader_photo, unique_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, team);
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

    // Seed Events if deleted
    const existingEvents = await dbAll("SELECT id FROM events");
    if (existingEvents.length === 0) {
      const defaultEvents = [
        ['E-1', 'Agentic Ai Day', Date.now()]
      ];
      for (const evt of defaultEvents) {
        await dbRun("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)", evt);
      }
    }

    res.json({ success: true, message: 'Database seeded with mock data.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Tools - Reset Points Only (Preserves teams, visitors, faculty, and events)
app.post('/api/reset-points', async (req, res) => {
  try {
    await dbRun('UPDATE teams SET points = 0');
    await dbRun('UPDATE visitors SET points = 0');
    await dbRun('UPDATE faculty SET points = 0');
    await dbRun('DELETE FROM scans');

    res.json({ success: true, message: 'All points and scan logs have been reset to 0 while preserving registered teams and accounts.' });
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
    await dbRun('DELETE FROM events');

    const defaultEvents = [
      ['E-1', 'Agentic Ai Day', Date.now()]
    ];
    for (const evt of defaultEvents) {
      await dbRun("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)", evt);
    }

    res.json({ success: true, message: 'Database reset.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend assets in production
app.use('/leaderboard', express.static(join(__dirname, 'dist')));
app.use(express.static(join(__dirname, 'dist')));

// Redirect all other queries to index.html for SPA router
app.get('/leaderboard/*splat', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});
app.get('*splat', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  }
});

// Start Server
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${port}`);
});
