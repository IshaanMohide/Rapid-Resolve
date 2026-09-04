import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;
import Anthropic from '@anthropic-ai/sdk';
import twilio from 'twilio';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// Database Layer: PostgreSQL with automatic in-memory fallback
// -----------------------------------------------------------------------------
let isPgConnected = false;
let pgPool = null;

// In-Memory Seed Storage (used as fallback or when PG is not configured)
let nextTicketId = 4825;
const inMemoryTickets = [
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
    is_emergency: false,
    status: 'IN_PROGRESS',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
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
    is_emergency: true,
    status: 'DISPATCHED',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
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
    is_emergency: false,
    status: 'OPEN',
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString()
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
    is_emergency: false,
    status: 'OPEN',
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
  }
];

if (process.env.DATABASE_URL) {
  try {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000
    });
    // Test connection
    pgPool.query('SELECT NOW()', (err) => {
      if (err) {
        console.warn('⚠️  PostgreSQL connection unavailable. Switching seamlessly to In-Memory DB mode.');
        isPgConnected = false;
      } else {
        isPgConnected = true;
        console.log('✅ PostgreSQL connected successfully.');
        initPgSchema();
      }
    });
  } catch (err) {
    console.warn('⚠️  Failed to initialize PostgreSQL pool:', err.message);
  }
} else {
  console.log('ℹ️  No DATABASE_URL provided. Rapid Resolve running with resilient In-Memory store.');
}

async function initPgSchema() {
  if (!pgPool || !isPgConnected) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        category VARCHAR(50),
        urgency VARCHAR(20),
        department VARCHAR(100),
        location_name VARCHAR(255),
        latitude NUMERIC,
        longitude NUMERIC,
        sla_deadline TIMESTAMP,
        is_emergency BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ PostgreSQL schema verified.');
  } catch (err) {
    console.error('Error initializing PostgreSQL schema:', err.message);
  }
}

// -----------------------------------------------------------------------------
// AI & SMS Clients Setup with Graceful Fallbacks
// -----------------------------------------------------------------------------
let anthropicClient = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') {
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

let twilioClient = null;
if (
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_PHONE_NUMBER
) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('Failed to initialize Twilio client:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Admin Authentication (Credentials stored in admin_credentials.json)
// -----------------------------------------------------------------------------
const CREDENTIALS_FILE = path.join(__dirname, 'admin_credentials.json');

function getAdminCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Error reading admin credentials file:', err.message);
  }
  return {
    adminId: 'admin',
    password: 'rapidresolve2026',
    role: 'Chief Incident Commander',
    department: 'Rapid Resolve Unified Command Center'
  };
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Google Gemini AI Triage Engine (Uses Gemini API Key to assign urgency & department)
// -----------------------------------------------------------------------------
const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

async function triageWithGemini(description) {
  if (!geminiApiKey) return null;

  const prompt = `You are the Rapid Resolve Enterprise AI Triage engine.
Analyze the citizen report and use your intelligence to determine:
1. The exact urgency level (CRITICAL, HIGH, MEDIUM, LOW)
2. The single most appropriate specialized municipal department from the list below
3. The category and SLA timer

AVAILABLE SPECIALIZED DEPARTMENTS:
- "Disaster Management & Flood Control": Flooding, flash floods, water submergence, heavy rain inundation, dam overflows.
- "Fire & Rescue Services": Fire outbreaks, transformer sparks/flames, building collapse, cylinder blasts, gas leaks, entrapped persons.
- "Emergency Medical & Ambulance": Road casualties, severe trauma injuries, unconscious citizens, hospital emergency transit.
- "Water Supply & Sewerage Board": Ruptured water mains, pipeline bursts, contaminated drinking water, sewer overflows, drain chokes.
- "Electricity & Power Distribution": Transformer explosion, hanging high-voltage wires, power blackout, electrical short circuits.
- "Roads, Bridges & Infrastructure": Potholes, road craters, cave-ins, flyover structural damage, broken dividers.
- "Traffic Police & Road Safety": Malfunctioning traffic lights, highway gridlocks, illegal road blocking, missing road signs.
- "Public Health, Sanitation & Waste": Stinking garbage piles, open drains, municipal solid waste, dead animal disposal.
- "Pollution Control & Environment": Toxic chemical dumping, industrial factory emissions, hazardous chemical spills.
- "Parks, Trees & Horticulture": Fallen trees blocking traffic, hazardous overgrown branches, municipal park damage.
- "Town Planning & Building Safety": Dilapidated dangerous buildings, cracking walls, illegal hazardous construction.
- "Stray Animal & Veterinary Control": Stray cattle causing road accidents, aggressive stray dogs, animal welfare.

URGENCY GUIDELINES:
- CRITICAL (<30m SLA, is_emergency=true): Active floods, submerging streets, gas leaks, active fires, building collapse, high voltage wire shock risks, fatal accidents.
- HIGH (2h SLA, is_emergency=false): Major water pipeline rupture, sewage flooding streets, total area blackout, large pothole on busy highway.
- MEDIUM (6-8h SLA, is_emergency=false): Standard potholes, traffic signal outage, garbage heap, fallen branches.
- LOW (12-24h SLA, is_emergency=false): Minor street sweeping, non-blocking park maintenance, cosmetic civic repairs.

Return ONLY valid JSON matching this schema:
{
  "category": string,
  "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "department": "Disaster Management & Flood Control" | "Fire & Rescue Services" | "Emergency Medical & Ambulance" | "Water Supply & Sewerage Board" | "Electricity & Power Distribution" | "Roads, Bridges & Infrastructure" | "Traffic Police & Road Safety" | "Public Health, Sanitation & Waste" | "Pollution Control & Environment" | "Parks, Trees & Horticulture" | "Town Planning & Building Safety" | "Stray Animal & Veterinary Control",
  "sla_hours": number,
  "is_emergency": boolean
}

Citizen Report: "${description}"`;

  const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  for (const model of models) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed.urgency && parsed.department) {
          console.log(`✅ [Gemini AI Triage (${model})] "${description}" -> Dept: "${parsed.department}" | Urgency: "${parsed.urgency}"`);
          return parsed;
        }
      }
    } catch (err) {
      console.warn(`Gemini (${model}) triage failed:`, err.response?.data?.error?.message || err.message);
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// AI Triage Function: Gemini 3.6 Flash -> Claude 3 Haiku -> Heuristic Engine
// -----------------------------------------------------------------------------
async function triageIssueWithAI(description) {
  // 1. Google Gemini Live AI Triage
  const geminiTriage = await triageWithGemini(description);
  if (geminiTriage) {
    return geminiTriage;
  }

  // 2. Anthropic Claude Triage Fallback
  if (anthropicClient) {
    try {
      const prompt = `You are the Rapid Resolve Enterprise AI Triage engine.
Analyze the following citizen report and return ONLY valid JSON matching this schema:
{
  "category": "Sanitation" | "Water Supply" | "Electricity" | "Roads" | "Public Safety" | "Medical/Fire" | "Disaster / Flood",
  "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "department": "Emergency Response" | "Municipal Works" | "Public Health" | "Traffic & Safety",
  "sla_hours": number,
  "is_emergency": boolean
}

CRITICAL RULES:
- If the report describes a flood, flash flood, submerged streets, severe water logging, rising waters, or deluge: Urgency MUST be "CRITICAL", Department MUST be "Emergency Response", category MUST be "Disaster / Flood", sla_hours MUST be 0.5, and is_emergency MUST be true.
- Fire, transformer sparks, building collapse, gas leak, toxic chemical spills, and severe road accidents are also CRITICAL (<30m SLA).

Citizen Report: "${description}"`;

      const response = await anthropicClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      });

      const rawText = response.content[0].text;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn('Claude API triage failed, falling back to local engine:', err.message);
    }
  }

  // Resilient Heuristic Triage Engine
  const text = description.toLowerCase();
  
  // Critical emergencies: Floods & Inundation
  if (text.match(/flood|flooding|flash flood|water logg|inundat|submerg|deluge|drown/)) {
    return {
      category: 'Disaster / Flood',
      urgency: 'CRITICAL',
      department: 'Emergency Response',
      sla_hours: 0.5,
      is_emergency: true
    };
  }

  // Critical emergencies: Fire, electrical sparks, structural collapse
  if (text.match(/fire|spark|explosion|smoke|burning|shock|flame|collapsed/)) {
    return {
      category: 'Medical/Fire',
      urgency: 'CRITICAL',
      department: 'Emergency Response',
      sla_hours: 0.5,
      is_emergency: true
    };
  }
  if (text.match(/gas leak|toxic|cylinder|poison|suffocating/)) {
    return {
      category: 'Public Safety',
      urgency: 'CRITICAL',
      department: 'Emergency Response',
      sla_hours: 0.5,
      is_emergency: true
    };
  }
  if (text.match(/accident|crash|casualty|blood|injury|ambulance/)) {
    return {
      category: 'Public Safety',
      urgency: 'CRITICAL',
      department: 'Emergency Response',
      sla_hours: 0.5,
      is_emergency: true
    };
  }
  // High urgency (Note: flood has been moved to CRITICAL above)
  if (text.match(/leak|burst|water supply|pipeline|drinking water|sewage overflow/)) {
    return {
      category: 'Water Supply',
      urgency: 'HIGH',
      department: 'Municipal Works',
      sla_hours: 2,
      is_emergency: false
    };
  }
  if (text.match(/blackout|power cut|wire|short circuit|transformer|pole/)) {
    return {
      category: 'Electricity',
      urgency: 'HIGH',
      department: 'Municipal Works',
      sla_hours: 2,
      is_emergency: false
    };
  }
  // Medium urgency
  if (text.match(/pothole|road|crater|traffic signal|jam|speed breaker|divider/)) {
    return {
      category: 'Roads',
      urgency: 'MEDIUM',
      department: 'Traffic & Safety',
      sla_hours: 8,
      is_emergency: false
    };
  }
  if (text.match(/garbage|trash|waste|dump|stench|sanitation|dead animal/)) {
    return {
      category: 'Sanitation',
      urgency: 'MEDIUM',
      department: 'Public Health',
      sla_hours: 12,
      is_emergency: false
    };
  }

  // Default standard incident
  return {
    category: 'Public Safety',
    urgency: 'MEDIUM',
    department: 'Municipal Works',
    sla_hours: 6,
    is_emergency: false
  };
}

// -----------------------------------------------------------------------------
// Dispatch SMS Alert Handler
// -----------------------------------------------------------------------------
async function dispatchEmergencyNotification(ticket) {
  const alertBody = `[EMERGENCY DISPATCH - RAPID RESOLVE] Ticket #${ticket.id} (${ticket.category} -> ${ticket.department}): "${ticket.description}" at ${ticket.location_name}. Respond immediately. SLA: 30m.`;
  
  ticket.sms_dispatched = true;
  ticket.sms_body = alertBody;

  if (twilioClient && process.env.TWILIO_PHONE_NUMBER && process.env.RESPONDER_PHONE_NUMBER) {
    try {
      const message = await twilioClient.messages.create({
        body: alertBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.RESPONDER_PHONE_NUMBER
      });
      ticket.sms_channel = 'Twilio Live SMS';
      ticket.sms_sid = message.sid;
      ticket.sms_recipient = process.env.RESPONDER_PHONE_NUMBER;
      console.log(`[SMS DISPATCH - LIVE TWILIO] Emergency SMS sent for Ticket #${ticket.id} to ${process.env.RESPONDER_PHONE_NUMBER}`);
      return;
    } catch (err) {
      console.warn('Twilio SMS delivery failed:', err.message);
      ticket.sms_channel = 'Simulation (Twilio Error: ' + err.message + ')';
    }
  } else {
    ticket.sms_channel = 'Console Simulation';
    ticket.sms_recipient = process.env.RESPONDER_PHONE_NUMBER || 'Configured via .env';
  }

  // Simulated emergency dispatch log
  console.log('🚨 [SIMULATED EMERGENCY DISPATCH] 🚨');
  console.log(`To: ${ticket.sms_recipient}`);
  console.log(`Message: ${alertBody}`);
}

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// Health & Diagnostic Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: isPgConnected ? 'PostgreSQL' : 'In-Memory Resilient Store',
    aiEngine: geminiApiKey ? 'Google Gemini 3.6 Flash (Live API)' : (anthropicClient ? 'Claude 3 Haiku' : 'Local Heuristic Rule Engine'),
    smsDispatch: twilioClient ? 'Twilio Live' : 'Console Simulation',
    ticketCount: isPgConnected ? null : inMemoryTickets.length
  });
});

// Admin Login Endpoint
app.post('/api/admin/login', (req, res) => {
  const { adminId, password } = req.body;
  if (!adminId || !password) {
    return res.status(400).json({ success: false, error: 'Admin ID and password are required' });
  }

  const credentials = getAdminCredentials();

  if (
    adminId.trim() === credentials.adminId.trim() &&
    password.trim() === credentials.password.trim()
  ) {
    const sessionToken = Buffer.from(`${credentials.adminId}:${Date.now()}:${Math.random()}`).toString('base64');
    return res.json({
      success: true,
      token: sessionToken,
      user: {
        adminId: credentials.adminId,
        role: credentials.role || 'Chief Incident Commander',
        department: credentials.department || 'Rapid Resolve Unified Command Center'
      }
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid Admin ID or Password. Please check admin_credentials.json.'
  });
});

// Admin Token Verification Endpoint
app.post('/api/admin/verify', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  const credentials = getAdminCredentials();
  return res.json({
    success: true,
    user: {
      adminId: credentials.adminId,
      role: credentials.role || 'Chief Incident Commander',
      department: credentials.department || 'Rapid Resolve Unified Command Center'
    }
  });
});

// GET: All Tickets
app.get('/api/tickets', async (req, res) => {
  try {
    if (isPgConnected && pgPool) {
      const tickets = await pgPool.query('SELECT * FROM tickets ORDER BY created_at DESC');
      return res.json(tickets.rows);
    }
    // Return in-memory tickets (sorted newest first)
    const sorted = [...inMemoryTickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(sorted);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Citizen submits issue (Chat / Voice entry)
app.post('/api/tickets', async (req, res) => {
  const { description, location_name, latitude, longitude } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    // 1. AI Classification & Urgency Scoring
    const triage = await triageIssueWithAI(description);

    // 2. SLA Timer Calculation
    const slaDeadline = new Date(Date.now() + triage.sla_hours * 60 * 60 * 1000);

    // 3. Resolve Geolocation: Use manual coordinates if provided, else safe civic zone fallback
    const resolvedLat = (latitude !== undefined && latitude !== null && !isNaN(Number(latitude)))
      ? Number(latitude)
      : (19.8762 + (Math.random() - 0.5) * 0.02);
    const resolvedLng = (longitude !== undefined && longitude !== null && !isNaN(Number(longitude)))
      ? Number(longitude)
      : (75.3433 + (Math.random() - 0.5) * 0.02);

    let ticket = null;

    if (isPgConnected && pgPool) {
      const result = await pgPool.query(
        `INSERT INTO tickets 
        (description, category, urgency, department, location_name, latitude, longitude, sla_deadline, is_emergency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          description,
          triage.category,
          triage.urgency,
          triage.department,
          location_name || 'Civic Zone Marker',
          resolvedLat,
          resolvedLng,
          slaDeadline,
          triage.is_emergency
        ]
      );
      ticket = result.rows[0];
    } else {
      // In-Memory store
      ticket = {
        id: nextTicketId++,
        description,
        category: triage.category,
        urgency: triage.urgency,
        department: triage.department,
        location_name: location_name || 'Civic Zone Marker',
        latitude: resolvedLat,
        longitude: resolvedLng,
        sla_deadline: slaDeadline.toISOString(),
        is_emergency: triage.is_emergency,
        status: 'OPEN',
        created_at: new Date().toISOString()
      };
      inMemoryTickets.unshift(ticket);
    }

    // 3. Emergency Bypass Path: Instant SMS Escalation
    if (ticket.urgency === 'CRITICAL' || ticket.is_emergency) {
      await dispatchEmergencyNotification(ticket);
    }

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error('Triage Error:', error);
    res.status(500).json({ error: 'Failed to triage and route ticket' });
  }
});

// PATCH: Human-in-the-loop override queue (Deletes problem if status is RESOLVED)
app.patch('/api/tickets/:id/override', async (req, res) => {
  const { id } = req.params;
  const { urgency, department, status } = req.body;

  try {
    // If problem is marked RESOLVED, delete it from storage
    if (status === 'RESOLVED') {
      if (isPgConnected && pgPool) {
        const delRes = await pgPool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
        if (delRes.rows.length === 0) {
          return res.status(404).json({ error: 'Ticket not found' });
        }
        return res.json({ success: true, deleted: true, id: Number(id), message: 'Ticket resolved and deleted' });
      }

      const targetIdx = inMemoryTickets.findIndex((t) => t.id === Number(id));
      if (targetIdx === -1) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      const deletedTicket = inMemoryTickets.splice(targetIdx, 1)[0];
      return res.json({ success: true, deleted: true, id: Number(id), message: 'Ticket resolved and deleted', ticket: deletedTicket });
    }

    if (isPgConnected && pgPool) {
      const updated = await pgPool.query(
        `UPDATE tickets 
         SET urgency = COALESCE($1, urgency),
             department = COALESCE($2, department),
             status = COALESCE($3, status)
         WHERE id = $4 RETURNING *`,
        [urgency, department, status, id]
      );
      if (updated.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      return res.json(updated.rows[0]);
    }

    // In-Memory update
    const target = inMemoryTickets.find((t) => t.id === Number(id));
    if (!target) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (urgency) target.urgency = urgency;
    if (department) target.department = department;
    if (status) target.status = status;

    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Delete a problem/ticket
app.delete('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isPgConnected && pgPool) {
      const result = await pgPool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      return res.json({ success: true, deleted: true, id: Number(id) });
    }

    const targetIdx = inMemoryTickets.findIndex((t) => t.id === Number(id));
    if (targetIdx === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const removedTicket = inMemoryTickets.splice(targetIdx, 1)[0];
    res.json({ success: true, deleted: true, id: Number(id), ticket: removedTicket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Static Asset Serving (Production & Unified Delivery)
// -----------------------------------------------------------------------------
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // If frontend has not been compiled yet
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Rapid Resolve Server</title></head>
        <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
          <h1 style="color: #38bdf8;">Rapid Resolve Unified Server</h1>
          <p>The backend API is live! Frontend build not found at <code>${distPath}</code>.</p>
          <p>Run <code>npm run build</code> to compile the client, or run <code>npm run dev</code> for hot-reload development.</p>
          <p><a href="/api/health" style="color: #60a5fa;">Check API Health Status</a> | <a href="/api/tickets" style="color: #60a5fa;">View Tickets API</a></p>
        </body>
      </html>
    `);
  });
}

// -----------------------------------------------------------------------------
// Server Start
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Rapid Resolve Unified Server running on http://${HOST}:${PORT}`);
    console.log(`📡 Healthcheck: http://${HOST}:${PORT}/api/health`);
    console.log(`📋 Tickets API: http://${HOST}:${PORT}/api/tickets`);
    console.log(`======================================================\n`);
  });
}

export default app;
