import { Router } from './utils/customRouter';
import { getDb } from './utils/db'; // Import getDb
import bcrypt from 'bcryptjs'; // For password hashing
import { SignJWT, jwtVerify } from 'jose'; // For JWT

// Embed the schema directly as a string
// DB_SCHEMA is now broken down and executed step-by-step in /api/init-db
const DB_SCHEMA_PLACEHOLDER = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS labs (
  lab_id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_name TEXT NOT NULL UNIQUE,
  location TEXT,
  capacity INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculty (
  faculty_id INTEGER PRIMARY KEY AUTOINCREMENT,
  faculty_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT,
  location TEXT, -- Added location column
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
  device_id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  configuration TEXT,
  status TEXT DEFAULT 'active',
  lab_id INTEGER,
  faculty_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lab_id) REFERENCES labs (lab_id) ON DELETE SET NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculty (faculty_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT, -- Hashed password for email/password login
  google_id TEXT UNIQUE, -- Google ID for Google Auth
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const allowedOrigins = [
    'https://cseinventory.cse-tech.workers.dev',
    'http://sgideadstock.sginstitute.in',
    'https://sgideadstock.sginstitute.in',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:56402',
    'http://localhost:51350',
];

// Helper to handle CORS headers consistently
const getCorsHeaders = (request) => {
    const origin = request.headers.get('Origin');
    let allowedOrigin = allowedOrigins[0]; // Default to first whitelisted origin

    if (origin) {
        const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
        const isProduction = origin.endsWith('cse-tech.workers.dev') || origin.includes('sginstitute.in');
        const isWhitelisted = allowedOrigins.includes(origin);
        
        if (isLocal || isProduction || isWhitelisted) {
            allowedOrigin = origin;
        }
    }

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
};

const router = new Router();

// CORS handling (placed first to act as middleware)
router.all('*', (request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: getCorsHeaders(request),
        });
    }
    return undefined;
});

// ... (keep the rest of the router definitions)

// Add CORS headers to all responses
const addCorsHeaders = (response, request) => {
    const corsHeaders = getCorsHeaders(request);
    const newHeaders = new Headers(response.headers);
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
};


router.get('/', () => {
    return new Response('Hello World from Inventory Backend!');
});

// Health check for /api — confirms the worker is live
router.get('/api', () => {
    return new Response(JSON.stringify({
        status: 'ok',
        message: 'Inventory Backend API is running on Cloudflare Workers',
        endpoints: ['/api/labs', '/api/faculty', '/api/devices', '/api/invoices', '/api/dashboard'],
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

router.get('/api/init-db', async (request, env) => {
    try {
        const statements = [
            env.DB.prepare('PRAGMA foreign_keys = ON;'),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS labs (
                  lab_id INTEGER PRIMARY KEY AUTOINCREMENT,
                  lab_name TEXT NOT NULL UNIQUE,
                  location TEXT,
                  capacity INTEGER,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS faculty (
                  faculty_id INTEGER PRIMARY KEY AUTOINCREMENT,
                  faculty_name TEXT NOT NULL,
                  email TEXT NOT NULL UNIQUE,
                  department TEXT,
                  location TEXT,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS devices (
                    device_id   INTEGER      PRIMARY KEY AUTOINCREMENT,
                    lab_id      INTEGER,
                    faculty_id  INTEGER,
                    device_name TEXT         NOT NULL,
                    company     TEXT,
                    lab_location TEXT,
                    device_type TEXT         NOT NULL,
                    status      TEXT         NOT NULL,
                    ram         INTEGER,
                    storage     INTEGER,
                    cpu         TEXT,
                    ip_generation TEXT,
                    last_maintenance_date TEXT,
                    ink_levels  INTEGER,
                    display_size REAL,
                    invoice_number TEXT,
                    invoice_pdf TEXT,
                    remark      TEXT,
                    created_at  TEXT         DEFAULT CURRENT_TIMESTAMP,
                    updated_at  TEXT         DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (lab_id) REFERENCES labs(lab_id) ON DELETE SET NULL,
                    FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL
                );
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS users (
                  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                  email TEXT NOT NULL UNIQUE,
                  password TEXT,
                  google_id TEXT UNIQUE,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS invoices (
                  invoice_number TEXT PRIMARY KEY,
                  invoice_pdf TEXT,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS maintenance_logs (
                  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                  device_id INTEGER NOT NULL,
                  assistant_name TEXT NOT NULL,
                  changes_made TEXT NOT NULL,
                  maintenance_date TEXT DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
                );
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS issues (
                  issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
                  device_id INTEGER,
                  lab_id INTEGER,
                  student_class TEXT,
                  student_div TEXT,
                  student_roll_no TEXT,
                  description TEXT NOT NULL,
                  status TEXT DEFAULT 'pending',
                  reported_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  resolved_at TEXT,
                  action_taken TEXT,
                  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
                  FOREIGN KEY (lab_id) REFERENCES labs(lab_id) ON DELETE CASCADE
                );
            `)
        ];
        await env.DB.batch(statements);

        // Attempt to add assistant_name to labs table, ignore error if it already exists
        try {
            await env.DB.prepare("ALTER TABLE labs ADD COLUMN assistant_name TEXT").run();
        } catch (e) {
            // Ignore column exists error
        }

        // Attempt to add action_taken to issues table, ignore error if it already exists
        try {
            await env.DB.prepare("ALTER TABLE issues ADD COLUMN action_taken TEXT").run();
        } catch (e) {
            // Ignore column exists error
        }

        return new Response('Database schema initialized successfully!', { status: 200 });
    } catch (error) {
        return new Response(`Error initializing database: ${error.message}`, { status: 500 });
    }
});

// Authentication Routes
router.post('/api/auth/register', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return new Response('Email and password are required', { status: 400 });
        }

        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
            return new Response('User with this email already exists', { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10); // Hash password with salt rounds
        const { success, user_id } = await db.createUser(email, hashedPassword); // Get user_id directly

        if (success) {
            const token = await generateToken(user_id, env); // Use the returned user_id
            return new Response(JSON.stringify({ message: 'User registered successfully', token }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to register user', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error registering user: ${error.message}`, { status: 500 });
    }
});

router.post('/api/auth/login', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return new Response('Email and password are required', { status: 400 });
        }

        const user = await db.findUserByEmail(email);
        if (!user || !user.password) { // Check if user exists and has a password (not Google Auth only)
            return new Response('Invalid credentials', { status: 401 });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return new Response('Invalid credentials', { status: 401 });
        }

        const token = await generateToken(user.user_id, env);
        return new Response(JSON.stringify({ token }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error logging in: ${error.message}`, { status: 500 });
    }

});

// Google OAuth
router.get('/api/auth/google', async (request, env) => {
    const redirectUri = `${request.url.origin}/api/auth/google/callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`;
    return Response.redirect(authUrl, 302);
});

router.get('/api/auth/google/callback', async (request, env) => {
    const db = getDb(env.DB);
    const code = request.url.searchParams.get('code');
    if (!code) {
        return new Response('Google OAuth failed: No code received', { status: 400 });
    }

    try {
        const redirectUri = `${request.url.origin}/api/auth/google/callback`;
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return new Response(`Google OAuth token error: ${tokenData.error_description || tokenData.error}`, { status: 400 });
        }

        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
            },
        });
        const userInfo = await userInfoResponse.json();

        if (userInfo.error) {
            return new Response(`Google User Info error: ${userInfo.error_description || userInfo.error}`, { status: 400 });
        }

        let user = await db.findUserByGoogleId(userInfo.sub);
        if (!user) {
            // Check if user exists with email, if so, link Google ID
            user = await db.findUserByEmail(userInfo.email);
            if (user) {
                await db.updateGoogleId(user.user_id, userInfo.sub);
            } else {
                // Create new user with Google ID
                const { success, meta } = await env.DB.prepare(
                    'INSERT INTO users (email, google_id) VALUES (?, ?)'
                )
                    .bind(userInfo.email, userInfo.sub)
                    .run();
                if (success) {
                    user = await db.findUserById(meta.last_row_id);
                } else {
                    throw new Error('Failed to create user with Google Auth');
                }
            }
        }

        const jwtToken = await generateToken(user.user_id, env);
        // Redirect to frontend with token (e.g., /dashboard?token=...)
        return Response.redirect(`${request.url.origin}/dashboard?token=${jwtToken}`, 302);

    } catch (error) {
        return new Response(`Google OAuth error: ${error.message}`, { status: 500 });
    }
});


// Dashboard Statistics (protected)
router.get('/api/dashboard', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const stats = await db.getDashboardStats();
        return new Response(JSON.stringify(stats), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching dashboard stats: ${error.message}`, { status: 500 });
    }
});

router.get('/api/reports/system-status', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const reportData = await db.getSystemStatusReportData();
        return new Response(JSON.stringify(reportData), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching system status report: ${error.message}`, { status: 500 });
    }
});

router.get('/api/reports/defective-stock', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const reportData = await db.getDeadStockReportData();
        return new Response(JSON.stringify(reportData), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching defective stock report: ${error.message}`, { status: 500 });
    }
});

router.get('/api/reports/faculty-inventory', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const reportData = await db.getFacultyInventoryReportData();
        return new Response(JSON.stringify(reportData), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching faculty inventory report: ${error.message}`, { status: 500 });
    }
});

router.get('/api/reports/lab-wise', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const reportData = await db.getLabWiseReportData();
        return new Response(JSON.stringify(reportData), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching lab-wise report: ${error.message}`, { status: 500 });
    }
});

// Reports Endpoints
router.get('/api/reports/complete-inventory', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const reportData = await db.getCompleteInventoryReportData();
        return new Response(JSON.stringify(reportData), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching complete inventory report: ${error.message}`, { status: 500 });
    }
});

// Helper to get Central Store Lab ID
router.get('/api/central-store-lab-id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const hodCabinLabId = await db.getOrCreateHodCabinLabId();
        return new Response(JSON.stringify({ hodCabinLabId }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching/creating Central Store lab ID: ${error.message}`, { status: 500 });
    }
});

// Labs CRUD operations (protected)
router.get('/api/labs', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const labs = await db.getAllLabs();
        return new Response(JSON.stringify(labs), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching labs: ${error.message}`, { status: 500 });
    }
});

router.post('/api/labs', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { lab_name, location, capacity, assistant_name } = await request.json();
        if (!lab_name) {
            return new Response('Lab name is required', { status: 400 });
        }
        const success = await db.createLab(lab_name, location, capacity, assistant_name);
        if (success) {
            return new Response(JSON.stringify({ message: 'Lab created successfully' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to create lab', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error creating lab: ${error.message}`, { status: 500 });
    }
});

router.get('/api/labs/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const lab = await db.getLabById(id);
        if (lab) {
            return new Response(JSON.stringify(lab), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Lab not found', { status: 404 });
        }
    } catch (error) {
        return new Response(`Error fetching lab: ${error.message}`, { status: 500 });
    }
});

router.put('/api/labs/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { lab_name, location, capacity, assistant_name } = await request.json();
        if (!lab_name) {
            return new Response('Lab name is required', { status: 400 });
        }
        const success = await db.updateLab(id, lab_name, location, capacity, assistant_name);
        if (success) {
            return new Response(JSON.stringify({ message: 'Lab updated successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to update lab', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error updating lab: ${error.message}`, { status: 500 });
    }
});

router.delete('/api/labs/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const success = await db.deleteLab(id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Lab deleted successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to delete lab', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error deleting lab: ${error.message}`, { status: 500 });
    }
});

// Faculty CRUD operations (protected)
router.get('/api/faculty', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const faculty = await db.getAllFaculty();
        return new Response(JSON.stringify(faculty), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching faculty: ${error.message}`, { status: 500 });
    }
});

router.post('/api/faculty', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { faculty_name, email, department, location } = await request.json();
        if (!faculty_name || !email) {
            return new Response('Faculty name and email are required', { status: 400 });
        }

        // Backend email domain validation
        const allowedDomainsRegex = /^[\w.-]+@(sgipolytechnic\.in|sgiinstitute\.in)$/;
        if (!allowedDomainsRegex.test(email)) {
            return new Response('Invalid email domain. Only @sgipolytechnic.in or @sgiinstitute.in are allowed.', { status: 400 });
        }

        const success = await db.createFaculty(faculty_name, email, department, location);
        if (success) {
            return new Response(JSON.stringify({ message: 'Faculty created successfully' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to create faculty', { status: 500 });
        }
    } catch (error) {
        console.error('Detailed error in /api/faculty POST:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        // Check for specific D1 error messages, e.g., unique constraint violations
        if (error.message && error.message.includes('UNIQUE constraint failed: faculty.email')) {
            return new Response('Faculty member with this email already exists.', { status: 409 });
        }
        return new Response(`Error creating faculty: ${error.message}`, { status: 500 });
    }
});

router.get('/api/faculty/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const faculty = await db.getFacultyById(id);
        if (faculty) {
            return new Response(JSON.stringify(faculty), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Faculty not found', { status: 404 });
        }
    } catch (error) {
        return new Response(`Error fetching faculty: ${error.message}`, { status: 500 });
    }
});

router.put('/api/faculty/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { faculty_name, email, department, location } = await request.json();
        if (!faculty_name || !email) {
            return new Response('Faculty name and email are required', { status: 400 });
        }
        const success = await db.updateFaculty(id, faculty_name, email, department, location);
        if (success) {
            return new Response(JSON.stringify({ message: 'Faculty updated successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to update faculty', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error updating faculty: ${error.message}`, { status: 500 });
    }
});

router.delete('/api/faculty/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const success = await db.deleteFaculty(id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Faculty deleted successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to delete faculty', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error deleting faculty: ${error.message}`, { status: 500 });
    }
});

// Devices CRUD operations (protected)
router.get('/api/devices', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const url = new URL(request.url);
        const lab_id = url.searchParams.get('lab_id');
        const faculty_id = url.searchParams.get('faculty_id');
        const status = url.searchParams.get('status');
        const device_type = url.searchParams.getAll('device_type'); // Use getAll for potentially multiple device_type params

        // Pass filters to getAllDevices. If device_type is an empty array, pass null.
        const devices = await db.getAllDevices({
            lab_id,
            faculty_id,
            status,
            device_type: device_type.length > 0 ? device_type : null
        });
        return new Response(JSON.stringify(devices), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching devices: ${error.message}`, { status: 500 });
    }
});

// Helper function to generate a unique key for R2
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

router.post('/api/devices', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const formData = await request.formData();
        const deviceData = {};
        let invoicePdf = null;

        for (const [key, value] of formData.entries()) {
            if (key === 'invoice_pdf') {
                invoicePdf = value;
            } else {
                if (value === 'null' || value === 'undefined') {
                    deviceData[key] = null;
                } else {
                    deviceData[key] = value;
                }
            }
        }

        let invoicePdfBase64 = null;
        if (invoicePdf && invoicePdf.name) {
            // Server-side validation for PDF size
            if (invoicePdf.size > 500 * 1024) { // 500KB limit
                return new Response('Invoice PDF size cannot exceed 500KB.', { status: 400 });
            }

            const arrayBuffer = await invoicePdf.arrayBuffer();
            invoicePdfBase64 = arrayBufferToBase64(arrayBuffer);
        }

        deviceData.invoice_pdf = invoicePdfBase64;


        // Ensure numeric fields are correctly typed and handle empty strings or invalid numbers.
        const fieldsToParseAsInt = ['ram', 'storage', 'lab_id', 'faculty_id', 'ink_levels'];
        fieldsToParseAsInt.forEach(field => {
            const value = deviceData[field];
            if (value === '' || value === null || value === undefined) {
                deviceData[field] = null;
            } else {
                const parsed = parseInt(value, 10);
                deviceData[field] = isNaN(parsed) ? null : parsed;
            }
        });

        const fieldsToParseAsFloat = ['display_size'];
        fieldsToParseAsFloat.forEach(field => {
            const value = deviceData[field];
            if (value === '' || value === null || value === undefined) {
                deviceData[field] = null;
            } else {
                const parsed = parseFloat(value);
                deviceData[field] = isNaN(parsed) ? null : parsed;
            }
        });

        const success = await db.createDevice(deviceData);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device created successfully' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to create device', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error creating device: ${error.message}`, { status: 500 });
    }
});

router.post('/api/invoices', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const formData = await request.formData();
        const invoice_number = formData.get('invoice_number');
        const invoice_pdf = formData.get('invoice_pdf');
        const device_ids_json = formData.get('device_ids');
        const device_ids = device_ids_json ? JSON.parse(device_ids_json) : [];

        if (!invoice_number) {
            return new Response('Invoice number is required', { status: 400 });
        }

        let invoicePdfBase64 = null;
        if (invoice_pdf && invoice_pdf.size > 0) {
            if (invoice_pdf.size > 500 * 1024) { // 500KB limit
                return new Response('Invoice PDF size cannot exceed 500KB.', { status: 400 });
            }
            const arrayBuffer = await invoice_pdf.arrayBuffer();
            invoicePdfBase64 = arrayBufferToBase64(arrayBuffer);
        }

        const { success, count } = await db.addInvoiceToDevices(invoice_number, invoicePdfBase64, device_ids);

        if (success) {
            return new Response(JSON.stringify({ message: `Invoice processed for ${count} devices successfully` }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to process invoice', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error adding invoice: ${error.message}`, { status: 500 });
    }
});

router.get('/api/invoices', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const invoices = await db.getAllInvoices();
        return new Response(JSON.stringify(invoices), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error fetching invoices: ${error.message}`, { status: 500 });
    }
});

router.get('/api/invoices/:invoiceNumber', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { invoiceNumber } = request.params;
        const invoiceData = await db.getInvoiceByNumber(invoiceNumber);
        if (invoiceData) {
            return new Response(JSON.stringify(invoiceData), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Invoice not found', { status: 404 });
        }
    } catch (error) {
        return new Response(`Error fetching invoice details: ${error.message}`, { status: 500 });
    }
});

router.get('/api/invoices/:invoiceNumber/pdf', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { invoiceNumber } = request.params;
        const pdfBase64 = await db.getInvoicePdf(invoiceNumber);
        if (pdfBase64) {
            return new Response(JSON.stringify({ invoice_pdf: pdfBase64 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Invoice PDF not found', { status: 404 });
        }
    } catch (error) {
        return new Response(`Error fetching invoice PDF: ${error.message}`, { status: 500 });
    }
});

router.delete('/api/invoices/:invoiceNumber', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { invoiceNumber } = request.params;
        const success = await db.deleteInvoice(invoiceNumber);
        if (success) {
            return new Response(JSON.stringify({ message: 'Invoice deleted successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to delete invoice', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error deleting invoice: ${error.message}`, { status: 500 });
    }
});

router.put('/api/invoices/:invoiceNumber', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { invoiceNumber } = request.params;
        const formData = await request.formData();
        const new_invoice_number = formData.get('invoice_number');
        const invoice_pdf = formData.get('invoice_pdf');

        let invoicePdfBase64 = null;
        if (invoice_pdf && invoice_pdf.size > 0) {
            if (invoice_pdf.size > 500 * 1024) { // 500KB limit
                return new Response('Invoice PDF size cannot exceed 500KB.', { status: 400 });
            }
            const arrayBuffer = await invoice_pdf.arrayBuffer();
            invoicePdfBase64 = arrayBufferToBase64(arrayBuffer);
        }

        const success = await db.updateInvoice(invoiceNumber, new_invoice_number, invoicePdfBase64);

        if (success) {
            return new Response(JSON.stringify({ message: 'Invoice updated successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to update invoice', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error updating invoice: ${error.message}`, { status: 500 });
    }
});


router.get('/api/public/devices/:code', async (request, env) => {
    const db = getDb(env.DB);
    const { code } = request.params;

    // Decode logic
    const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const decodeDeviceId = (c) => {
        let str = c.startsWith('SGI-') ? c.substring(4) : c;
        let num = 0;
        for (let i = 0; i < str.length; i++) {
            const index = BASE62.indexOf(str[i]);
            if (index === -1) return null;
            num = num * 62 + index;
        }
        return num - 10000;
    };

    const deviceId = decodeDeviceId(code);
    if (deviceId === null || deviceId < 0) {
        return new Response('Invalid code format', { status: 400 });
    }

    try {
        const device = await db.getDeviceByIdPublic(deviceId);
        if (device) {
            return new Response(JSON.stringify(device), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Device not found', { status: 404 });
        }
    } catch (error) {
        return new Response(`Error fetching device: ${error.message}`, { status: 500 });
    }
});

// POST: Lab assistant logs a maintenance entry after scanning QR (no auth needed)
router.post('/api/public/devices/:code/maintenance', async (request, env) => {
    const db = getDb(env.DB);
    const { code } = request.params;

    const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const decodeDeviceId = (c) => {
        let str = c.startsWith('SGI-') ? c.substring(4) : c;
        let num = 0;
        for (let i = 0; i < str.length; i++) {
            const index = BASE62.indexOf(str[i]);
            if (index === -1) return null;
            num = num * 62 + index;
        }
        return num - 10000;
    };

    const deviceId = decodeDeviceId(code);
    if (deviceId === null || deviceId < 0) {
        return new Response(JSON.stringify({ error: 'Invalid device code' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const { assistant_name, changes_made } = await request.json();
        if (!assistant_name || !assistant_name.trim()) {
            return new Response(JSON.stringify({ error: 'Assistant name is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (!changes_made || !changes_made.trim()) {
            return new Response(JSON.stringify({ error: 'Changes description is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const success = await db.addMaintenanceLog(deviceId, assistant_name.trim(), changes_made.trim());
        if (success) {
            return new Response(JSON.stringify({ message: 'Maintenance log recorded successfully' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ error: 'Failed to record maintenance log' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});

// GET: Fetch maintenance history for a device by QR code (no auth needed)
router.get('/api/public/devices/:code/maintenance', async (request, env) => {
    const db = getDb(env.DB);
    const { code } = request.params;

    const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const decodeDeviceId = (c) => {
        let str = c.startsWith('SGI-') ? c.substring(4) : c;
        let num = 0;
        for (let i = 0; i < str.length; i++) {
            const index = BASE62.indexOf(str[i]);
            if (index === -1) return null;
            num = num * 62 + index;
        }
        return num - 10000;
    };

    const deviceId = decodeDeviceId(code);
    if (deviceId === null || deviceId < 0) {
        return new Response(JSON.stringify({ error: 'Invalid device code' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const logs = await db.getMaintenanceLogs(deviceId);
        return new Response(JSON.stringify(logs), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});

// GET: Fetch maintenance history by device_id (for admin view)
router.get('/api/devices/:id/maintenance', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const logs = await db.getMaintenanceLogs(id);
        return new Response(JSON.stringify(logs), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});

// DELETE: Delete a maintenance log (admin)
router.delete('/api/devices/:id/maintenance/:logId', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { logId } = request.params;
        const success = await db.deleteMaintenanceLog(logId);
        if (success) {
            return new Response(JSON.stringify({ message: 'Log deleted successfully' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ error: 'Failed to delete log' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});

router.get('/api/devices/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const device = await db.getDeviceById(id);
        if (device) {
            return new Response(JSON.stringify(device), {
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Device not found', { status: 404 });
        }
    } catch (error) {
        return new Response(`Error fetching device: ${error.message}`, { status: 500 });
    }
});

router.put('/api/devices/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const deviceData = await request.json();
        const success = await db.updateDevice(id, deviceData);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device updated successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to update device', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error updating device: ${error.message}`, { status: 500 });
    }
});

router.delete('/api/devices/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const success = await db.deleteDevice(id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device deleted successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to delete device', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error deleting device: ${error.message}`, { status: 500 });
    }
});

function base64ToArrayBuffer(base64) {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

router.get('/api/devices/:id/invoice', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const device = await db.getDeviceById(id);

        if (!device || !device.invoice_pdf) {
            return new Response('Invoice not found for this device', { status: 404 });
        }

        const arrayBuffer = base64ToArrayBuffer(device.invoice_pdf);

        return new Response(arrayBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
            },
        });
    } catch (error) {
        return new Response(`Error fetching invoice: ${error.message}`, { status: 500 });
    }
});

router.put('/api/devices/:id/reassign', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { faculty_id } = await request.json();
        if (!faculty_id) {
            return new Response('Faculty ID is required for reassignment', { status: 400 });
        }
        const success = await db.reassignDevice(id, faculty_id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device reassigned successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to reassign device', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error reassigning device: ${error.message}`, { status: 500 });
    }
});

router.put('/api/devices/:id/reassign-lab', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { lab_id } = await request.json();
        if (!lab_id) {
            return new Response('Lab ID is required for reassignment', { status: 400 });
        }
        const success = await db.reassignDeviceToLab(id, lab_id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device reassigned to lab successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to reassign device to lab', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error reassigning device to lab: ${error.message}`, { status: 500 });
    }
});

router.put('/api/devices/:id/deselect', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const success = await db.deselectDevice(id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device deselected successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to deselect device', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error deselecting device: ${error.message}`, { status: 500 });
    }
});

router.put('/api/devices/:id/deadstock', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { remark } = await request.json();
        if (!remark) {
            return new Response('Remark is required', { status: 400 });
        }
        const success = await db.markDeviceAsDeadStock(id, remark);
        if (success) {
            return new Response(JSON.stringify({ message: 'Device marked as dead stock successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to mark device as dead stock', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error marking device as dead stock: ${error.message}`, { status: 500 });
    }
});

router.put('/api/devices/:id/deadstock-parts', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { parts, remark } = await request.json();
        if (!parts || !Array.isArray(parts) || parts.length === 0) {
            return new Response('An array of parts is required.', { status: 400 });
        }
        if (!remark) {
            return new Response('Remark is required.', { status: 400 });
        }

        const success = await db.markPartsAsDeadStock(id, parts, remark);
        if (success) {
            return new Response(JSON.stringify({ message: 'Selected parts marked as dead stock successfully' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response('Failed to mark parts as dead stock', { status: 500 });
        }
    } catch (error) {
        return new Response(`Error marking parts as dead stock: ${error.message}`, { status: 500 });
    }
});


// ==========================================
// ISSUES & LAB ASSISTANT ROUTES
// ==========================================

// Student reports an issue
router.post('/api/public/devices/:code/issues', async (request, env) => {
    const db = getDb(env.DB);
    const { code } = request.params;

    const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const decodeDeviceId = (c) => {
        let str = c.startsWith('SGI-') ? c.substring(4) : c;
        let num = 0;
        for (let i = 0; i < str.length; i++) {
            const index = BASE62.indexOf(str[i]);
            if (index === -1) return null;
            num = num * 62 + index;
        }
        return num - 10000;
    };

    const deviceId = decodeDeviceId(code);
    if (deviceId === null || deviceId < 0) {
        return new Response(JSON.stringify({ error: 'Invalid device code' }), { status: 400 });
    }

    try {
        const { lab_id, student_class, student_div, student_roll_no, description } = await request.json();
        
        const success = await db.reportIssue(deviceId, lab_id, student_class, student_div, student_roll_no, description);
        if (success) {
            return new Response(JSON.stringify({ message: 'Issue reported successfully' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({ error: 'Failed to report issue' }), { status: 500 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Get Lab Assistant Issues (<= 48h)
router.get('/api/issues/lab-assistant', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const issues = await db.getLabAssistantIssues();
        return new Response(JSON.stringify(issues), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Get Escalated Issues (> 48h)
router.get('/api/issues/escalated', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const issues = await db.getEscalatedIssues();
        return new Response(JSON.stringify(issues), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Get All Pending Issues
router.get('/api/issues/pending', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const issues = await db.getPendingIssues();
        return new Response(JSON.stringify(issues), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Get All Resolved Issues
router.get('/api/issues/resolved', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const issues = await db.getResolvedIssues();
        return new Response(JSON.stringify(issues), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Resolve Issue
router.put('/api/issues/:id/resolve', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { action_taken } = await request.json().catch(() => ({}));
        
        // Get device_id and description of the issue to create a maintenance log
        const issue = await env.DB.prepare(`
            SELECT i.device_id, i.description, l.assistant_name 
            FROM issues i 
            LEFT JOIN labs l ON i.lab_id = l.lab_id 
            WHERE i.issue_id = ?
        `).bind(id).first();

        const success = await db.resolveIssue(id, action_taken);
        
        if (success) {
            if (issue && issue.device_id) {
                const assistantName = issue.assistant_name || 'Lab Assistant';
                const changesMade = `Resolved Issue: "${issue.description}". Action Taken: ${action_taken || 'N/A'}`;
                await db.addMaintenanceLog(issue.device_id, assistantName, changesMade);
            }
            return new Response(JSON.stringify({ message: 'Issue resolved' }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Failed to resolve issue' }), { status: 500 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Delete Issue (Admin Only)
router.delete('/api/issues/:id', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const success = await db.deleteIssue(id);
        if (success) {
            return new Response(JSON.stringify({ message: 'Issue deleted' }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Failed to delete issue' }), { status: 500 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

// Update Lab Assistant
router.put('/api/labs/:id/assistant', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const { id } = request.params;
        const { assistant_name } = await request.json();
        const success = await db.updateLabAssistant(id, assistant_name);
        if (success) {
            return new Response(JSON.stringify({ message: 'Lab assistant updated' }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Failed to update lab assistant' }), { status: 500 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});

router.get('/api/maintenance/capitalize-names', async (request, env) => {
    const db = getDb(env.DB);
    try {
        const result = await db.capitalizeExistingNames();
        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error during name capitalization: ${error.message}`, { status: 500 });
    }
});

router.get('/api/maintenance/migrate-defective-stock', async (request, env) => {
    try {
        const { success, meta } = await env.DB.prepare(
            "UPDATE devices SET status = 'defective_stock' WHERE status = 'dead_stock'"
        ).run();
        return new Response(JSON.stringify({
            message: 'Migration to defective_stock completed successfully',
            rowsUpdated: meta.changes
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(`Error during migration: ${error.message}`, { status: 500 });
    }
});

// Redirect route for old/wrong QR code URLs
router.get('/device/:code', (request) => {
    const { code } = request.params;
    // Redirect to the production frontend using a query param to avoid server-side 404
    return Response.redirect(`http://sgideadstock.sginstitute.in/?device=${code}`, 302);
});

// Final 404 handler (placed last)
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default {
    async fetch(request, env, ctx) {
        console.log('--- fetch handler start ---');
        const response = await router.handle(request, env, ctx);
        console.log('Response from router.handle:', response);
        if (response instanceof Response) {
            return addCorsHeaders(response, request);
        }
        // If router.handle somehow returns something that is not a Response object,
        // return a 500 Internal Server Error.
        return new Response('Internal Server Error: Router did not return a valid Response.', { status: 500 });
    },
};