// ============================================
// APP STATE & CONFIGURATION
// ============================================

const API_URL = 'https://api-failure-detector.onrender.com';
let currentResults = null;
let uploadedContent = '';
let currentFailures = [];

// ============================================
// THEME MANAGEMENT
// ============================================

function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  setTheme(theme);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function setTheme(theme) {
  document.body.className = `${theme}-mode`;
  localStorage.setItem('theme', theme);
  updateThemeIcon();
}

function toggleTheme() {
  const currentTheme = document.body.className.split('-')[0];
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function updateThemeIcon() {
  const icon = document.querySelector('.theme-icon');
  const isDark = document.body.classList.contains('dark-mode');
  icon.textContent = isDark ? '☀️' : '🌙';
}

// ============================================
// FILE UPLOAD & DRAG-DROP
// ============================================

function initUpload() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const demoBtn = document.getElementById('demoBtn');

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  analyzeBtn.addEventListener('click', analyzeFailures);
  clearBtn.addEventListener('click', clearFile);
  demoBtn.addEventListener('click', loadDemoLogs);
}

function handleFiles(files) {
  if (files.length === 0) return;

  const file = files[0];
  const allowedTypes = ['.txt', '.log', '.json', '.csv'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowedTypes.includes(ext)) {
    showToast('Invalid file format. Please use .txt, .log, .json, or .csv', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedContent = e.target.result;
    displayFileInfo(file.name, file.size);
    document.getElementById('analyzeBtn').disabled = false;
  };

  reader.onerror = () => {
    showToast('Error reading file', 'error');
  };

  reader.readAsText(file);
}

function displayFileInfo(filename, size) {
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');

  fileName.textContent = filename;
  fileSize.textContent = `${(size / 1024).toFixed(2)} KB`;
  fileInfo.style.display = 'flex';
}

function clearFile() {
  uploadedContent = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('analyzeBtn').disabled = true;
  hideResults();
}

// ============================================
// ANALYSIS & API CALLS
// ============================================

async function analyzeFailures() {
  if (!uploadedContent) {
    showToast('Please upload a file first', 'error');
    return;
  }

  const spinner = document.getElementById('loadingSpinner');
  spinner.classList.add('active');

  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: uploadedContent })
    });

    if (!response.ok) {
      throw new Error('Analysis failed');
    }

    const results = await response.json();
    currentResults = results;
    currentFailures = results.failures || [];
    displayResults(results);
    showToast('Analysis complete!', 'success');
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to analyze logs. Is the backend running?', 'error');
  } finally {
    spinner.classList.remove('active');
  }
}

async function loadDemoLogs() {
  const spinner = document.getElementById('loadingSpinner');
  spinner.classList.add('active');

  try {
    const response = await fetch(`${API_URL}/api/sample`);
    
    if (!response.ok) {
      throw new Error('Failed to load sample');
    }

    const results = await response.json();
    currentResults = results;
    currentFailures = results.failures || [];
    displayResults(results);
    displayFileInfo('sample-logs.txt', 1234);
    showToast('Sample logs loaded!', 'success');
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to load sample logs. Is the backend running?', 'error');
  } finally {
    spinner.classList.remove('active');
  }
}

// ============================================
// RESULTS DISPLAY
// ============================================

function displayResults(results) {
  const {
    totalAnalyzed,
    successCount,
    failureCount,
    successRate,
    failures
  } = results;

  // Show/hide sections
  document.getElementById('statsSection').style.display = 'block';
  document.getElementById('filtersSection').style.display = failures.length > 0 ? 'block' : 'none';
  document.getElementById('failuresSection').style.display = failures.length > 0 ? 'block' : 'none';
  document.getElementById('successSection').style.display = failures.length === 0 ? 'block' : 'none';

  // Update stats
  animateCounter('statTotal', totalAnalyzed);
  animateCounter('statSuccess', successCount);
  animateCounter('statFailures', failureCount);
  document.getElementById('statRate').textContent = successRate + '%';

  // Display failures
  if (failures.length > 0) {
    displayFailures(failures);
  }
}

function displayFailures(failures) {
  const failuresList = document.getElementById('failuresList');
  failuresList.innerHTML = '';
  failuresList.className = 'failures-list list-view';

  failures.forEach((failure, index) => {
    const card = createFailureCard(failure);
    failuresList.appendChild(card);
    // Stagger animation
    setTimeout(() => {
      card.style.animation = `fadeInUp 0.5s ease-out ${index * 0.05}s both`;
    }, 0);
  });

  initFailureCards();
  initFilters();
}

function createFailureCard(failure) {
  const card = document.createElement('div');
  card.className = 'failure-card';
  card.dataset.severity = failure.severity;
  card.dataset.endpoint = failure.endpoint;
  card.dataset.id = failure.id;

  const severityClass = failure.severity.toLowerCase();
  const statusDisplay = failure.status || 'ERROR';

  card.innerHTML = `
    <div class="failure-header">
      <div class="failure-title">${failure.type.replace(/_/g, ' ')}</div>
      <div class="severity-badge ${severityClass}">${failure.severity}</div>
    </div>

    <div class="failure-meta">
      <span class="failure-endpoint">${failure.endpoint}</span>
      <span class="failure-status">${statusDisplay}</span>
    </div>

    <div class="failure-description">${failure.description}</div>

    <div class="failure-stats">
      <div class="failure-stat">
        <div class="failure-stat-label">Occurrences</div>
        <div class="failure-stat-value">${failure.count}</div>
      </div>
      <div class="failure-stat">
        <div class="failure-stat-label">Type</div>
        <div class="failure-stat-value">${failure.method}</div>
      </div>
    </div>
  `;

  return card;
}

function initFailureCards() {
  const cards = document.querySelectorAll('.failure-card');
  cards.forEach(card => {
    card.addEventListener('click', () => openFailureModal(card.dataset.id));
  });
}

// ============================================
// MODAL FUNCTIONALITY
// ============================================

function openFailureModal(failureId) {
  const failure = currentFailures.find(f => f.id === failureId);
  if (!failure) return;

  const modal = document.getElementById('failureModal');
  const severityClass = failure.severity.toLowerCase();

  document.getElementById('modalSeverity').className = `severity-badge ${severityClass}`;
  document.getElementById('modalSeverity').textContent = failure.severity;
  document.getElementById('modalTitle').textContent = failure.type.replace(/_/g, ' ');
  document.getElementById('modalEndpoint').textContent = failure.endpoint;
  document.getElementById('modalStatus').textContent = failure.status || 'ERROR';
  document.getElementById('modalDescription').textContent = failure.description;
  document.getElementById('modalRootCause').textContent = failure.rootCause;
  document.getElementById('modalFixSuggestion').textContent = failure.fixSuggestion;
  document.getElementById('modalCodeExample').textContent = failure.codeExample;
  document.getElementById('modalCount').textContent = failure.count;
  document.getElementById('modalSeverityValue').textContent = failure.severity;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Setup copy button
  const copyBtn = document.getElementById('copyCodeBtn');
  copyBtn.onclick = () => copyCode(failure.codeExample);
}

function closeModal() {
  const modal = document.getElementById('failureModal');
  modal.classList.remove('active');
  document.body.style.overflow = 'auto';
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copyCodeBtn');
    const text = btn.querySelector('.copy-text');
    const originalText = text.textContent;
    
    btn.classList.add('copied');
    text.textContent = 'Copied!';
    
    setTimeout(() => {
      btn.classList.remove('copied');
      text.textContent = originalText;
    }, 2000);
  });
}

// ============================================
// FILTERING & SEARCH
// ============================================

function initFilters() {
  const searchInput = document.getElementById('searchInput');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const viewBtns = document.querySelectorAll('.view-btn');

  searchInput.addEventListener('input', applyFilters);
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      applyFilters();
    });
  });

  viewBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const view = e.target.dataset.view;
      const list = document.getElementById('failuresList');
      if (view === 'grid') {
        list.classList.remove('list-view');
      } else {
        list.classList.add('list-view');
      }
    });
  });
}

function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const severity = document.querySelector('.filter-btn.active').dataset.severity;
  const cards = document.querySelectorAll('.failure-card');

  cards.forEach(card => {
    const matchesSeverity = severity === 'all' || card.dataset.severity === severity;
    const matchesSearch = card.dataset.endpoint.toLowerCase().includes(searchTerm);
    
    card.style.display = matchesSeverity && matchesSearch ? 'block' : 'none';
  });
}

// ============================================
// EXPORT FUNCTIONALITY
// ============================================

function initExport() {
  const exportBtn = document.getElementById('exportBtn');
  exportBtn.addEventListener('click', exportResults);
}

function exportResults() {
  if (!currentResults) return;

  const dataStr = JSON.stringify(currentResults, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `api-analysis-${new Date().getTime()}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast('Results exported!', 'success');
}

// ============================================
// UTILITIES
// ============================================

function animateCounter(elementId, target) {
  const element = document.getElementById(elementId);
  const start = 0;
  const duration = 1000;
  const startTime = Date.now();

  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.floor(start + (target - start) * progress);
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  update();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function hideResults() {
  document.getElementById('statsSection').style.display = 'none';
  document.getElementById('filtersSection').style.display = 'none';
  document.getElementById('failuresSection').style.display = 'none';
  document.getElementById('successSection').style.display = 'none';
}

function showHelp() {
  showToast('Upload your API log file and click Analyze to find failures!', 'info');
}

function downloadSample() {
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

  const blob = new Blob([sampleLogs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sample-logs.txt';
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================
// EVENT LISTENERS & INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initUpload();
  initExport();

  // Modal close handlers
  const modal = document.getElementById('failureModal');
  document.getElementById('failureModal').addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.querySelector('.modal-close').addEventListener('click', closeModal);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  console.log(`
╔════════════════════════════════════════╗
║  API Failure Detection Agent          ║
║  Ready to analyze logs!                ║
╚════════════════════════════════════════╝
  `);
});

// ============================================
// NETWORK ERROR HANDLING
// ============================================

window.addEventListener('offline', () => {
  showToast('Network connection lost', 'error');
});

window.addEventListener('online', () => {
  showToast('Network connection restored', 'success');
});

// Handle backend connection errors
const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
};

// Initial backend check
setTimeout(async () => {
  const isConnected = await checkBackendConnection();
  if (!isConnected) {
    console.warn('Backend server not detected. Some features may not work.');
  }
}, 1000);
