const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Groq = require('groq-sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase client - check if we have Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Use Supabase if credentials are available, otherwise use in-memory storage
let useSupabase = !!(supabaseUrl && supabaseServiceKey);
let supabase = null;
let tablesExist = false;

// In-memory fallback storage
const memoryStore = {
  users: new Map(),
  sessions: new Map(),
  emails: new Map(),
  templates: new Map(),
  aiResponses: new Map()
};

if (useSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  console.log('Initializing Supabase connection...');
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.log('⚠️  No Supabase credentials found - using in-memory storage');
  console.log('⚠️  Data will be lost on restart!');
}

// Initialize Groq client for AI responses
let groqClient = null;
if (process.env.GROQ_API_KEY) {
  console.log('Initializing Groq AI client...');
  groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY
  });
  console.log('✅ Groq AI client initialized');
} else {
  console.log('⚠️  No Groq API key found - AI responses will be mocked');
}

// Create tables if they don't exist
async function initializeDatabase() {
  if (!useSupabase) {
    console.log('📝 Using in-memory storage (no database configured)');
    return;
  }
  
  try {
    // Test connection by trying to query users table
    const { error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    const { error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .limit(1);
    
    if ((usersError && usersError.code === '42P01') || (sessionsError && sessionsError.code === '42P01')) {
      console.log('⚠️  Database tables do not exist!');
      console.log('⚠️  Please run the following SQL in your Supabase dashboard:');
      console.log('⚠️  https://supabase.com/dashboard/project/ftkricctldivgsdenegs/sql/new');
      console.log('⚠️  Copy and paste the contents of api-simple/supabase-schema.sql');
      console.log('⚠️  FALLING BACK TO IN-MEMORY STORAGE UNTIL TABLES ARE CREATED');
      useSupabase = false;
      tablesExist = false;
    } else if (!usersError && !sessionsError) {
      console.log('✅ Connected to Supabase - all tables exist');
      tablesExist = true;
    } else {
      console.log('⚠️  Database connection issues:', { usersError, sessionsError });
      console.log('⚠️  FALLING BACK TO IN-MEMORY STORAGE');
      useSupabase = false;
      tablesExist = false;
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    console.log('⚠️  FALLING BACK TO IN-MEMORY STORAGE');
    useSupabase = false;
    tablesExist = false;
  }
}

initializeDatabase();

// Helper functions
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createUser(email, password, name) {
  const userId = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  
  const user = {
    id: userId,
    email,
    password: hashedPassword,
    name: name || email.split('@')[0],
    settings: {
      notifications: true,
      aiModel: 'groq',
      responseStyle: 'professional',
      emailAccounts: []
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (useSupabase && tablesExist) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([user])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating user in database:', error);
        console.log('Falling back to in-memory storage');
        memoryStore.users.set(email, user);
        return user;
      }
      
      console.log(`✅ User ${email} created in database`);
      return data;
    } catch (error) {
      console.error('Database error, using in-memory storage:', error);
      memoryStore.users.set(email, user);
      return user;
    }
  } else {
    // Use in-memory storage
    memoryStore.users.set(email, user);
    console.log(`📝 User ${email} created in memory (database not available)`);
    return user;
  }
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  try {
    if (useSupabase && tablesExist) {
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*, users(*)')
        .eq('access_token', token)
        .single();
      
      if (error || !session) {
        // Try in-memory fallback
        const memSession = Array.from(memoryStore.sessions.values())
          .find(s => s.access_token === token);
        
        if (!memSession) {
          return res.status(401).json({ message: 'Invalid or expired token' });
        }
        
        const user = Array.from(memoryStore.users.values())
          .find(u => u.id === memSession.user_id);
        
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }
        
        req.user = user;
        next();
        return;
      }
      
      req.user = session.users;
      next();
    } else {
      // Use in-memory storage
      const session = Array.from(memoryStore.sessions.values())
        .find(s => s.access_token === token);
      
      if (!session) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      const user = Array.from(memoryStore.users.values())
        .find(u => u.id === session.user_id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      req.user = user;
      next();
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vivier-api',
    version: '1.0.0',
    storage: useSupabase && tablesExist ? 'database' : 'in-memory',
    databaseConfigured: !!supabase,
    tablesExist: tablesExist,
    memoryUsers: memoryStore.users.size,
    memorySessions: memoryStore.sessions.size
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Vivier Email AI Assistant API',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      auth: '/api/auth'
    }
  });
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Check if user exists
    if (useSupabase && tablesExist) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }
    } else {
      // Check in memory
      if (memoryStore.users.has(email)) {
        return res.status(409).json({ message: 'User already exists' });
      }
    }
    
    const user = await createUser(email, password, name);
    const accessToken = generateToken();
    const refreshToken = generateToken();
    
    const session = {
      id: crypto.randomBytes(16).toString('hex'),
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Store session
    if (useSupabase && tablesExist) {
      try {
        await supabase
          .from('sessions')
          .insert([session]);
        console.log(`✅ Session created in database for ${email}`);
      } catch (error) {
        console.error('Error storing session in database:', error);
        memoryStore.sessions.set(session.id, session);
        console.log(`📝 Session created in memory for ${email}`);
      }
    } else {
      memoryStore.sessions.set(session.id, session);
      console.log(`📝 Session created in memory for ${email}`);
    }
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        settings: user.settings,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    let user = null;
    
    if (useSupabase && tablesExist) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', hashedPassword)
        .single();
      
      if (!error && data) {
        user = data;
        console.log(`✅ User ${email} logged in from database`);
      } else {
        // Try in-memory fallback
        const memUser = memoryStore.users.get(email);
        if (memUser && memUser.password === hashedPassword) {
          user = memUser;
          console.log(`📝 User ${email} logged in from memory`);
        }
      }
    } else {
      // Use in-memory storage
      const memUser = memoryStore.users.get(email);
      if (memUser && memUser.password === hashedPassword) {
        user = memUser;
        console.log(`📝 User ${email} logged in from memory`);
      }
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const accessToken = generateToken();
    const refreshToken = generateToken();
    
    const session = {
      id: crypto.randomBytes(16).toString('hex'),
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Store session
    if (useSupabase && tablesExist) {
      try {
        await supabase
          .from('sessions')
          .insert([session]);
        console.log(`✅ Session created in database`);
      } catch (error) {
        console.error('Error storing session in database:', error);
        memoryStore.sessions.set(session.id, session);
        console.log(`📝 Session created in memory`);
      }
    } else {
      memoryStore.sessions.set(session.id, session);
      console.log(`📝 Session created in memory`);
    }
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        settings: user.settings,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    if (useSupabase && tablesExist) {
      await supabase
        .from('sessions')
        .delete()
        .eq('access_token', token);
    } else {
      // Remove from memory
      const sessionToDelete = Array.from(memoryStore.sessions.entries())
        .find(([id, s]) => s.access_token === token);
      
      if (sessionToDelete) {
        memoryStore.sessions.delete(sessionToDelete[0]);
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    settings: user.settings,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  });
});

app.patch('/api/auth/me', authenticateToken, async (req, res) => {
  const user = req.user;
  const updates = req.body;
  
  try {
    const updateData = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.settings) updateData.settings = { ...user.settings, ...updates.settings };
    updateData.updated_at = new Date().toISOString();
    
    let updatedUser = null;
    
    if (useSupabase && tablesExist) {
      try {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', user.id)
          .select()
          .single();
        
        if (!error && data) {
          updatedUser = data;
        }
      } catch (error) {
        console.error('Database update error:', error);
      }
    }
    
    if (!updatedUser) {
      // Update in memory
      const memUser = memoryStore.users.get(user.email);
      if (memUser) {
        Object.assign(memUser, updateData);
        updatedUser = memUser;
      }
    }
    
    if (!updatedUser) {
      throw new Error('User not found');
    }
    
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      settings: updatedUser.settings,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Update failed' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }
  
  try {
    let session = null;
    let user = null;
    
    if (useSupabase && tablesExist) {
      // Try database first
      const { data, error } = await supabase
        .from('sessions')
        .select('*, users(*)')
        .eq('refresh_token', refreshToken)
        .single();
      
      if (!error && data) {
        session = data;
        user = data.users;
      }
    }
    
    if (!session) {
      // Try in-memory
      const memSession = Array.from(memoryStore.sessions.values())
        .find(s => s.refresh_token === refreshToken);
      
      if (memSession) {
        session = memSession;
        user = Array.from(memoryStore.users.values())
          .find(u => u.id === memSession.user_id);
      }
    }
    
    if (!session || !user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    
    // Generate new tokens
    const newAccessToken = generateToken();
    const newRefreshToken = generateToken();
    
    // Update session with new tokens
    if (useSupabase && tablesExist) {
      try {
        await supabase
          .from('sessions')
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', session.id);
      } catch (error) {
        console.error('Error updating session in database:', error);
        // Update in memory
        session.access_token = newAccessToken;
        session.refresh_token = newRefreshToken;
        session.updated_at = new Date().toISOString();
        session.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    } else {
      // Update in memory
      session.access_token = newAccessToken;
      session.refresh_token = newRefreshToken;
      session.updated_at = new Date().toISOString();
      session.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

// Mock API endpoints
app.get('/api/v1/status', (req, res) => {
  res.json({
    database: 'connected',
    ai: 'ready',
    email: 'configured'
  });
});

// Email endpoints
app.get('/api/emails', authenticateToken, async (req, res) => {
  const { page = 1, limit = 10, filter, category, isRead, isPriority } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    let emails = [];
    let total = 0;
    
    if (useSupabase && tablesExist) {
      // Build query
      let query = supabase
        .from('emails')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id)
        .order('received_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);
      
      // Apply filters
      if (category) query = query.eq('category', category);
      if (isRead !== undefined) query = query.eq('is_read', isRead === 'true');
      if (isPriority !== undefined) query = query.eq('is_priority', isPriority === 'true');
      if (filter) query = query.ilike('subject', `%${filter}%`);
      
      const { data, count, error } = await query;
      
      if (!error && data) {
        emails = data;
        total = count || 0;
      } else {
        console.error('Error fetching emails from database:', error);
      }
    }
    
    // If database failed or doesn't exist, use memory store
    if (emails.length === 0) {
      const userEmails = Array.from(memoryStore.emails.values())
        .filter(e => e.user_id === req.user.id)
        .sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
      
      // Apply filters to memory store
      let filtered = userEmails;
      if (category) filtered = filtered.filter(e => e.category === category);
      if (isRead !== undefined) filtered = filtered.filter(e => e.is_read === (isRead === 'true'));
      if (isPriority !== undefined) filtered = filtered.filter(e => e.is_priority === (isPriority === 'true'));
      if (filter) filtered = filtered.filter(e => e.subject.toLowerCase().includes(filter.toLowerCase()));
      
      total = filtered.length;
      emails = filtered.slice(offset, offset + parseInt(limit));
      
      // If no emails exist, create some sample emails for demo
      if (emails.length === 0 && !filter && !category) {
        const sampleEmails = [
          {
            id: uuidv4(),
            user_id: req.user.id,
            from_email: 'client@example.com',
            to_email: req.user.email,
            subject: 'Welcome to Vivier!',
            body: 'Welcome to Vivier, your AI-powered email assistant. We\'re excited to help you manage your emails more efficiently.',
            is_read: false,
            is_priority: true,
            sentiment: 'positive',
            category: 'Welcome',
            received_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        
        // Store sample emails
        for (const email of sampleEmails) {
          memoryStore.emails.set(email.id, email);
        }
        
        emails = sampleEmails;
        total = sampleEmails.length;
      }
    }
    
    res.json({
      emails: emails.map(e => ({
        id: e.id,
        userId: e.user_id,
        from: e.from_email,
        to: e.to_email,
        subject: e.subject,
        body: e.body,
        isRead: e.is_read,
        isPriority: e.is_priority,
        sentiment: e.sentiment,
        category: e.category,
        receivedAt: e.received_at,
        createdAt: e.created_at,
        updatedAt: e.updated_at
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: offset + emails.length < total
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ message: 'Failed to fetch emails' });
  }
});

app.get('/api/emails/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    let email = null;
    
    if (useSupabase && tablesExist) {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();
      
      if (!error && data) {
        email = data;
      }
    }
    
    if (!email) {
      // Try memory store
      email = memoryStore.emails.get(id);
      if (!email || email.user_id !== req.user.id) {
        return res.status(404).json({ message: 'Email not found' });
      }
    }
    
    res.json({
      id: email.id,
      userId: email.user_id,
      from: email.from_email,
      to: email.to_email,
      subject: email.subject,
      body: email.body,
      isRead: email.is_read,
      isPriority: email.is_priority,
      sentiment: email.sentiment,
      category: email.category,
      receivedAt: email.received_at,
      createdAt: email.created_at,
      updatedAt: email.updated_at
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ message: 'Failed to fetch email' });
  }
});

app.post('/api/emails/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const updatedAt = new Date().toISOString();
    let success = false;
    
    if (useSupabase && tablesExist) {
      const { error } = await supabase
        .from('emails')
        .update({ is_read: true, updated_at: updatedAt })
        .eq('id', id)
        .eq('user_id', req.user.id);
      
      if (!error) {
        success = true;
      }
    }
    
    if (!success) {
      // Update in memory
      const email = memoryStore.emails.get(id);
      if (email && email.user_id === req.user.id) {
        email.is_read = true;
        email.updated_at = updatedAt;
        success = true;
      }
    }
    
    if (!success) {
      return res.status(404).json({ message: 'Email not found' });
    }
    
    res.json({ id, isRead: true });
  } catch (error) {
    console.error('Error marking email as read:', error);
    res.status(500).json({ message: 'Failed to update email' });
  }
});

app.post('/api/emails/:id/unread', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const updatedAt = new Date().toISOString();
    let success = false;
    
    if (useSupabase && tablesExist) {
      const { error } = await supabase
        .from('emails')
        .update({ is_read: false, updated_at: updatedAt })
        .eq('id', id)
        .eq('user_id', req.user.id);
      
      if (!error) {
        success = true;
      }
    }
    
    if (!success) {
      // Update in memory
      const email = memoryStore.emails.get(id);
      if (email && email.user_id === req.user.id) {
        email.is_read = false;
        email.updated_at = updatedAt;
        success = true;
      }
    }
    
    if (!success) {
      return res.status(404).json({ message: 'Email not found' });
    }
    
    res.json({ id, isRead: false });
  } catch (error) {
    console.error('Error marking email as unread:', error);
    res.status(500).json({ message: 'Failed to update email' });
  }
});

// Create new email
app.post('/api/emails', authenticateToken, async (req, res) => {
  const { from, to, subject, body, category, isPriority } = req.body;
  
  if (!from || !subject || !body) {
    return res.status(400).json({ message: 'From, subject, and body are required' });
  }
  
  try {
    const email = {
      id: uuidv4(),
      user_id: req.user.id,
      from_email: from,
      to_email: to || req.user.email,
      subject,
      body,
      is_read: false,
      is_priority: isPriority || false,
      sentiment: 'neutral',
      category: category || 'Inbox',
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (useSupabase && tablesExist) {
      try {
        const { data, error } = await supabase
          .from('emails')
          .insert([email])
          .select()
          .single();
        
        if (!error && data) {
          email.id = data.id;
        }
      } catch (error) {
        console.error('Error creating email in database:', error);
      }
    }
    
    // Always store in memory as backup
    memoryStore.emails.set(email.id, email);
    
    res.json({
      id: email.id,
      userId: email.user_id,
      from: email.from_email,
      to: email.to_email,
      subject: email.subject,
      body: email.body,
      isRead: email.is_read,
      isPriority: email.is_priority,
      sentiment: email.sentiment,
      category: email.category,
      receivedAt: email.received_at,
      createdAt: email.created_at,
      updatedAt: email.updated_at
    });
  } catch (error) {
    console.error('Error creating email:', error);
    res.status(500).json({ message: 'Failed to create email' });
  }
});

// AI endpoints
app.post('/api/ai/generate', authenticateToken, async (req, res) => {
  const { emailId, style = 'professional', prompt, emailContent } = req.body;
  
  try {
    let email = null;
    let responseText = '';
    
    // Fetch email if emailId provided
    if (emailId) {
      if (useSupabase && tablesExist) {
        const { data } = await supabase
          .from('emails')
          .select('*')
          .eq('id', emailId)
          .eq('user_id', req.user.id)
          .single();
        
        if (data) email = data;
      }
      
      if (!email) {
        email = memoryStore.emails.get(emailId);
      }
    }
    
    // Use Groq if available
    if (groqClient) {
      const stylePrompts = {
        professional: 'Write a professional and formal email response.',
        casual: 'Write a casual and friendly email response.',
        brief: 'Write a very brief and concise email response (2-3 sentences max).'
      };
      
      const systemPrompt = `You are an AI email assistant. ${stylePrompts[style] || stylePrompts.professional} Be helpful and appropriate to the context.`;
      
      let userPrompt = prompt || '';
      if (email) {
        userPrompt = `Reply to this email:\nFrom: ${email.from_email}\nSubject: ${email.subject}\nBody: ${email.body}\n\nGenerate an appropriate response.`;
      } else if (emailContent) {
        userPrompt = `Reply to this email:\n${emailContent}\n\nGenerate an appropriate response.`;
      }
      
      if (!userPrompt) {
        userPrompt = 'Write a general email response thanking someone for their message and letting them know you will follow up soon.';
      }
      
      console.log('Generating AI response with Groq...');
      const completion = await groqClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
        max_tokens: 500
      });
      
      responseText = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
      console.log('✅ AI response generated successfully');
    } else {
      // Fallback to static responses if Groq not available
      const responses = {
        professional: 'Thank you for your message. I have received your email and will review it carefully. I will provide you with a detailed response as soon as possible. Please let me know if you have any urgent concerns in the meantime.',
        casual: 'Hey! Thanks for reaching out. I got your message and will get back to you soon. Let me know if there\\'s anything urgent!',
        brief: 'Message received. Will respond shortly. Thanks!'
      };
      
      responseText = responses[style] || responses.professional;
      console.log('⚠️  Using static response (Groq not available)');
    }
    
    // Store AI response
    const aiResponse = {
      id: uuidv4(),
      email_id: emailId,
      user_id: req.user.id,
      response: responseText,
      style,
      confidence: groqClient ? 0.95 : 0.5,
      created_at: new Date().toISOString()
    };
    
    if (useSupabase && tablesExist) {
      try {
        await supabase
          .from('ai_responses')
          .insert([aiResponse]);
      } catch (error) {
        console.error('Error storing AI response in database:', error);
        memoryStore.aiResponses.set(aiResponse.id, aiResponse);
      }
    } else {
      memoryStore.aiResponses.set(aiResponse.id, aiResponse);
    }
    
    res.json({
      id: aiResponse.id,
      emailId: aiResponse.email_id,
      response: aiResponse.response,
      style: aiResponse.style,
      confidence: aiResponse.confidence,
      createdAt: aiResponse.created_at
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
    res.status(500).json({ 
      message: 'Failed to generate AI response',
      error: error.message 
    });
  }
});

// Template endpoints
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    let templates = [];
    
    if (useSupabase && tablesExist) {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', req.user.id)
        .order('usage_count', { ascending: false });
      
      if (!error && data) {
        templates = data;
      }
    }
    
    if (templates.length === 0) {
      // Try memory store
      templates = Array.from(memoryStore.templates.values())
        .filter(t => t.user_id === req.user.id)
        .sort((a, b) => b.usage_count - a.usage_count);
      
      // Create default templates if none exist
      if (templates.length === 0) {
        const defaultTemplates = [
          {
            id: uuidv4(),
            user_id: req.user.id,
            name: 'Meeting Follow-up',
            content: 'Thank you for taking the time to meet with me today. As discussed, I will follow up with the action items we outlined and keep you updated on our progress.',
            category: 'Business',
            tags: ['meeting', 'follow-up'],
            usage_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: uuidv4(),
            user_id: req.user.id,
            name: 'Project Status Update',
            content: 'I wanted to provide you with a quick update on the project status. We have made significant progress and are on track to meet our upcoming milestones.',
            category: 'Projects',
            tags: ['status', 'update'],
            usage_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: uuidv4(),
            user_id: req.user.id,
            name: 'Thank You Note',
            content: 'Thank you for your time and consideration. I appreciate your help and look forward to working with you.',
            category: 'Personal',
            tags: ['thanks', 'appreciation'],
            usage_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        
        // Store default templates
        for (const template of defaultTemplates) {
          memoryStore.templates.set(template.id, template);
        }
        
        templates = defaultTemplates;
      }
    }
    
    res.json(templates.map(t => ({
      id: t.id,
      userId: t.user_id,
      name: t.name,
      content: t.content,
      category: t.category,
      tags: t.tags || [],
      usageCount: t.usage_count,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })));
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// Create new template
app.post('/api/templates', authenticateToken, async (req, res) => {
  const { name, content, category, tags } = req.body;
  
  if (!name || !content) {
    return res.status(400).json({ message: 'Name and content are required' });
  }
  
  try {
    const template = {
      id: uuidv4(),
      user_id: req.user.id,
      name,
      content,
      category: category || 'General',
      tags: tags || [],
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (useSupabase && tablesExist) {
      try {
        const { data, error } = await supabase
          .from('templates')
          .insert([template])
          .select()
          .single();
        
        if (!error && data) {
          template.id = data.id;
        }
      } catch (error) {
        console.error('Error creating template in database:', error);
      }
    }
    
    // Always store in memory as backup
    memoryStore.templates.set(template.id, template);
    
    res.json({
      id: template.id,
      userId: template.user_id,
      name: template.name,
      content: template.content,
      category: template.category,
      tags: template.tags,
      usageCount: template.usage_count,
      createdAt: template.created_at,
      updatedAt: template.updated_at
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: 'Failed to create template' });
  }
});

// Update template
app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, content, category, tags } = req.body;
  
  try {
    const updates = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updates.name = name;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;
    
    let updatedTemplate = null;
    
    if (useSupabase && tablesExist) {
      const { data, error } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select()
        .single();
      
      if (!error && data) {
        updatedTemplate = data;
      }
    }
    
    if (!updatedTemplate) {
      // Update in memory
      const template = memoryStore.templates.get(id);
      if (template && template.user_id === req.user.id) {
        Object.assign(template, updates);
        updatedTemplate = template;
      }
    }
    
    if (!updatedTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json({
      id: updatedTemplate.id,
      userId: updatedTemplate.user_id,
      name: updatedTemplate.name,
      content: updatedTemplate.content,
      category: updatedTemplate.category,
      tags: updatedTemplate.tags,
      usageCount: updatedTemplate.usage_count,
      createdAt: updatedTemplate.created_at,
      updatedAt: updatedTemplate.updated_at
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Failed to update template' });
  }
});

// Delete template
app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    let deleted = false;
    
    if (useSupabase && tablesExist) {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);
      
      if (!error) {
        deleted = true;
      }
    }
    
    // Also delete from memory
    const template = memoryStore.templates.get(id);
    if (template && template.user_id === req.user.id) {
      memoryStore.templates.delete(id);
      deleted = true;
    }
    
    if (!deleted) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// Settings endpoints
app.get('/api/settings', authenticateToken, (req, res) => {
  res.json(req.user.settings);
});

app.patch('/api/settings', authenticateToken, async (req, res) => {
  try {
    const updatedSettings = { ...req.user.settings, ...req.body };
    
    let result = null;
    
    if (useSupabase && tablesExist) {
      try {
        const { data, error } = await supabase
          .from('users')
          .update({
            settings: updatedSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', req.user.id)
          .select('settings')
          .single();
        
        if (!error && data) {
          result = data.settings;
        }
      } catch (error) {
        console.error('Database settings update error:', error);
      }
    }
    
    if (!result) {
      // Update in memory
      const memUser = memoryStore.users.get(req.user.email);
      if (memUser) {
        memUser.settings = updatedSettings;
        memUser.updated_at = new Date().toISOString();
        result = updatedSettings;
      }
    }
    
    if (!result) {
      throw new Error('Failed to update settings');
    }
    
    res.json(result);
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

// Analytics endpoints
app.get('/api/analytics', authenticateToken, (req, res) => {
  const { period = 'week' } = req.query;
  
  res.json({
    period,
    emailsProcessed: 247,
    averageResponseTime: 2.3,
    responsesSent: 189,
    templatesUsed: 45,
    sentiment: {
      positive: 95,
      neutral: 120,
      negative: 32
    },
    categories: {
      Work: 89,
      Personal: 45,
      Newsletter: 67,
      Support: 46
    },
    responseStyles: {
      professional: 120,
      casual: 45,
      brief: 24
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});