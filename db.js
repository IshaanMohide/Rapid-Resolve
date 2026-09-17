import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'rapidresolve.db');
export const CSV_PATH = path.join(__dirname, 'feedback_records.csv');

// -----------------------------------------------------------------------------
// Real-Time Event Bus & In-Memory Transaction Log
// -----------------------------------------------------------------------------
export const dbEventEmitter = new EventEmitter();
// Max listeners increased for multiple SSE connections
dbEventEmitter.setMaxListeners(200);

const MAX_EVENT_HISTORY = 50;
const recentDBEvents = [];

function recordRealtimeEvent(type, table, record, summary) {
  const eventObj = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,       // 'INSERT', 'UPDATE', 'DELETE'
    table,      // 'users', 'tickets', 'feedback', 'admins'
    summary: summary || `${type} operation on table ${table}`,
    record,
    timestamp: new Date().toISOString()
  };

  recentDBEvents.unshift(eventObj);
  if (recentDBEvents.length > MAX_EVENT_HISTORY) {
    recentDBEvents.pop();
  }

  // Broadcast to all internal listeners and SSE stream
  dbEventEmitter.emit('db:change', eventObj);
  dbEventEmitter.emit(`${table}:${type.toLowerCase()}`, eventObj);

  return eventObj;
}

export function getRecentDBEvents() {
  return [...recentDBEvents];
}

// -----------------------------------------------------------------------------
// Resilient Database Connection Singleton
// -----------------------------------------------------------------------------
let db = null;

export function getDB() {
  if (!db) {
    try {
      db = new Database(DB_PATH, { timeout: 10000 });
      // Configure high-concurrency WAL mode & busy timeout to eliminate locks
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 10000');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -64000'); // 64MB cache
      db.pragma('foreign_keys = ON');

      initSchema(db);
      seedDefaults(db);
      syncFeedbackToCSV();
      console.log('⚡ Real-Time SQLite Database connected with WAL mode & reactive event bus.');
    } catch (err) {
      console.error('CRITICAL: Failed to initialize SQLite database:', err);
      throw err;
    }
  }
  return db;
}

// -----------------------------------------------------------------------------
// Schema Initialization
// -----------------------------------------------------------------------------
function initSchema(database) {
  database.exec(`
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

  console.log('✅ SQLite schema validated (users, admins, tickets, feedback).');
}

// -----------------------------------------------------------------------------
// Seed Default Data
// -----------------------------------------------------------------------------
function seedDefaults(database) {
  // Synchronize admin credentials with admin_credentials.json
  const credPath = path.join(__dirname, 'admin_credentials.json');
  let credId = 'admin';
  let credPass = 'rapidresolve2026';
  let credRole = 'Chief Incident Commander';
  let credDept = 'Rapid Resolve Unified Command Center';

  try {
    if (fs.existsSync(credPath)) {
      const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (raw.adminId) credId = String(raw.adminId).trim();
      if (raw.password) credPass = String(raw.password).trim();
      if (raw.role) credRole = String(raw.role).trim();
      if (raw.department) credDept = String(raw.department).trim();
    }
  } catch (err) {
    console.warn('Note: Could not parse admin_credentials.json, using defaults:', err.message);
  }

  const existingAdmin = database.prepare('SELECT * FROM admins WHERE LOWER(admin_id) = ?').get(credId.toLowerCase());
  const hash = bcrypt.hashSync(credPass, 10);

  if (!existingAdmin) {
    database.prepare(
      'INSERT INTO admins (admin_id, password_hash, role, department) VALUES (?, ?, ?, ?)'
    ).run(credId, hash, credRole, credDept);
    console.log(`✅ Default admin seeded in SQLite (${credId} / ${credPass}).`);
  } else {
    // Keep password and role synchronized with credentials file
    database.prepare(
      'UPDATE admins SET password_hash = ?, role = ?, department = ? WHERE id = ?'
    ).run(hash, credRole, credDept, existingAdmin.id);
  }

  // Ensure admin is also synced in users table for universal fallback login
  const existingUserAdmin = database.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get('admin');
  if (!existingUserAdmin) {
    database.prepare(
      'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)'
    ).run('Chief Incident Commander', 'admin', hash, '+91 99999 00000');
  } else {
    database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existingUserAdmin.id);
  }

  // Seed sample tickets if none exist
  const ticketCount = database.prepare('SELECT COUNT(*) as cnt FROM tickets').get();
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

    const insertStmt = database.prepare(`
      INSERT INTO tickets (id, description, category, urgency, department, location_name, latitude, longitude, sla_deadline, is_emergency, status, created_at, resolved_at, resolution_notes)
      VALUES (@id, @description, @category, @urgency, @department, @location_name, @latitude, @longitude, @sla_deadline, @is_emergency, @status, @created_at, @resolved_at, @resolution_notes)
    `);

    const insertMany = database.transaction((tickets) => {
      for (const t of tickets) insertStmt.run(t);
    });
    insertMany(sampleTickets);
    console.log(`✅ ${sampleTickets.length} sample tickets seeded.`);
  }
}

// -----------------------------------------------------------------------------
// Real-Time Database Telemetry & Stats
// -----------------------------------------------------------------------------
export function getDBStats() {
  const database = getDB();
  const ticketCount = database.prepare('SELECT COUNT(*) as cnt FROM tickets').get().cnt;
  const openTickets = database.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status != 'RESOLVED'").get().cnt;
  const criticalTickets = database.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE urgency = 'CRITICAL'").get().cnt;
  const userCount = database.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const feedbackCount = database.prepare('SELECT COUNT(*) as cnt FROM feedback').get().cnt;
  const adminCount = database.prepare('SELECT COUNT(*) as cnt FROM admins').get().cnt;

  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch {}

  return {
    engine: 'SQLite WAL (Real-Time Reactive)',
    status: 'HEALTHY',
    tables: {
      tickets: ticketCount,
      openTickets,
      criticalTickets,
      users: userCount,
      feedback: feedbackCount,
      admins: adminCount
    },
    storage: {
      dbSizeKB: Math.round(dbSizeBytes / 1024),
      walMode: true,
      path: DB_PATH
    },
    realtimeEvents: {
      cachedEvents: recentDBEvents.length,
      lastEvent: recentDBEvents[0] || null
    },
    timestamp: new Date().toISOString()
  };
}

// -----------------------------------------------------------------------------
// User CRUD with Real-Time Event Dispatch
// -----------------------------------------------------------------------------
export function createUser(name, email, password, phone) {
  const database = getDB();
  const normalizedEmail = String(email).trim().toLowerCase();
  const hash = bcrypt.hashSync(password, 10);
  const stmt = database.prepare(
    'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name.trim(), normalizedEmail, hash, phone?.trim() || null);
  const createdUser = { id: Number(result.lastInsertRowid), name: name.trim(), email: normalizedEmail, phone: phone?.trim() || null };

  // Dispatch real-time event
  recordRealtimeEvent('INSERT', 'users', createdUser, `New citizen registered: ${createdUser.name} (${createdUser.email})`);

  return createdUser;
}

export function getUserByEmail(email) {
  if (!email) return null;
  const database = getDB();
  const normalizedEmail = String(email).trim().toLowerCase();
  return database.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
}

export function getUserById(id) {
  if (!id) return null;
  const database = getDB();
  return database.prepare('SELECT id, name, email, phone, created_at FROM users WHERE id = ?').get(id);
}

export function verifyUserPassword(user, password) {
  if (!user || !user.password_hash || !password) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

// -----------------------------------------------------------------------------
// Admin CRUD
// -----------------------------------------------------------------------------
export function getAdminByAdminId(adminId) {
  if (!adminId) return null;
  const database = getDB();
  const cleanId = String(adminId).trim().toLowerCase();
  return database.prepare('SELECT * FROM admins WHERE LOWER(admin_id) = ?').get(cleanId);
}

export function verifyAdminPassword(admin, password) {
  if (!admin || !admin.password_hash || !password) return false;
  return bcrypt.compareSync(password, admin.password_hash);
}

// -----------------------------------------------------------------------------
// Ticket CRUD with Real-Time Event Dispatch
// -----------------------------------------------------------------------------
export function getAllTickets() {
  const database = getDB();
  return database.prepare(`
    SELECT t.*,
           ROUND(AVG(f.rating), 1) as avg_rating,
           COUNT(f.id) as feedback_count
    FROM tickets t
    LEFT JOIN feedback f ON t.id = f.ticket_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
}

export function getTicketById(id) {
  if (!id) return null;
  const database = getDB();
  return database.prepare(`
    SELECT t.*,
           ROUND(AVG(f.rating), 1) as avg_rating,
           COUNT(f.id) as feedback_count
    FROM tickets t
    LEFT JOIN feedback f ON t.id = f.ticket_id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(id);
}

export function createTicket(data) {
  const database = getDB();
  const stmt = database.prepare(`
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

  const createdTicket = getTicketById(result.lastInsertRowid);

  // Dispatch real-time event
  recordRealtimeEvent(
    'INSERT',
    'tickets',
    createdTicket,
    `New Ticket #${createdTicket.id} [${createdTicket.urgency}]: "${createdTicket.description?.substring(0, 40)}..."`
  );

  return createdTicket;
}

export function updateTicket(id, updates) {
  const database = getDB();
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
  const stmt = database.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  const updatedTicket = getTicketById(id);

  if (updatedTicket) {
    recordRealtimeEvent(
      'UPDATE',
      'tickets',
      updatedTicket,
      `Ticket #${id} updated -> Status: ${updatedTicket.status} | Urgency: ${updatedTicket.urgency}`
    );
  }

  return updatedTicket;
}

export function deleteTicket(id) {
  const database = getDB();
  const ticket = getTicketById(id);
  if (!ticket) return null;
  database.prepare('DELETE FROM tickets WHERE id = ?').run(id);

  recordRealtimeEvent('DELETE', 'tickets', { id }, `Ticket #${id} deleted from municipal records`);

  return ticket;
}

// -----------------------------------------------------------------------------
// Feedback CRUD with Real-Time Event Dispatch
// -----------------------------------------------------------------------------
export function createFeedback(ticketId, userId, rating, comment) {
  const database = getDB();
  const stmt = database.prepare(
    'INSERT INTO feedback (ticket_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(ticketId, userId || null, rating, comment || null);
  const created = database.prepare('SELECT * FROM feedback WHERE id = ?').get(result.lastInsertRowid);
  syncFeedbackToCSV();

  recordRealtimeEvent(
    'INSERT',
    'feedback',
    created,
    `Feedback submitted for Ticket #${ticketId}: ${rating} Star(s)`
  );

  return created;
}

export function getFeedbackForTicket(ticketId) {
  const database = getDB();
  return database.prepare(`
    SELECT f.*, u.name as user_name, u.email as user_email
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE f.ticket_id = ?
    ORDER BY f.created_at DESC
  `).all(ticketId);
}

export function getAverageFeedbackRating(ticketId) {
  const database = getDB();
  const result = database.prepare(
    'SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM feedback WHERE ticket_id = ?'
  ).get(ticketId);
  return { avgRating: result.avg_rating ? Math.round(result.avg_rating * 10) / 10 : null, total: result.total };
}

export function getAllFeedback() {
  const database = getDB();
  return database.prepare(`
    SELECT f.*, u.name as user_name, u.email as user_email, t.description as ticket_description, t.category as ticket_category, t.department as ticket_department
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    LEFT JOIN tickets t ON f.ticket_id = t.id
    ORDER BY f.created_at DESC
  `).all();
}

export function syncFeedbackToCSV() {
  try {
    const feedbackRows = getAllFeedback();
    const headers = [
      'Feedback ID',
      'Ticket ID',
      'Incident Category',
      'Municipal Department',
      'Star Rating (1-5)',
      'Rating Sentiment',
      'Citizen Name',
      'Citizen Email',
      'Citizen Feedback Comment',
      'Date Submitted'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const getSentiment = (rating) => {
      switch (Number(rating)) {
        case 5: return 'Excellent';
        case 4: return 'Very Good';
        case 3: return 'Good';
        case 2: return 'Fair';
        case 1: return 'Poor';
        default: return 'Unrated';
      }
    };

    const lines = [
      headers.map(escapeCSV).join(','),
      ...feedbackRows.map(row => [
        row.id,
        row.ticket_id,
        row.ticket_category || 'General Municipal Issue',
        row.ticket_department || 'Municipal Works',
        row.rating,
        getSentiment(row.rating),
        row.user_name || 'Anonymous Citizen',
        row.user_email || 'N/A',
        row.comment || '',
        row.created_at
      ].map(escapeCSV).join(','))
    ];

    // Prepend UTF-8 BOM so Microsoft Excel directly opens with correct formatting
    fs.writeFileSync(CSV_PATH, '\uFEFF' + lines.join('\r\n'), 'utf8');
    return CSV_PATH;
  } catch (err) {
    console.error('Error syncing feedback to CSV:', err.message);
    return null;
  }
}
