import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import Anthropic from '@anthropic-ai/sdk';
import twilio from 'twilio';
import axios from 'axios';

import {
  getDB,
  createUser, getUserByEmail, verifyUserPassword,
  getAdminByAdminId, verifyAdminPassword,
  getAllTickets, getTicketById, createTicket, updateTicket, deleteTicket,
  createFeedback, getFeedbackForTicket, getAverageFeedbackRating
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// Initialize SQLite Database
// -----------------------------------------------------------------------------
const db = getDB();
console.log('✅ SQLite Database connected and ready.');

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
  // High urgency
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
  const ticketCount = db.prepare('SELECT COUNT(*) as cnt FROM tickets').get();
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: 'SQLite (Real-Time Persistent)',
    aiEngine: geminiApiKey ? 'Google Gemini 3.6 Flash (Live API)' : (anthropicClient ? 'Claude 3 Haiku' : 'Local Heuristic Rule Engine'),
    smsDispatch: twilioClient ? 'Twilio Live' : 'Console Simulation',
    ticketCount: ticketCount.cnt,
    userCount: userCount.cnt
  });
});

// -----------------------------------------------------------------------------
// Citizen Auth Endpoints (Signup / Login / Verify)
// -----------------------------------------------------------------------------
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  try {
    const existing = getUserByEmail(email.trim());
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const user = createUser(name.trim(), email.trim(), password, phone?.trim());
    console.log(`✅ New citizen registered: ${user.name} (${user.email})`);
    return res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('Signup error:', err.message);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  try {
    const user = getUserByEmail(email.trim());
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!verifyUserPassword(user, password)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const sessionToken = Buffer.from(`citizen:${user.id}:${Date.now()}:${Math.random()}`).toString('base64');
    console.log(`✅ Citizen logged in: ${user.name} (${user.email})`);
    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  // Decode token to get user ID
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');
    if (parts[0] === 'citizen' && parts[1]) {
      const userId = parseInt(parts[1], 10);
      const stmt = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?');
      const user = stmt.get(userId);
      if (user) {
        return res.json({ success: true, user });
      }
    }
  } catch {}
  return res.status(401).json({ success: false, error: 'Invalid token' });
});

// -----------------------------------------------------------------------------
// Admin Authentication
// -----------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { adminId, password } = req.body;
  if (!adminId || !password) {
    return res.status(400).json({ success: false, error: 'Admin ID and password are required' });
  }

  try {
    const admin = getAdminByAdminId(adminId.trim());
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid Admin ID or Password.' });
    }

    if (!verifyAdminPassword(admin, password.trim())) {
      return res.status(401).json({ success: false, error: 'Invalid Admin ID or Password.' });
    }

    const sessionToken = Buffer.from(`admin:${admin.id}:${Date.now()}:${Math.random()}`).toString('base64');
    console.log(`✅ Admin logged in: ${admin.admin_id} (${admin.role})`);
    return res.json({
      success: true,
      token: sessionToken,
      user: {
        adminId: admin.admin_id,
        role: admin.role,
        department: admin.department
      }
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    return res.status(500).json({ success: false, error: 'Authentication failed.' });
  }
});

// Admin Token Verification Endpoint
app.post('/api/admin/verify', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');
    if (parts[0] === 'admin' && parts[1]) {
      const adminDbId = parseInt(parts[1], 10);
      const admin = db.prepare('SELECT admin_id, role, department FROM admins WHERE id = ?').get(adminDbId);
      if (admin) {
        return res.json({
          success: true,
          user: {
            adminId: admin.admin_id,
            role: admin.role,
            department: admin.department
          }
        });
      }
    }
  } catch {}
  return res.status(401).json({ success: false, error: 'Invalid admin token' });
});

// -----------------------------------------------------------------------------
// Real-Time Events (Server-Sent Events)
// -----------------------------------------------------------------------------
const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  sseClients.add(res);

  // Initial connection handshake
  const allTickets = getAllTickets();
  res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
  res.write(`event: initial\ndata: ${JSON.stringify(allTickets)}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

function broadcastEvent(eventType, payload) {
  const normalized = (payload && payload.id && !payload.ticket)
    ? { ticket: payload, ...payload }
    : payload;
  const message = `event: ${eventType}\ndata: ${JSON.stringify(normalized)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// GET: All Tickets
app.get('/api/tickets', (req, res) => {
  try {
    const tickets = getAllTickets();
    res.json(tickets);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Single Ticket by ID (Citizen Complaint Tracking)
app.get('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  const cleanId = String(id).replace(/^#/, '').trim();
  const numericId = parseInt(cleanId, 10);

  if (isNaN(numericId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Ticket ID format. Please enter a valid numeric ticket ID (e.g. 4821).'
    });
  }

  try {
    const found = getTicketById(numericId);
    if (!found) {
      return res.status(404).json({
        success: false,
        error: `Complaint #${numericId} was not found in municipal records. Please verify your reference number.`
      });
    }
    return res.json({ success: true, ticket: found });
  } catch (err) {
    console.error(`Error fetching ticket #${id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: Citizen submits issue (Chat / Voice entry)
app.post('/api/tickets', async (req, res) => {
  const { description, location_name, latitude, longitude, user_id } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    // 1. AI Classification & Urgency Scoring
    const triage = await triageIssueWithAI(description);

    // 2. SLA Timer Calculation
    const slaDeadline = new Date(Date.now() + triage.sla_hours * 60 * 60 * 1000);

    // 3. Resolve Geolocation
    const resolvedLat = (latitude !== undefined && latitude !== null && !isNaN(Number(latitude)))
      ? Number(latitude)
      : (19.8762 + (Math.random() - 0.5) * 0.02);
    const resolvedLng = (longitude !== undefined && longitude !== null && !isNaN(Number(longitude)))
      ? Number(longitude)
      : (75.3433 + (Math.random() - 0.5) * 0.02);

    const ticket = createTicket({
      user_id: user_id || null,
      description,
      category: triage.category,
      urgency: triage.urgency,
      department: triage.department,
      location_name: location_name || 'Civic Zone Marker',
      latitude: resolvedLat,
      longitude: resolvedLng,
      sla_deadline: slaDeadline.toISOString(),
      is_emergency: triage.is_emergency,
      status: triage.is_emergency ? 'DISPATCHED' : 'OPEN',
      created_at: new Date().toISOString()
    });

    // 3. Emergency Bypass Path: Instant SMS Escalation
    if (ticket.urgency === 'CRITICAL' || ticket.is_emergency) {
      await dispatchEmergencyNotification(ticket);
    }

    // Broadcast real-time event to all connected citizens & commanders
    broadcastEvent('ticket_created', ticket);

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error('Triage Error:', error);
    res.status(500).json({ error: 'Failed to triage and route ticket' });
  }
});

// PATCH: Human-in-the-loop override queue
app.patch('/api/tickets/:id/override', (req, res) => {
  const { id } = req.params;
  const cleanId = String(id).replace(/^#/, '').trim();
  const numericId = parseInt(cleanId, 10);
  const { urgency, department, status, resolution_notes } = req.body;

  try {
    const updated = updateTicket(numericId, { urgency, department, status, resolution_notes });
    if (!updated) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    broadcastEvent('ticket_updated', updated);
    return res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Delete a problem/ticket
app.delete('/api/tickets/:id', (req, res) => {
  const { id } = req.params;
  try {
    const removed = deleteTicket(Number(id));
    if (!removed) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    broadcastEvent('ticket_deleted', { id: Number(id) });
    res.json({ success: true, deleted: true, id: Number(id), ticket: removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Feedback Endpoints
// -----------------------------------------------------------------------------
app.post('/api/tickets/:id/feedback', (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  const { rating, comment, user_id } = req.body;

  if (isNaN(ticketId)) {
    return res.status(400).json({ success: false, error: 'Invalid ticket ID.' });
  }
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5.' });
  }

  try {
    const ticket = getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    const feedback = createFeedback(ticketId, user_id || null, rating, comment);
    console.log(`✅ Feedback added for Ticket #${ticketId}: ${rating} stars`);
    return res.status(201).json({ success: true, feedback });
  } catch (err) {
    console.error('Feedback error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to submit feedback.' });
  }
});

app.get('/api/tickets/:id/feedback', (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) {
    return res.status(400).json({ success: false, error: 'Invalid ticket ID.' });
  }

  try {
    const feedback = getFeedbackForTicket(ticketId);
    const { avgRating, total } = getAverageFeedbackRating(ticketId);
    return res.json({ success: true, feedback, avgRating, total });
  } catch (err) {
    console.error('Feedback fetch error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve feedback.' });
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
    console.log(`🗄️  Database: SQLite (rapidresolve.db)`);
    console.log(`======================================================\n`);
  });
}

export default app;
