<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database Configuration
$dbPath = __DIR__ . '/hackathon.db';
try {
    $pdo = new PDO("sqlite:$dbPath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed: " . $e->getMessage()]);
    exit();
}
// Initialize tables if they don't exist
$pdo->exec("
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      leader_name TEXT,
      leader_reg_no TEXT UNIQUE,
      member_count INTEGER,
      members TEXT, -- JSON string array
      points INTEGER DEFAULT 0,
      registered_at INTEGER,
      event TEXT,
      leader_photo TEXT
    )
");

try {
    $pdo->exec("ALTER TABLE teams ADD COLUMN event TEXT");
} catch (Exception $e) {
    // Ignore error if column already exists
}

try {
    $pdo->exec("ALTER TABLE teams ADD COLUMN leader_photo TEXT");
} catch (Exception $e) {
    // Ignore error if column already exists
}

$pdo->exec("
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      created_at INTEGER
    )
");

// Seed default events if events table is empty
$count = $pdo->query("SELECT COUNT(*) as count FROM events")->fetch()['count'];
if ($count == 0) {
    $defaultEvents = [
        ['E-1', 'Agentic Ai Day', round(microtime(true) * 1000)]
    ];
    $ins = $pdo->prepare("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)");
    foreach ($defaultEvents as $evt) {
        $ins->execute($evt);
    }
}

$pdo->exec("
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      name TEXT,
      mobile TEXT UNIQUE,
      password TEXT,
      points INTEGER DEFAULT 0,
      registered_at INTEGER
    )
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      name TEXT,
      password TEXT,
      points INTEGER DEFAULT 0,
      registered_at INTEGER
    )
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      team_id TEXT,
      scanner_id TEXT,
      scanner_name TEXT,
      scanner_type TEXT,
      code TEXT,
      status TEXT, -- 'pending', 'approved', 'rejected'
      timestamp INTEGER,
      approved_at INTEGER
    )
");

// Route helper
$route = isset($_GET['route']) ? $_GET['route'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Helper to get JSON input
function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

// Helper to generate unique 4-digit OTP
function generateUniqueOTP($pdo) {
    $stmt = $pdo->query("SELECT code FROM scans WHERE status = 'pending'");
    $scans = $stmt->fetchAll();
    $activeOTPs = [];
    foreach ($scans as $s) {
        $activeOTPs[] = $s['code'];
    }
    
    $otp = '';
    $attempts = 0;
    do {
        $otp = (string)rand(1000, 9999);
        $attempts++;
    } while (in_array($otp, $activeOTPs) && $attempts < 1000);
    
    return $otp;
}

// Router Switchboard
switch ($route) {
    case 'data':
        if ($method === 'GET') {
            try {
                $teams = $pdo->query("SELECT * FROM teams")->fetchAll();
                $visitors = $pdo->query("SELECT * FROM visitors")->fetchAll();
                $faculty = $pdo->query("SELECT * FROM faculty")->fetchAll();
                $scans = $pdo->query("SELECT * FROM scans")->fetchAll();
                $events = $pdo->query("SELECT * FROM events ORDER BY created_at ASC")->fetchAll();
                
                // Decode team members list
                foreach ($teams as &$t) {
                    $t['members'] = json_decode($t['members'] ?? '[]', true);
                }
                
                echo json_encode([
                    "teams" => $teams,
                    "visitors" => $visitors,
                    "faculty" => $faculty,
                    "scans" => $scans,
                    "events" => $events
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'register-team':
        if ($method === 'POST') {
            $input = getJsonInput();
            $name = $input['name'] ?? '';
            $leaderName = $input['leaderName'] ?? '';
            $leaderRegNo = $input['leaderRegNo'] ?? '';
            $memberCount = $input['memberCount'] ?? 1;
            $membersList = $input['members'] ?? [];
            $event = $input['event'] ?? '';
            $leaderPhoto = $input['leaderPhoto'] ?? '';

            if (empty($name) || empty($leaderName) || empty($leaderRegNo) || empty($event)) {
                http_response_code(400);
                echo json_encode(["error" => "Team name, leader name, registration number, and event are required."]);
                exit();
            }

            if (empty($leaderPhoto)) {
                http_response_code(400);
                echo json_encode(["error" => "Leader photo is required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT id FROM teams WHERE LOWER(name) = ?");
                $stmt->execute([strtolower($name)]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(["error" => "A team with this name already exists."]);
                    exit();
                }

                $stmt = $pdo->prepare("SELECT id FROM teams WHERE leader_reg_no = ?");
                $stmt->execute([$leaderRegNo]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(["error" => "A team leader with this registration number is already registered."]);
                    exit();
                }

                $count = $pdo->query("SELECT COUNT(*) as count FROM teams")->fetch()['count'];
                $teamId = "T-" . (1000 + $count + 1);
                $timestamp = round(microtime(true) * 1000);

                $stmt = $pdo->prepare("INSERT INTO teams (id, name, leader_name, leader_reg_no, member_count, members, points, registered_at, event, leader_photo) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)");
                $stmt->execute([$teamId, $name, $leaderName, $leaderRegNo, (int)$memberCount, json_encode($membersList), $timestamp, $event, $leaderPhoto]);

                echo json_encode([
                    "id" => $teamId,
                    "name" => $name,
                    "leaderName" => $leaderName,
                    "leaderRegNo" => $leaderRegNo,
                    "memberCount" => (int)$memberCount,
                    "members" => $membersList,
                    "points" => 0,
                    "registeredAt" => $timestamp,
                    "event" => $event,
                    "leaderPhoto" => $leaderPhoto
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'login-team':
        if ($method === 'POST') {
            $input = getJsonInput();
            $name = $input['name'] ?? '';
            $leaderRegNo = $input['leaderRegNo'] ?? '';

            if (empty($name) || empty($leaderRegNo)) {
                http_response_code(400);
                echo json_encode(["error" => "Team name and leader registration number are required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT * FROM teams WHERE LOWER(name) = ? AND leader_reg_no = ?");
                $stmt->execute([strtolower($name), $leaderRegNo]);
                $team = $stmt->fetch();

                if (!$team) {
                    http_response_code(401);
                    echo json_encode(["error" => "Invalid Team Name or Leader Registration Number."]);
                    exit();
                }

                $team['members'] = json_decode($team['members'] ?? '[]', true);
                echo json_encode($team);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'register-visitor':
        if ($method === 'POST') {
            $input = getJsonInput();
            $name = $input['name'] ?? '';
            $mobile = $input['mobile'] ?? '';
            $password = $input['password'] ?? '';

            if (empty($name) || empty($mobile) || empty($password)) {
                http_response_code(400);
                echo json_encode(["error" => "Name, mobile number, and password are required."]);
                exit();
            }

            // Enforce exactly 10-digit mobile number
            if (!preg_match('/^\d{10}$/', $mobile)) {
                http_response_code(400);
                echo json_encode(["error" => "Mobile number must be exactly 10 digits."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT id FROM visitors WHERE mobile = ?");
                $stmt->execute([$mobile]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(["error" => "This mobile number is already registered."]);
                    exit();
                }

                $count = $pdo->query("SELECT COUNT(*) as count FROM visitors")->fetch()['count'];
                $visitorId = "V-" . (2000 + $count + 1);
                $timestamp = round(microtime(true) * 1000);

                $stmt = $pdo->prepare("INSERT INTO visitors (id, name, mobile, password, points, registered_at) VALUES (?, ?, ?, ?, 0, ?)");
                $stmt->execute([$visitorId, $name, $mobile, $password, $timestamp]);

                echo json_encode([
                    "id" => $visitorId,
                    "name" => $name,
                    "mobile" => $mobile,
                    "points" => 0,
                    "registeredAt" => $timestamp
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'add-event':
        if ($method === 'POST') {
            $input = getJsonInput();
            $name = $input['name'] ?? '';
            if (empty($name)) {
                http_response_code(400);
                echo json_encode(["error" => "Event name is required."]);
                exit();
            }
            try {
                $stmt = $pdo->prepare("SELECT id FROM events WHERE LOWER(name) = ?");
                $stmt->execute([strtolower($name)]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(["error" => "An event with this name already exists."]);
                    exit();
                }
                $id = "E-" . round(microtime(true) * 1000);
                $stmt = $pdo->prepare("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)");
                $stmt->execute([$id, $name, round(microtime(true) * 1000)]);
                echo json_encode(["success" => true, "event" => ["id" => $id, "name" => $name]]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'delete-event':
        if ($method === 'POST') {
            $input = getJsonInput();
            $id = $input['id'] ?? '';
            if (empty($id)) {
                http_response_code(400);
                echo json_encode(["error" => "Event ID is required."]);
                exit();
            }
            try {
                $stmt = $pdo->prepare("DELETE FROM events WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode(["success" => true]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'login-visitor':
        if ($method === 'POST') {
            $input = getJsonInput();
            $mobile = $input['mobile'] ?? '';
            $password = $input['password'] ?? '';

            if (empty($mobile) || empty($password)) {
                http_response_code(400);
                echo json_encode(["error" => "Mobile number and password are required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT * FROM visitors WHERE mobile = ? AND password = ?");
                $stmt->execute([$mobile, $password]);
                $visitor = $stmt->fetch();

                if (!$visitor) {
                    http_response_code(401);
                    echo json_encode(["error" => "Invalid Mobile Number or Password."]);
                    exit();
                }

                echo json_encode([
                    "id" => $visitor['id'],
                    "name" => $visitor['name'],
                    "mobile" => $visitor['mobile'],
                    "points" => (int)$visitor['points'],
                    "registeredAt" => (int)$visitor['registered_at']
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'register-faculty':
        if ($method === 'POST') {
            $input = getJsonInput();
            $facultyId = $input['facultyId'] ?? '';
            $name = $input['name'] ?? '';
            $password = $input['password'] ?? '';

            if (empty($facultyId) || empty($name) || empty($password)) {
                http_response_code(400);
                echo json_encode(["error" => "Faculty ID, name, and password are required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT id FROM faculty WHERE LOWER(id) = ?");
                $stmt->execute([strtolower($facultyId)]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(["error" => "This Faculty ID is already registered."]);
                    exit();
                }

                $timestamp = round(microtime(true) * 1000);
                $stmt = $pdo->prepare("INSERT INTO faculty (id, name, password, points, registered_at) VALUES (?, ?, ?, 0, ?)");
                $stmt->execute([$facultyId, $name, $password, $timestamp]);

                echo json_encode([
                    "id" => $facultyId,
                    "name" => $name,
                    "points" => 0,
                    "registeredAt" => $timestamp
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'login-faculty':
        if ($method === 'POST') {
            $input = getJsonInput();
            $facultyId = $input['facultyId'] ?? '';
            $password = $input['password'] ?? '';

            if (empty($facultyId) || empty($password)) {
                http_response_code(400);
                echo json_encode(["error" => "Faculty ID and password are required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT * FROM faculty WHERE LOWER(id) = ? AND password = ?");
                $stmt->execute([strtolower($facultyId), $password]);
                $faculty = $stmt->fetch();

                if (!$faculty) {
                    http_response_code(401);
                    echo json_encode(["error" => "Invalid Faculty ID or Password."]);
                    exit();
                }

                echo json_encode([
                    "id" => $faculty['id'],
                    "name" => $faculty['name'],
                    "points" => (int)$faculty['points'],
                    "registeredAt" => (int)$faculty['registered_at']
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'initiate-scan':
        if ($method === 'POST') {
            $input = getJsonInput();
            $teamId = $input['teamId'] ?? '';
            $scannerId = $input['scannerId'] ?? '';
            $scannerName = $input['scannerName'] ?? '';
            $scannerType = $input['scannerType'] ?? '';

            if (empty($teamId) || empty($scannerId) || empty($scannerName) || empty($scannerType)) {
                http_response_code(400);
                echo json_encode(["error" => "Missing scanning details."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT id FROM teams WHERE id = ?");
                $stmt->execute([$teamId]);
                if (!$stmt->fetch()) {
                    http_response_code(404);
                    echo json_encode(["error" => "Invalid Team QR Code."]);
                    exit();
                }

                $stmt = $pdo->prepare("SELECT id FROM scans WHERE team_id = ? AND scanner_id = ? AND status = 'approved'");
                $stmt->execute([$teamId, $scannerId]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(["error" => "You have already scanned this team's QR code!"]);
                    exit();
                }

                $stmt = $pdo->prepare("SELECT id FROM scans WHERE team_id = ? AND scanner_id = ? AND status = 'pending'");
                $stmt->execute([$teamId, $scannerId]);
                $existingPending = $stmt->fetch();

                $otp = generateUniqueOTP($pdo);
                $scanId = "S-" . round(microtime(true) * 1000) . "-" . rand(0, 999);
                $timestamp = round(microtime(true) * 1000);

                if ($existingPending) {
                    $stmt = $pdo->prepare("UPDATE scans SET code = ?, timestamp = ?, id = ? WHERE id = ?");
                    $stmt->execute([$otp, $timestamp, $scanId, $existingPending['id']]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO scans (id, team_id, scanner_id, scanner_name, scanner_type, code, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)");
                    $stmt->execute([$scanId, $teamId, $scannerId, $scannerName, $scannerType, $otp, $timestamp]);
                }

                echo json_encode([
                    "id" => $scanId,
                    "teamId" => $teamId,
                    "scannerId" => $scannerId,
                    "scannerName" => $scannerName,
                    "scannerType" => $scannerType,
                    "code" => $otp,
                    "status" => 'pending',
                    "timestamp" => $timestamp
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'approve-scan':
        if ($method === 'POST') {
            $input = getJsonInput();
            $teamId = $input['teamId'] ?? '';
            $code = $input['code'] ?? '';

            if (empty($teamId) || empty($code)) {
                http_response_code(400);
                echo json_encode(["error" => "Team ID and verification code are required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("SELECT * FROM scans WHERE team_id = ? AND code = ? AND status = 'pending'");
                $stmt->execute([$teamId, $code]);
                $scan = $stmt->fetch();

                if (!$scan) {
                    http_response_code(400);
                    echo json_encode(["error" => "Invalid or expired verification code."]);
                    exit();
                }

                $approvedAt = round(microtime(true) * 1000);

                // Approve scan
                $stmt = $pdo->prepare("UPDATE scans SET status = 'approved', approved_at = ? WHERE id = ?");
                $stmt->execute([$approvedAt, $scan['id']]);

                // Add points to team (+10)
                $stmt = $pdo->prepare("UPDATE teams SET points = points + 10 WHERE id = ?");
                $stmt->execute([$teamId]);

                // Add points to scanner (+5)
                if ($scan['scanner_type'] === 'visitor') {
                    $stmt = $pdo->prepare("UPDATE visitors SET points = points + 5 WHERE id = ?");
                    $stmt->execute([$scan['scanner_id']]);
                } else if ($scan['scanner_type'] === 'faculty') {
                    $stmt = $pdo->prepare("UPDATE faculty SET points = points + 5 WHERE id = ?");
                    $stmt->execute([$scan['scanner_id']]);
                }

                echo json_encode(["success" => true, "message" => "Scan approved successfully!"]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'reject-scan':
        if ($method === 'POST') {
            $input = getJsonInput();
            $scanId = $input['scanId'] ?? '';

            if (empty($scanId)) {
                http_response_code(400);
                echo json_encode(["error" => "Scan ID is required."]);
                exit();
            }

            try {
                $stmt = $pdo->prepare("UPDATE scans SET status = 'rejected' WHERE id = ?");
                $stmt->execute([$scanId]);
                echo json_encode(["success" => true]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;
    case 'seed':
        if ($method === 'POST') {
            try {
                $pdo->exec("DELETE FROM teams");
                $pdo->exec("DELETE FROM visitors");
                $pdo->exec("DELETE FROM faculty");
                $pdo->exec("DELETE FROM scans");

                $timestamp = round(microtime(true) * 1000);

                // Seed Teams
                $defaultPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2306b6d4' width='100' height='100'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
                $teams = [
                    ['T-1001', 'Alpha Coders', 'John Doe', 'REG001', 3, json_encode(['John Doe', 'Alice Smith', 'Bob Johnson']), 40, $timestamp - 3600000 * 5, 'Agentic Ai Day', $defaultPhoto],
                    ['T-1002', 'Beta Blockers', 'Mary Sue', 'REG002', 2, json_encode(['Mary Sue', 'Dave Miller']), 20, $timestamp - 3600000 * 4, 'Agentic Ai Day', $defaultPhoto],
                    ['T-1003', 'Gamma Geniuses', 'Sarah Connor', 'REG003', 4, json_encode(['Sarah Connor', 'Kyle Reese', 'John Connor', 'T-800']), 50, $timestamp - 3600000 * 3, 'Agentic Ai Day', $defaultPhoto],
                    ['T-1004', 'Delta Devs', 'Bruce Wayne', 'REG004', 3, json_encode(['Bruce Wayne', 'Clark Kent', 'Diana Prince']), 10, $timestamp - 3600000 * 2, 'Agentic Ai Day', $defaultPhoto]
                ];
                $stmt = $pdo->prepare("INSERT INTO teams (id, name, leader_name, leader_reg_no, member_count, members, points, registered_at, event, leader_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($teams as $team) {
                    $stmt->execute($team);
                }

                // Seed Visitors
                $visitors = [
                    ['V-2001', 'Elon Musk', '9876543210', 'password123', 20, $timestamp - 3600000],
                    ['V-2002', 'Sam Altman', '8765432109', 'password123', 10, $timestamp - 300000],
                    ['V-2003', 'Ada Lovelace', '7654321098', 'password123', 30, $timestamp - 500000]
                ];
                $stmt = $pdo->prepare("INSERT INTO visitors (id, name, mobile, password, points, registered_at) VALUES (?, ?, ?, ?, ?, ?)");
                foreach ($visitors as $vis) {
                    $stmt->execute($vis);
                }

                // Seed Faculty
                $faculty = [
                    ['F-3001', 'Dr. Alan Turing', 'admin', 20, $timestamp - 3600000 * 6]
                ];
                $stmt = $pdo->prepare("INSERT INTO faculty (id, name, password, points, registered_at) VALUES (?, ?, ?, ?, ?)");
                foreach ($faculty as $fac) {
                    $stmt->execute($fac);
                }

                // Seed Scans
                $scans = [
                    ['S-1', 'T-1001', 'V-2001', 'Elon Musk', 'visitor', '1111', 'approved', $timestamp - 600000, $timestamp - 550000],
                    ['S-2', 'T-1001', 'V-2002', 'Sam Altman', 'visitor', '2222', 'approved', $timestamp - 500000, $timestamp - 480000],
                    ['S-3', 'T-1002', 'V-2001', 'Elon Musk', 'visitor', '3333', 'approved', $timestamp - 400000, $timestamp - 390000],
                    ['S-4', 'T-1003', 'V-2003', 'Ada Lovelace', 'visitor', '4444', 'approved', $timestamp - 300000, $timestamp - 280000],
                    ['S-5', 'T-1003', 'F-3001', 'Dr. Alan Turing', 'faculty', '5555', 'approved', $timestamp - 200000, $timestamp - 190000]
                ];
                $stmt = $pdo->prepare("INSERT INTO scans (id, team_id, scanner_id, scanner_name, scanner_type, code, status, timestamp, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($scans as $scan) {
                    $stmt->execute($scan);
                }

                // Seed Events if empty
                $count = $pdo->query("SELECT COUNT(*) as count FROM events")->fetch()['count'];
                if ($count == 0) {
                    $defaultEvents = [
                        ['E-1', 'Agentic Ai Day', round(microtime(true) * 1000)]
                    ];
                    $ins = $pdo->prepare("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)");
                    foreach ($defaultEvents as $evt) {
                        $ins->execute($evt);
                    }
                }

                echo json_encode(["success" => true, "message" => "Database seeded."]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;

    case 'reset':
        if ($method === 'POST') {
            try {
                $pdo->exec("DELETE FROM teams");
                $pdo->exec("DELETE FROM visitors");
                $pdo->exec("DELETE FROM faculty");
                $pdo->exec("DELETE FROM scans");
                $pdo->exec("DELETE FROM events");

                $defaultEvents = [
                    ['E-1', 'Agentic Ai Day', round(microtime(true) * 1000)]
                ];
                $ins = $pdo->prepare("INSERT INTO events (id, name, created_at) VALUES (?, ?, ?)");
                foreach ($defaultEvents as $evt) {
                    $ins->execute($evt);
                }

                echo json_encode(["success" => true, "message" => "Database reset."]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(["error" => $e->getMessage()]);
            }
        }
        break;
    default:
        http_response_code(404);
        echo json_encode(["error" => "Endpoint not found."]);
        break;
}
