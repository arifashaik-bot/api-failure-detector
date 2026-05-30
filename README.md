# API Failure Detector

AI-powered tool that analyzes API logs, detects failures, and provides intelligent fix recommendations.

## Live Demo
🌐 Live Project: https://api-failure-detector-sjot.vercel.app/

## Features

- Upload log files in TXT, LOG, JSON, or CSV format
- Automatic detection of API failures (500 errors, 404 errors, timeouts, slow responses)
- AI-powered root cause analysis for each failure
- Actionable fix suggestions with code examples
- Real-time statistics and success rate calculation
- Filter failures by severity (Critical, High, Medium)
- Export analysis results as JSON
- Beautiful glassmorphism UI with dark theme

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express
- **File Handling**: Multer
- **AI Engine**: Rule-based intelligent analyzer

## Prerequisites

- Node.js (version 14 or higher)
- Python 3 (for simple HTTP server)
- Modern web browser (Chrome, Firefox, Edge)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/arifashaik-bot/api-failure-detector.git
cd api-failure-detector
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

The following packages will be installed:

- express
- cors
- multer
- dotenv

### 3. Start the backend server

```bash
npm start
```

You should see:

```text
Server running on http://localhost:5000
```

Keep this terminal window open.

### 4. Start the frontend server

Open a new terminal window and run:

```bash
cd frontend
python -m http.server 3000
```

If Python is not available, use:

```bash
npx serve .
```

You should see:

```text
Serving HTTP on :: port 3000 (http://[::]:3000/) ...
```

### 5. Open the application

Open your browser and navigate to:

```text
http://localhost:3000
```

## How to Use

### Upload and Analyze Logs

1. Click the "Upload Log File" button
2. Select a log file (`sample-logs.txt` is provided in the frontend folder)
3. Click "Analyze Failures"
4. View the statistics cards showing total logs, failures found, and success rate
5. Browse the list of detected failures

### Analyze a Specific Failure

1. Click the "Analyze" button on any failure card
2. A modal window will open showing:
   - Root cause explanation
   - Fix recommendation
   - Code example to resolve the issue
3. Click the copy button to copy the fix code

### Filter and Search

- Use the filter buttons to show failures by severity
- Use the search bar to find specific endpoints
- Sort by cost or severity

### Export Results

Click the "Export" button to download the analysis report as a JSON file.

## Sample Log Format

The application accepts logs in the following format:

```text
timestamp | method | endpoint | status | responseTime
```

Example:

```text
2024-05-23 10:00:01 | GET /api/users | 500 | 0.50
2024-05-23 10:00:05 | POST /api/login | 200 | 12.30
```

## Project Structure

```text
api-failure-detector/
├── .gitignore
├── backend/
│   ├── server.js         # Express server and API endpoints
│   ├── package.json      # Node.js dependencies
│   └── uploads/          # Temporary storage for uploaded files
├── frontend/
│   ├── index.html        # Main application page
│   ├── style.css         # Styling and animations
│   ├── script.js         # Frontend logic and API calls
│   └── sample-logs.txt   # Sample log file for testing
├── LICENSE
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/logs | Returns sample logs |
| POST | /api/upload-logs | Upload and parse log file |
| POST | /api/analyze-all | Analyze all logs for failures |
| POST | /api/analyze | Analyze a single log entry |

### File upload failing

- Ensure file size is under 10MB
- Supported formats: `.txt`, `.log`, `.json`, `.csv`
- Check that the `uploads` folder exists in backend directory

## License

MIT

## Author

Shaik Arifa
