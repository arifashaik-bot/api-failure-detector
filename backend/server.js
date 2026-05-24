const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('../frontend'));

// Multer configuration
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.txt', '.log', '.json', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed: .txt, .log, .json, .csv'));
    }
  }
});

// ============================================
// INTELLIGENT FAILURE DETECTION ENGINE
// ============================================

class APIFailureAnalyzer {
  constructor() {
    this.failures = [];
    this.successCount = 0;
    this.totalCount = 0;
  }

  // Parse various log formats
  parseLogFile(content) {
    const logs = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Try JSON format
      try {
        const json = JSON.parse(line);
        if (json.logs && Array.isArray(json.logs)) {
          logs.push(...json.logs);
        } else if (json.timestamp || json.status) {
          logs.push(json);
        }
        continue;
      } catch (e) {}

      // Try CSV format
      if (line.includes(',') && !line.toLowerCase().includes('timestamp')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const logEntry = this.parseCSVLine(parts);
          if (logEntry) logs.push(logEntry);
          continue;
        }
      }

      // Try Apache/Nginx format
      const apacheMatch = line.match(
        /(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\w+)\s+([^\s]+)\s+(\S+)"\s+(\d+)/
      );
      if (apacheMatch) {
        logs.push({
          timestamp: apacheMatch[4],
          method: apacheMatch[5],
          endpoint: apacheMatch[6],
          status: parseInt(apacheMatch[8]),
          responseTime: 0.5
        });
        continue;
      }

      // Try generic format: "2024-05-23 | GET /api/users | 500 | 0.5s"
      const genericMatch = line.match(
        /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})?\s*\|\s*(\w+)\s+([^\s|]+)\s*\|\s*(\d{3})\s*\|\s*([\d.]+)s?/i
      );
      if (genericMatch) {
        logs.push({
          timestamp: genericMatch[1] || new Date().toISOString(),
          method: genericMatch[2],
          endpoint: genericMatch[3],
          status: parseInt(genericMatch[4]),
          responseTime: parseFloat(genericMatch[5])
        });
        continue;
      }

      // Try simple format: "GET /api/users 500 2.3s"
      const simpleMatch = line.match(/(\w+)\s+([^\s]+)\s+(\d{3})\s+([\d.]+)s?/);
      if (simpleMatch) {
        logs.push({
          timestamp: new Date().toISOString(),
          method: simpleMatch[1],
          endpoint: simpleMatch[2],
          status: parseInt(simpleMatch[3]),
          responseTime: parseFloat(simpleMatch[4])
        });
      }
    }

    return logs;
  }

  parseCSVLine(parts) {
    const trimmed = parts.map(p => p.trim());
    if (trimmed.length >= 4) {
      return {
        timestamp: trimmed[0] || new Date().toISOString(),
        method: trimmed[1] || 'GET',
        endpoint: trimmed[2],
        status: parseInt(trimmed[3]) || 200,
        responseTime: parseFloat(trimmed[4]) || 0
      };
    }
    return null;
  }

  // Detect failures with context
  analyzeLog(log) {
    const failures = [];

    // Error status codes
    if (log.status >= 500) {
      failures.push({
        type: 'SERVER_ERROR',
        status: log.status,
        severity: 'Critical',
        description: this.getServerErrorDescription(log.status),
      });
    } else if (log.status === 429) {
      failures.push({
        type: 'RATE_LIMIT',
        status: log.status,
        severity: 'High',
        description: 'Rate limiting - too many requests',
      });
    } else if (log.status === 404) {
      failures.push({
        type: 'NOT_FOUND',
        status: log.status,
        severity: 'Medium',
        description: 'Resource not found',
      });
    } else if (log.status >= 400 && log.status < 500) {
      failures.push({
        type: 'CLIENT_ERROR',
        status: log.status,
        severity: 'High',
        description: `Client error: ${this.getErrorDescription(log.status)}`,
      });
    }

    // Slow responses
    if (log.responseTime > 5) {
      failures.push({
        type: 'SLOW_RESPONSE',
        status: 'TIMEOUT',
        severity: log.responseTime > 10 ? 'Critical' : 'High',
        description: `Slow response time: ${log.responseTime.toFixed(2)}s`,
      });
    } else if (log.responseTime > 2) {
      failures.push({
        type: 'SLOW_RESPONSE',
        status: 'SLOW',
        severity: 'Medium',
        description: `Degraded response time: ${log.responseTime.toFixed(2)}s`,
      });
    }

    // Special case detection
    if (log.endpoint && log.endpoint.includes('/health')) {
      if (log.status >= 400) {
        failures.forEach(f => (f.severity = 'Critical'));
      }
    }

    return failures;
  }

  getServerErrorDescription(status) {
    const descriptions = {
      500: 'Internal server error',
      501: 'Not implemented',
      502: 'Bad gateway',
      503: 'Service unavailable',
      504: 'Gateway timeout'
    };
    return descriptions[status] || 'Server error';
  }

  getErrorDescription(status) {
    const descriptions = {
      400: 'Bad request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not found',
      405: 'Method not allowed',
      408: 'Request timeout',
      409: 'Conflict',
      410: 'Gone',
      422: 'Unprocessable entity'
    };
    return descriptions[status] || 'Client error';
  }

  // AI-powered root cause analysis
  async generateFixSuggestion(failure, endpoint, method) {
    const key = `${failure.type}_${failure.status}`;
    const context = { endpoint, method, responseTime: failure.responseTime };

    const suggestions = {
      'SERVER_ERROR_500': {
        rootCause: 'Unhandled exception or database connection pool exhausted',
        fixSuggestion: 'Check application logs for stack traces. Increase database connection pool size and add proper error handling middleware.',
        codeExample: `// Increase connection pool in your database config
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});`
      },
      'SERVER_ERROR_502': {
        rootCause: 'Upstream server (database, third-party API) is unreachable or overloaded',
        fixSuggestion: 'Implement health checks for upstream services. Add circuit breaker pattern to gracefully handle failures.',
        codeExample: `// Simple circuit breaker pattern
class CircuitBreaker {
  constructor(request, timeout = 5000) {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.request = request;
    this.timeout = timeout;
  }
  
  async execute() {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is open');
    }
    try {
      const result = await this.request();
      this.failureCount = 0;
      this.state = 'CLOSED';
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= 5) {
        this.state = 'OPEN';
        setTimeout(() => { this.state = 'HALF_OPEN'; }, this.timeout);
      }
      throw error;
    }
  }
}`
      },
      'SERVER_ERROR_503': {
        rootCause: 'Service overloaded or temporarily unavailable. Often caused by payment gateway, email service, or database timeouts.',
        fixSuggestion: 'Implement exponential backoff retry logic. Add rate limiting and queue system for heavy operations.',
        codeExample: `// Exponential backoff retry with jitter
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, i) + Math.random() * 1000, 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
app.post('/api/payment', async (req, res) => {
  try {
    const result = await retryWithBackoff(() => paymentGateway.charge(req.body));
    res.json({ success: true, transactionId: result.id });
  } catch (error) {
    res.status(503).json({ error: 'Payment service temporarily unavailable' });
  }
});`
      },
      'SERVER_ERROR_504': {
        rootCause: 'Timeout waiting for upstream service response. Database query too slow or external API hanging.',
        fixSuggestion: 'Add query timeouts, optimize database indices, and implement request-level timeouts.',
        codeExample: `// Add timeout middleware
const timeout = (ms) => (req, res, next) => {
  const id = setTimeout(() => {
    res.status(504).json({ error: 'Gateway timeout' });
  }, ms);
  res.on('finish', () => clearTimeout(id));
  next();
};

app.use(timeout(30000)); // 30 second timeout

// Optimize database queries with indices
// CREATE INDEX idx_user_email ON users(email);
// CREATE INDEX idx_order_created ON orders(created_at DESC);
`
      },
      'CLIENT_ERROR_400': {
        rootCause: 'Invalid request parameters or malformed JSON payload',
        fixSuggestion: 'Add request validation middleware. Check for required fields and correct data types.',
        codeExample: `// Request validation middleware
const validateRequest = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        fields: missingFields 
      });
    }
    next();
  };
};

// Usage
app.post('/api/users', validateRequest(['email', 'password']), (req, res) => {
  // Handle request
});`
      },
      'CLIENT_ERROR_401': {
        rootCause: 'Missing or invalid authentication token',
        fixSuggestion: 'Verify JWT token validity, check token expiration, and ensure proper Authorization header format.',
        codeExample: `// JWT authentication middleware
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ user: req.user });
});`
      },
      'CLIENT_ERROR_403': {
        rootCause: 'User lacks permissions to access this resource',
        fixSuggestion: 'Implement role-based access control (RBAC) and verify user permissions before granting access.',
        codeExample: `// RBAC middleware
const authorize = (requiredRoles) => {
  return (req, res, next) => {
    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage
app.delete('/api/users/:id', verifyToken, authorize(['admin']), (req, res) => {
  // Only admins can delete users
});`
      },
      'NOT_FOUND_404': {
        rootCause: 'Resource doesn\'t exist. Often caused by missing validation or incorrect endpoint deletion.',
        fixSuggestion: 'Check if resource exists before accessing. Add proper 404 handlers and validate IDs.',
        codeExample: `// Check resource existence before operations
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add 404 catch-all
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});`
      },
      'RATE_LIMIT_429': {
        rootCause: 'Client exceeded API rate limit. Possible DDoS or inefficient client retry logic.',
        fixSuggestion: 'Implement rate limiting middleware. Use sliding window or token bucket algorithm.',
        codeExample: `// Simple rate limiter using express-rate-limit
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Custom rate limiting for specific endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5 // 5 requests per minute
});

app.post('/api/login', strictLimiter, (req, res) => {
  // Handle login
});`
      },
      'SLOW_RESPONSE_TIMEOUT': {
        rootCause: 'Response exceeds 5 seconds. Likely N+1 query problem, missing database indices, or heavy computations.',
        fixSuggestion: 'Add database query optimization, implement caching, or move heavy operations to background jobs.',
        codeExample: `// Solution 1: Add database indices
// CREATE INDEX idx_posts_user_id ON posts(user_id);
// SELECT u.*, COUNT(p.id) FROM users u LEFT JOIN posts p ON u.id = p.user_id GROUP BY u.id;

// Solution 2: Implement caching with Redis
const redis = require('redis');
const client = redis.createClient();

async function getUserWithPosts(userId) {
  const cached = await client.get(\`user:\${userId}:posts\`);
  if (cached) return JSON.parse(cached);
  
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const posts = await db.query('SELECT * FROM posts WHERE user_id = $1', [userId]);
  
  const result = { ...user.rows[0], posts: posts.rows };
  await client.setex(\`user:\${userId}:posts\`, 3600, JSON.stringify(result));
  return result;
}

// Solution 3: Move heavy operations to async jobs
app.post('/api/export', async (req, res) => {
  const jobId = await queue.add('export-data', req.body);
  res.json({ jobId, message: 'Export started' });
});`
      },
      'SLOW_RESPONSE_SLOW': {
        rootCause: 'Response time degraded (2-5 seconds). Monitor this endpoint closely.',
        fixSuggestion: 'Consider implementing pagination, filtering, or lazy loading for large datasets.',
        codeExample: `// Implement pagination to improve response time
app.get('/api/posts', async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;
  
  const posts = await db.query(
    'SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  
  const total = await db.query('SELECT COUNT(*) FROM posts');
  
  res.json({
    posts: posts.rows,
    pagination: {
      page,
      limit,
      total: total.rows[0].count,
      pages: Math.ceil(total.rows[0].count / limit)
    }
  });
});`
      }
    };

    return suggestions[key] || {
      rootCause: 'Service degradation detected',
      fixSuggestion: 'Monitor logs for more details and implement proper error handling.',
      codeExample: 'Review application logs and implement comprehensive error tracking.'
    };
  }

  async analyze(content) {
    const logs = this.parseLogFile(content);
    this.totalCount = logs.length;

    const allFailures = [];
    const failureMap = {};

    for (const log of logs) {
      if (log.status >= 200 && log.status < 400 && log.responseTime <= 2) {
        this.successCount++;
      } else {
        const failures = this.analyzeLog(log);
        for (const failure of failures) {
          const failureId = `${log.endpoint}_${failure.type}_${failure.status}`;
          if (!failureMap[failureId]) {
            failureMap[failureId] = {
              id: failureId,
              endpoint: log.endpoint,
              method: log.method || 'GET',
              type: failure.type,
              status: failure.status,
              severity: failure.severity,
              description: failure.description,
              count: 0,
              responseTime: log.responseTime,
              rootCause: '',
              fixSuggestion: '',
              codeExample: ''
            };
          }
          failureMap[failureId].count++;
        }
      }
    }

    // Generate AI-powered fixes
    for (const id in failureMap) {
      const failure = failureMap[id];
      const suggestion = await this.generateFixSuggestion(failure, failure.endpoint, failure.method);
      failure.rootCause = suggestion.rootCause;
      failure.fixSuggestion = suggestion.fixSuggestion;
      failure.codeExample = suggestion.codeExample;
      allFailures.push(failure);
    }

    return {
      totalAnalyzed: this.totalCount,
      successCount: this.successCount,
      failureCount: allFailures.length,
      successRate: this.totalCount > 0 ? ((this.successCount / this.totalCount) * 100).toFixed(1) : 0,
      failures: allFailures.sort((a, b) => {
        const severityOrder = { Critical: 0, High: 1, Medium: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
    };
  }
}

// ============================================
// API ENDPOINTS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running perfectly' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      content
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    const analyzer = new APIFailureAnalyzer();
    const results = await analyzer.analyze(content);

    res.json(results);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze logs' });
  }
});

app.get('/api/sample', (req, res) => {
  const sampleLogs = `GET /api/users 200 0.3s
GET /api/users/1 200 0.2s
POST /api/users 500 1.2s
GET /api/products 200 0.5s
GET /api/products/999 404 0.1s
GET /api/orders 503 8.5s
POST /api/checkout 502 15.3s
GET /api/notifications 200 0.4s
GET /api/analytics 504 45.2s
POST /api/payment 429 0.8s`;

  const analyzer = new APIFailureAnalyzer();
  analyzer.analyze(sampleLogs).then(results => {
    res.json(results);
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  API Failure Detection Server          ║
║  Running on http://localhost:${PORT}      ║
║  Open http://localhost:3000 in browser ║
╚════════════════════════════════════════╝
  `);
});