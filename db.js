import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'rapidresolve.db');

let db;

export function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedDefaults();
  }
  return db;
}

// -----------------------------------------------------------------------------
// Schema Initialization
// -----------------------------------------------------------------------------
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'Admin',
      department TEXT DEFAULT 'Rapid Resolve Command Center',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      description TEXT NOT NULL,
      category TEXT,
      urgency TEXT DEFAULT 'MEDIUM',
      department TEXT,
      location_name TEXT,
      latitude REAL,
      longitude REAL,
      sla_deadline TEXT,
      is_emergency INTEGER DEFAULT 0,
      status TEXT DEFAULT 'OPEN',
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolution_notes TEXT,
      sms_dispatched INTEGER DEFAULT 0,
      sms_channel TEXT,
      sms_body TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log('✅ SQLite schema initialized (users, admins, tickets, feedback).');
}

// -----------------------------------------------------------------------------
// Seed Default Data
// -----------------------------------------------------------------------------
function seedDefaults() {
  // Seed default admin if none exist
  const adminCount = db.prepare('SELECT COUNT(*) as cnt FROM admins').get();
  if (adminCount.cnt === 0) {
    const hash = bcrypt.hashSync('rapidresolve2026', 10);
    db.prepare(
      'INSERT INTO admins (admin_id, password_hash, role, department) VALUES (?, ?, ?, ?)'
    ).run('admin', hash, 'Chief Incident Commander', 'Rapid Resolve Unified Command Center');
    console.log('✅ Default admin seeded (admin / rapidresolve2026).');
  }

  // Seed sample tickets if none exist
  const ticketCount = db.prepare('SELECT COUNT(*) as cnt FROM tickets').get();
  if (ticketCount.cnt === 0) {
    const sampleTickets = [
      {
        id: 4820,
        description: 'Fallen storm tree branch obstructing municipal park pedestrian walkway',
        category: 'Parks, Trees & Horticulture',
        urgency: 'LOW',
        department: 'Parks, Trees & Horticulture',
        location_name: 'Central City Park, Gate 4',
        latitude: 19.8740,
        longitude: 75.3410,
        sla_deadline: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        is_emergency: 0,
        status: 'RESOLVED',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolution_notes: 'Horticulture quick-response unit cleared the fallen timber and reopened pedestrian path.'
      },
      {
        id: 4821,
        description: 'High-pressure water pipeline rupture flooding arterial road',
        category: 'Water Supply',
        urgency: 'HIGH',
        department: 'Municipal Works',
        location_name: 'Sector 5, Crossroad 3',
        latitude: 19.8762,
        longitude: 75.3433,
        sla_deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        is_emergency: 0,
        status: 'IN_PROGRESS',
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        resolved_at: null,
        resolution_notes: null
      },
      {
        id: 4822,
        description: 'Transformer explosion with active electrical sparks near primary school',
        category: 'Electricity',
        urgency: 'CRITICAL',
        department: 'Emergency Response',
        location_name: 'Shivaji Square, Sector 8',
        latitude: 19.8820,
        longitude: 75.3500,
        sla_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        is_emergency: 1,
        status: 'DISPATCHED',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        resolved_at: null,
        resolution_notes: null
      },
      {
        id: 4823,
        description: 'Severe structural pothole causing recurring motorcycle collisions',
        category: 'Roads',
        urgency: 'MEDIUM',
        department: 'Traffic & Safety',
        location_name: 'Ring Road Bypass',
        latitude: 19.8690,
        longitude: 75.3380,
        sla_deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        is_emergency: 0,
        status: 'OPEN',
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        resolved_at: null,
        resolution_notes: null
      },
      {
        id: 4824,
        description: 'Illegal toxic chemical dumping behind community health clinic',
        category: 'Sanitation',
        urgency: 'HIGH',
        department: 'Public Health',
        location_name: 'Industrial Area Zone 2',
        latitude: 19.8910,
        longitude: 75.3620,
        sla_deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        is_emergency: 0,
        status: 'OPEN',
        created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        resolved_at: null,
        resolution_notes: null
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO tickets (id, description, category, urgency, department, location_name, latitude, longitude, sla_deadline, is_emergency, status, created_at, resolved_at, resolution_notes)
      VALUES (@id, @description, @category, @urgency, @department, @location_name, @latitude, @longitude, @sla_deadline, @is_emergency, @status, @created_at, @resolved_at, @resolution_notes)
    `);

    const insertMany = db.transaction((tickets) => {
      for (const t of tickets) insertStmt.run(t);
    });
    insertMany(sampleTickets);
    console.log(`✅ ${sampleTickets.length} sample tickets seeded.`);
  }
}

// -----------------------------------------------------------------------------
// User CRUD
// -----------------------------------------------------------------------------
export function createUser(name, email, password, phone) {
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(
    'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name, email, hash, phone || null);
  return { id: result.lastInsertRowid, name, email, phone };
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function verifyUserPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

// -----------------------------------------------------------------------------
// Admin CRUD
// -----------------------------------------------------------------------------
export function getAdminByAdminId(adminId) {
  return db.prepare('SELECT * FROM admins WHERE admin_id = ?').get(adminId);
}

export function verifyAdminPassword(admin, password) {
  return bcrypt.compareSync(password, admin.password_hash);
}

// -----------------------------------------------------------------------------
// Ticket CRUD
// -----------------------------------------------------------------------------
export function getAllTickets() {
  return db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
}

export function getTicketById(id) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

export function createTicket(data) {
  const stmt = db.prepare(`
    INSERT INTO tickets (user_id, description, category, urgency, department, location_name, latitude, longitude, sla_deadline, is_emergency, status, created_at)
    VALUES (@user_id, @description, @category, @urgency, @department, @location_name, @latitude, @longitude, @sla_deadline, @is_emergency, @status, @created_at)
  `);
  const result = stmt.run({
    user_id: data.user_id || null,
    description: data.description,
    category: data.category,
    urgency: data.urgency,
    department: data.department,
    location_name: data.location_name || 'Civic Zone Marker',
    latitude: data.latitude,
    longitude: data.longitude,
    sla_deadline: data.sla_deadline,
    is_emergency: data.is_emergency ? 1 : 0,
    status: data.status || 'OPEN',
    created_at: data.created_at || new Date().toISOString()
  });
  return getTicketById(result.lastInsertRowid);
}

export function updateTicket(id, updates) {
  const fields = [];
  const values = {};

  if (updates.urgency !== undefined) { fields.push('urgency = @urgency'); values.urgency = updates.urgency; }
  if (updates.department !== undefined) { fields.push('department = @department'); values.department = updates.department; }
  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
    if (updates.status === 'RESOLVED') {
      fields.push("resolved_at = COALESCE(resolved_at, datetime('now'))");
      if (updates.resolution_notes) {
        fields.push('resolution_notes = @resolution_notes');
        values.resolution_notes = updates.resolution_notes;
      } else {
        fields.push("resolution_notes = COALESCE(resolution_notes, 'Incident inspected and confirmed resolved by municipal command.')");
      }
    }
  }
  if (updates.resolution_notes !== undefined && updates.status !== 'RESOLVED') {
    fields.push('resolution_notes = @resolution_notes');
    values.resolution_notes = updates.resolution_notes;
  }

  if (fields.length === 0) return getTicketById(id);

  values.id = id;
  const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  return getTicketById(id);
}

export function deleteTicket(id) {
  const ticket = getTicketById(id);
  if (!ticket) return null;
  db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  return ticket;
}

// -----------------------------------------------------------------------------
// Feedback CRUD
// -----------------------------------------------------------------------------
export function createFeedback(ticketId, userId, rating, comment) {
  const stmt = db.prepare(
    'INSERT INTO feedback (ticket_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(ticketId, userId || null, rating, comment || null);
  return db.prepare('SELECT * FROM feedback WHERE id = ?').get(result.lastInsertRowid);
}

export function getFeedbackForTicket(ticketId) {
  return db.prepare(`
    SELECT f.*, u.name as user_name, u.email as user_email
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE f.ticket_id = ?
    ORDER BY f.created_at DESC
  `).all(ticketId);
}

export function getAverageFeedbackRating(ticketId) {
  const result = db.prepare(
    'SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM feedback WHERE ticket_id = ?'
  ).get(ticketId);
  return { avgRating: result.avg_rating ? Math.round(result.avg_rating * 10) / 10 : null, total: result.total };
}
