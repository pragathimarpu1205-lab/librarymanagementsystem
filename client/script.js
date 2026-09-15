const API_BASE = "/";
let currentUser = null;
let books = [];
let students = [];
let activityLog = [];
let loanRecords = [];
let paymentRecords = [];
let emailLogs = [];
let fineRate = 10;
let paymentConfig = {
  upiId: 'librarypay@upi',
  payeeName: 'The Reading Room Library',
  qrCodeImage: null,
  instructions: 'Scan the QR code with any UPI app to pay your fine of ₹10/day.'
};
let currentProfileId = null;
let currentRole = 'admin';
let currentView = 'admin-dashboard';
let activePaymentLoan = null;

// Payment Scanner State
let payQrScanner = null;
let isPayCamRunning = false;

// DOM Elements
const views = document.querySelectorAll('.view');
const navTabs = document.getElementById('navTabs');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginRoleBtn = document.getElementById('roleAdminBtn');
const studentRoleBtn = document.getElementById('roleStudentBtn');
const registerStudentBtn = document.getElementById('registerStudentBtn');
const loginError = document.getElementById('loginError');
const globalAlert = document.getElementById('globalAlert');
const stampFlash = document.getElementById('stampFlash');

// Topbar Action Buttons
const openMailHubTopBtn = document.getElementById('openMailHubTopBtn');
const openPaymentSettingsBtn = document.getElementById('openPaymentSettingsBtn');

// Admin Elements
const studentSearchInput = document.getElementById('studentSearchInput');
const studentSearchResults = document.getElementById('studentSearchResults');
const studentListSearchInput = document.getElementById('studentListSearchInput');
const studentCount = document.getElementById('studentCount');
const fineRateInput = document.getElementById('fineRateInput');
const saveFineRateBtn = document.getElementById('saveFineRateBtn');
const triggerRemindersBtn = document.getElementById('triggerRemindersBtn');
const refreshPaymentsBtn = document.getElementById('refreshPaymentsBtn');

// Student Profile Elements
const profileName = document.getElementById('profileName');
const profileId = document.getElementById('profileId');
const profileEmail = document.getElementById('profileEmail');
const profileOutstanding = document.getElementById('profileOutstanding');
const profileCurrentBody = document.getElementById('profileCurrentBody');
const profileHistoryBody = document.getElementById('profileHistoryBody');
const profileBackBtn = document.getElementById('profileBackBtn');
const profileIssueBtn = document.getElementById('profileIssueBtn');
const profilePayFineBtn = document.getElementById('profilePayFineBtn');

// Modals
const addModal = document.getElementById('addModal');
const addBookBtn = document.getElementById('addBookBtn');
const addStudentModal = document.getElementById('addStudentModal');
const paymentModal = document.getElementById('paymentModal');
const receiptModal = document.getElementById('receiptModal');
const paymentSettingsModal = document.getElementById('paymentSettingsModal');
const proofViewModal = document.getElementById('proofViewModal');

// API helper
async function api(path, options = {}) {
  try {
    const response = await fetch(path, options);
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e){ json = { _raw: text }; }
    return json;
  } catch (error) {
    console.error('API Error:', path, error);
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]+/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]);
}

function fmtDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function daysFromNow(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

function isOverdue(book) {
  if (book.status !== 'out' || !book.due) return false;
  return new Date(book.due) < new Date();
}

function daysOverdue(book) {
  if (!book.due) return 0;
  const due = new Date(book.due);
  const diff = Math.ceil((new Date() - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function studentName(id) {
  const student = students.find(s => s.id === id);
  return student ? student.name : 'Unknown';
}

function playStamp(text) {
  stampFlash.textContent = text;
  stampFlash.classList.add('play');
  setTimeout(() => stampFlash.classList.remove('play'), 900);
}

function showModal(modal) {
  if (modal) modal.classList.add('show');
}
function hideModal(modal) {
  if (modal) modal.classList.remove('show');
}

// ----------------------------------------------------
// AUTHENTICATION & APP SHELL
// ----------------------------------------------------

function setRole(role) {
  currentRole = role;
  loginRoleBtn.classList.toggle('active', role === 'admin');
  studentRoleBtn.classList.toggle('active', role === 'student');
  document.getElementById('loginHint').innerHTML = role === 'admin'
    ? 'Demo admin login — username: <b>admin</b> · password: <b>admin123</b>'
    : 'Demo student login — email: <b>student@gmail.com</b> · password: <b>student123</b>';
  loginUser.placeholder = role === 'student' ? 'e.g. student@gmail.com' : 'e.g. admin';
}

async function login() {
  const username = loginUser.value.trim();
  const password = loginPass.value.trim();
  if (!username || !password) {
    loginError.textContent = 'Enter both username/email and password.';
    return;
  }
  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginError.textContent = '';
  try {
    const result = await api(API_BASE + 'login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password, role: currentRole })
    });
    if (!result || !result.success) {
      loginError.textContent = result?.message || 'Login failed. Please check your credentials.';
      return;
    }
    currentUser = result.user;
    await enterApp();
  } catch (err) {
    loginError.textContent = 'Unable to connect to backend server.';
  } finally {
    loginBtn.disabled = false;
  }
}

async function enterApp() {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('roleBadge').textContent = currentUser.role === 'admin' ? 'Admin' : 'Student';
  
  // Show / Hide admin only buttons
  addBookBtn.classList.toggle('hidden', currentUser.role !== 'admin');
  openMailHubTopBtn.classList.toggle('hidden', currentUser.role !== 'admin');
  openPaymentSettingsBtn.classList.toggle('hidden', currentUser.role !== 'admin');

  buildNav();
  await refreshAllData();

  if (currentUser.role === 'admin') {
    showView('admin-dashboard');
  } else {
    showView('student-dashboard');
  }
}

function buildNav() {
  const items = currentUser.role === 'admin' ? [
    {key:'admin-dashboard', label:'Dashboard'},
    {key:'mail-hub', label:'📧 Mail Hub'},
    {key:'catalog', label:'Catalog'},
    {key:'issue', label:'Issue Book'},
    {key:'return', label:'Return Book'},
    {key:'students', label:'Students'}
  ] : [
    {key:'student-dashboard', label:'Dashboard & Fines'},
    {key:'catalog', label:'Catalog'}
  ];
  navTabs.innerHTML = items.map(i => `<button class="nav-tab" data-view="${i.key}">${i.label}</button>`).join('');
  navTabs.querySelectorAll('.nav-tab').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
}

function showView(name) {
  currentView = name;
  views.forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));

  if (name === 'admin-dashboard') renderAdminDashboard();
  if (name === 'student-dashboard') renderStudentDashboard();
  if (name === 'mail-hub') renderMailHub();
  if (name === 'catalog') renderCatalog();
  if (name === 'issue') renderIssueForm();
  if (name === 'return') renderReturnTable();
  if (name === 'students') filterStudentsTable();
}

async function refreshAllData() {
  const [bookData, studentData, activityData, fineData, loansData, payConfigData, paymentsData, emailLogsData] = await Promise.all([
    api(API_BASE + 'books'),
    api(API_BASE + 'students'),
    api(API_BASE + 'activity'),
    api(API_BASE + 'fine-rate'),
    api(API_BASE + 'loans'),
    api(API_BASE + 'api/payment-config'),
    api(API_BASE + 'api/payments'),
    api(API_BASE + 'api/email-logs')
  ]);

  books = Array.isArray(bookData) ? bookData : [];
  students = Array.isArray(studentData) ? studentData : [];
  activityLog = Array.isArray(activityData) ? activityData : [];
  fineRate = fineData?.fineRate ?? fineRate;
  loanRecords = Array.isArray(loansData) ? loansData : [];
  if (payConfigData) paymentConfig = Object.assign(paymentConfig, payConfigData);
  paymentRecords = Array.isArray(paymentsData) ? paymentsData : [];
  emailLogs = Array.isArray(emailLogsData) ? emailLogsData : [];

  if (fineRateInput) fineRateInput.value = fineRate;
  populateGenres();
  populateComposerStudents();
}

// ----------------------------------------------------
// PAYMENT QR & SCANNER ONLY (PAYMENT MODAL)
// ----------------------------------------------------

const tabPayShowQr = document.getElementById('tabPayShowQr');
const tabPayScanner = document.getElementById('tabPayScanner');
const payTabShowQrContent = document.getElementById('payTabShowQrContent');
const payTabScannerContent = document.getElementById('payTabScannerContent');

tabPayShowQr?.addEventListener('click', () => {
  tabPayShowQr.classList.add('active');
  tabPayScanner.classList.remove('active');
  payTabShowQrContent.classList.remove('hidden');
  payTabScannerContent.classList.add('hidden');
  stopPaymentCamera();
});

tabPayScanner?.addEventListener('click', () => {
  tabPayScanner.classList.add('active');
  tabPayShowQr.classList.remove('active');
  payTabScannerContent.classList.remove('hidden');
  payTabShowQrContent.classList.add('hidden');
});

function openPaymentModal(loanId, studentId, amount, bookTitle) {
  const fineAmt = Number(amount) || 10;
  activePaymentLoan = { loanId, studentId, amount: fineAmt, bookTitle };

  document.getElementById('qrFineAmount').textContent = `₹${fineAmt}`;
  document.getElementById('qrFineDescription').textContent = bookTitle
    ? `Late fine for "${bookTitle}" (${Math.ceil(fineAmt/fineRate)} days @ ₹${fineRate}/day)`
    : `Total outstanding library fine (${Math.ceil(fineAmt/fineRate)} days @ ₹${fineRate}/day)`;

  document.getElementById('displayUpiId').textContent = paymentConfig.upiId || 'librarypay@upi';
  document.getElementById('payTxnId').value = '';
  document.getElementById('payProofFile').value = '';
  document.getElementById('payProofPreview').classList.add('hidden');
  document.getElementById('payProofPreview').src = '';
  document.getElementById('payScanStatusMessage').innerHTML = '';

  // Default to Show QR tab
  tabPayShowQr.click();

  const qrImg = document.getElementById('dynamicQrImage');
  if (paymentConfig.qrCodeImage) {
    qrImg.src = paymentConfig.qrCodeImage;
  } else {
    const cleanTitle = (bookTitle || 'Fine_Settlement').replace(/[^a-zA-Z0-9]/g, '_');
    const upiUri = `upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}&pn=${encodeURIComponent(paymentConfig.payeeName)}&am=${fineAmt}&cu=INR&tn=${encodeURIComponent('Library_Fine_' + cleanTitle)}`;
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;
  }

  showModal(paymentModal);
}

function openStudentGeneralPayment(totalOutstanding) {
  openPaymentModal(null, currentUser?.id, totalOutstanding, 'Library Outstanding Fine');
}

window.openPaymentModal = openPaymentModal;
window.openStudentGeneralPayment = openStudentGeneralPayment;

// Payment Camera Scanner
async function startPaymentCamera() {
  if (isPayCamRunning) return;
  const placeholderEl = document.getElementById('payCamPlaceholder');
  const startBtn = document.getElementById('btnStartPayCam');
  const stopBtn = document.getElementById('btnStopPayCam');

  if (typeof Html5Qrcode === 'undefined') {
    alert('Camera scanning library loading... Use the Screenshot Upload below.');
    return;
  }

  try {
    placeholderEl.style.display = 'none';
    payQrScanner = new Html5Qrcode("payScannerReader");
    await payQrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 180, height: 180 } },
      (decodedText) => {
        handlePaymentScanSuccess(decodedText);
      },
      () => {}
    );
    isPayCamRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
  } catch (err) {
    console.error('Camera start error:', err);
    placeholderEl.style.display = 'block';
    placeholderEl.innerHTML = `
      <div style="font-size:24px; color:var(--overdue);">⚠️</div>
      <div style="color:var(--overdue); font-size:12px; font-weight:600;">Camera Unavailable</div>
      <div style="font-size:11px; color:#666;">Use the screenshot upload below to scan payment QR.</div>
    `;
    isPayCamRunning = false;
  }
}

async function stopPaymentCamera() {
  if (!isPayCamRunning || !payQrScanner) return;
  try {
    await payQrScanner.stop();
    payQrScanner.clear();
  } catch (e) {
    console.warn(e);
  }
  isPayCamRunning = false;
  document.getElementById('payCamPlaceholder').style.display = 'block';
  document.getElementById('btnStartPayCam').style.display = 'inline-flex';
  document.getElementById('btnStopPayCam').style.display = 'none';
}

document.getElementById('btnStartPayCam')?.addEventListener('click', startPaymentCamera);
document.getElementById('btnStopPayCam')?.addEventListener('click', stopPaymentCamera);

// Payment Screenshot Upload Scanner
const payScanDropZone = document.getElementById('payScanDropZone');
const payScanFileInput = document.getElementById('payScanFileInput');
payScanDropZone?.addEventListener('click', () => payScanFileInput.click());
payScanFileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Also auto-attach file to payment proof preview
  const reader = new FileReader();
  reader.onload = (evt) => {
    const preview = document.getElementById('payProofPreview');
    preview.src = evt.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);

  if (typeof Html5Qrcode !== 'undefined') {
    try {
      const qrScanner = new Html5Qrcode("payScannerReader");
      const decodedText = await qrScanner.scanFile(file, true);
      handlePaymentScanSuccess(decodedText);
    } catch (err) {
      document.getElementById('payScanStatusMessage').innerHTML = `<span style="color:#555;">Uploaded image attached. (No embedded QR detected, please type transaction ID).</span>`;
    }
  }
});

function handlePaymentScanSuccess(decodedText) {
  playStamp('SCANNED');
  stopPaymentCamera();
  const statusEl = document.getElementById('payScanStatusMessage');

  // Parse UPI string or raw ref
  let refId = '';
  if (decodedText.includes('pa=')) {
    try {
      const url = new URL(decodedText.startsWith('upi:') ? decodedText.replace('upi://pay', 'http://upi.org') : `http://upi.org?${decodedText}`);
      const pa = url.searchParams.get('pa') || '';
      const am = url.searchParams.get('am') || '';
      const tn = url.searchParams.get('tn') || '';
      refId = `UPI-${Date.now().toString().slice(-6)}`;
      statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✅ UPI QR Code Scanned! Payee: ${escapeHtml(pa)} ${am ? `• ₹${am}` : ''}</span>`;
    } catch (e) {
      refId = decodedText.slice(0, 20);
      statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✅ Payment QR Scanned: ${escapeHtml(decodedText.slice(0, 25))}</span>`;
    }
  } else {
    refId = decodedText.trim();
    statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✅ Scanned Receipt / Ref: <b>${escapeHtml(refId)}</b></span>`;
  }

  document.getElementById('payTxnId').value = refId;
}

// Preview manual proof upload
document.getElementById('payProofFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const preview = document.getElementById('payProofPreview');
    preview.src = evt.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// Confirm Fine Payment
document.getElementById('confirmPaymentBtn')?.addEventListener('click', async () => {
  if (!activePaymentLoan) return;

  const txnId = document.getElementById('payTxnId').value.trim() || `UPI-${Date.now().toString().slice(-6)}`;
  const proofPreview = document.getElementById('payProofPreview');
  const screenshot = (!proofPreview.classList.contains('hidden') && proofPreview.src) ? proofPreview.src : null;

  const confirmBtn = document.getElementById('confirmPaymentBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Processing Payment…';

  try {
    const response = await api(API_BASE + 'api/pay-fine', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        loanId: activePaymentLoan.loanId,
        studentId: activePaymentLoan.studentId || currentUser?.id,
        amount: activePaymentLoan.amount,
        transactionId: txnId,
        screenshot
      })
    });

    if (response && response.success) {
      stopPaymentCamera();
      hideModal(paymentModal);
      playStamp('PAID');
      await refreshAllData();

      // Show printable receipt modal
      showPaymentReceipt(response.payment);

      if (currentUser?.role === 'admin') {
        renderAdminDashboard();
      } else {
        renderStudentDashboard();
      }
    } else {
      alert(response?.message || 'Payment processing failed.');
    }
  } catch (err) {
    alert('Error recording fine payment.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm & Clear Fine';
  }
});

document.getElementById('cancelPaymentBtn')?.addEventListener('click', () => {
  stopPaymentCamera();
  hideModal(paymentModal);
});

function showPaymentReceipt(payment) {
  const content = document.getElementById('receiptContent');
  content.innerHTML = `
    <div class="receipt-header">
      <h4>The Reading Room Library</h4>
      <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:1px;">Official Fine Payment Receipt</div>
    </div>
    <div class="receipt-row"><span>Receipt No:</span><b>RCP-${payment.id.toString().padStart(5, '0')}</b></div>
    <div class="receipt-row"><span>Borrower:</span><b>${escapeHtml(payment.studentName)}</b></div>
    <div class="receipt-row"><span>Book / Reason:</span><span>${escapeHtml(payment.bookTitle)}</span></div>
    <div class="receipt-row"><span>Transaction / UTR:</span><span style="font-family:monospace;">${escapeHtml(payment.transactionId)}</span></div>
    <div class="receipt-row"><span>Payment Date:</span><span>${new Date(payment.createdAt).toLocaleString('en-GB')}</span></div>
    <div class="receipt-row"><span>Payment Method:</span><span>UPI QR Code & Scanner</span></div>
    <div class="receipt-row total"><span>Amount Settled:</span><span style="color:#059669;">₹${payment.amount} (PAID)</span></div>
  `;
  showModal(receiptModal);
}

document.getElementById('closeReceiptBtn')?.addEventListener('click', () => hideModal(receiptModal));
document.getElementById('printReceiptBtn')?.addEventListener('click', () => window.print());

// Copy UPI ID button
document.getElementById('copyUpiBtn')?.addEventListener('click', () => {
  const upiId = document.getElementById('displayUpiId').textContent;
  navigator.clipboard.writeText(upiId).then(() => alert('UPI ID copied to clipboard: ' + upiId));
});

// View Payment Screenshot Proof Modal
function viewPaymentProof(paymentId) {
  const p = paymentRecords.find(item => item.id === Number(paymentId));
  if (!p || !p.screenshot) {
    alert('No screenshot proof uploaded for this transaction.');
    return;
  }
  document.getElementById('proofFullImg').src = p.screenshot;
  document.getElementById('proofDetails').innerHTML = `
    <b>Student:</b> ${escapeHtml(p.studentName)} • <b>Amount:</b> ₹${p.amount}<br>
    <b>Transaction ID:</b> ${escapeHtml(p.transactionId)} • <b>Date:</b> ${new Date(p.createdAt).toLocaleString('en-GB')}
  `;
  showModal(proofViewModal);
}

window.viewPaymentProof = viewPaymentProof;
document.getElementById('closeProofViewBtn')?.addEventListener('click', () => hideModal(proofViewModal));

// ----------------------------------------------------
// MAIL & NOTIFICATIONS HUB
// ----------------------------------------------------

openMailHubTopBtn?.addEventListener('click', () => showView('mail-hub'));

async function renderMailHub() {
  const settings = await api(API_BASE + 'api/email-settings');
  if (settings) {
    document.getElementById('hubEmailService').value = settings.service || 'gmail';
    document.getElementById('hubEmailUser').value = settings.user || '';
    document.getElementById('hubEmailFrom').value = settings.from || '';
    if (document.getElementById('hubSmtpHost')) document.getElementById('hubSmtpHost').value = settings.host || 'smtp.gmail.com';
    if (document.getElementById('hubSmtpPort')) document.getElementById('hubSmtpPort').value = settings.port || 465;

    // Highlight active provider card
    document.querySelectorAll('.provider-card').forEach(c => c.style.borderColor = 'var(--card-shadow)');
    if (settings.mode === 'ethereal') {
      document.getElementById('providerEtherealCard').style.borderColor = 'var(--brass)';
      document.getElementById('etherealStatus').innerHTML = `Active Inbox: <b>${escapeHtml(settings.user)}</b>`;
    } else if (settings.service === 'gmail') {
      document.getElementById('providerGmailCard').style.borderColor = 'var(--brass)';
    } else {
      document.getElementById('providerCustomCard').style.borderColor = 'var(--brass)';
    }
  }

  populateComposerStudents();
  renderEmailLogs();
}

function populateComposerStudents() {
  const sel = document.getElementById('hubComposerStudentSel');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choose registered student --</option>' + students.map(s => 
    `<option value="${escapeHtml(s.email)}">${escapeHtml(s.name)} (${escapeHtml(s.email)})</option>`
  ).join('');

  sel.addEventListener('change', () => {
    if (sel.value) document.getElementById('hubComposerEmail').value = sel.value;
  });
}

// 1. Generate 1-Click Instant Test Inbox
document.getElementById('btnCreateEtherealInbox')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnCreateEtherealInbox');
  btn.disabled = true;
  btn.textContent = '⏳ Creating Live Test Inbox…';

  try {
    const res = await api(API_BASE + 'api/create-test-inbox', { method: 'POST' });
    if (res && res.success) {
      alert(`🎉 1-Click Instant Test Inbox Created!\n\nUser: ${res.account.user}\n\nAll outgoing emails (2-day alerts, overdue notices, payment receipts) will now generate live browser preview links in the logs below!`);
      await renderMailHub();
    } else {
      alert('Failed: ' + (res?.message || 'Error'));
    }
  } catch (e) {
    alert('Error connecting to backend.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Instant Test Inbox';
  }
});

// 2. Quick Preset Selection Cards
document.getElementById('btnSelectGmailMode')?.addEventListener('click', () => {
  document.getElementById('hubEmailService').value = 'gmail';
  document.getElementById('hubCustomFields').style.display = 'none';
  document.getElementById('hubEmailUser').placeholder = 'yourlibrary@gmail.com';
  document.getElementById('hubEmailUser').focus();
});

document.getElementById('btnSelectCustomMode')?.addEventListener('click', () => {
  document.getElementById('hubEmailService').value = 'custom';
  document.getElementById('hubCustomFields').style.display = 'block';
  document.getElementById('hubSmtpHost').focus();
});

document.getElementById('hubEmailService')?.addEventListener('change', (e) => {
  document.getElementById('hubCustomFields').style.display = (e.target.value === 'custom' || e.target.value === 'outlook' || e.target.value === 'yahoo') ? 'block' : 'none';
  if (e.target.value === 'outlook') {
    document.getElementById('hubSmtpHost').value = 'smtp.office365.com';
    document.getElementById('hubSmtpPort').value = 587;
  } else if (e.target.value === 'yahoo') {
    document.getElementById('hubSmtpHost').value = 'smtp.mail.yahoo.com';
    document.getElementById('hubSmtpPort').value = 465;
  }
});

// 3. Save Hub Settings
document.getElementById('btnSaveHubSettings')?.addEventListener('click', async () => {
  const service = document.getElementById('hubEmailService').value;
  const user = document.getElementById('hubEmailUser').value.trim();
  const pass = document.getElementById('hubEmailPass').value.trim();
  const from = document.getElementById('hubEmailFrom').value.trim();
  const host = document.getElementById('hubSmtpHost')?.value.trim() || 'smtp.gmail.com';
  const port = document.getElementById('hubSmtpPort')?.value || 465;

  const result = await api(API_BASE + 'api/email-settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ service, user, pass, from, host, port, mode: service })
  });

  if (result && result.success) {
    alert('✅ Email settings saved successfully!');
    await renderMailHub();
  } else {
    alert('Failed to save settings: ' + (result?.message || 'Error'));
  }
});

// 4. Live Test Email Dispatch
document.getElementById('btnHubSendTest')?.addEventListener('click', async () => {
  const to = document.getElementById('hubTestEmailInput').value.trim();
  const statusEl = document.getElementById('hubTestEmailStatus');
  if (!to) {
    statusEl.innerHTML = '<span style="color:var(--overdue);">Please enter an email address.</span>';
    return;
  }

  statusEl.innerHTML = '<span style="color:#555;">⏳ Sending test email…</span>';
  const result = await api(API_BASE + 'api/test-email', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ to })
  });

  if (result && result.success) {
    const previewBtn = result.detail?.previewUrl
      ? `<br><a href="${result.detail.previewUrl}" target="_blank" class="action-btn pay-btn" style="margin-top:6px; display:inline-block;">🔗 Open Live Email Web Preview</a>`
      : '';
    statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✅ ${result.message}</span>${previewBtn}`;
    await refreshAllData();
    renderEmailLogs();
  } else {
    statusEl.innerHTML = `<span style="color:var(--overdue); font-weight:600;">❌ ${result?.message || 'Delivery failed'}</span>`;
  }
});

// 5. Send Direct Custom Email
document.getElementById('btnHubSendCustomEmail')?.addEventListener('click', async () => {
  const to = document.getElementById('hubComposerEmail').value.trim();
  const subject = document.getElementById('hubComposerSubject').value.trim();
  const message = document.getElementById('hubComposerMessage').value.trim();

  if (!to || !subject || !message) {
    alert('Please fill out student email, subject, and message content.');
    return;
  }

  const btn = document.getElementById('btnHubSendCustomEmail');
  btn.disabled = true;
  btn.textContent = '⏳ Dispatching Email…';

  try {
    const result = await api(API_BASE + 'api/send-custom-email', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ to, subject, message, heading: 'Notice from Circulation Desk' })
    });

    if (result && result.success) {
      alert(`✅ Custom email successfully dispatched to ${to}!`);
      document.getElementById('hubComposerSubject').value = '';
      document.getElementById('hubComposerMessage').value = '';
      await refreshAllData();
      renderEmailLogs();
    } else {
      alert('Failed: ' + (result?.message || 'Check SMTP configuration'));
    }
  } catch (e) {
    alert('Error connecting to backend.');
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 Send Email to Student';
  }
});

// 6. Sent Email Logs with Clickable Preview Links
function renderEmailLogs() {
  const container = document.getElementById('hubEmailLogsContainer');
  if (!container) return;

  if (!emailLogs || emailLogs.length === 0) {
    container.innerHTML = '<div style="color:#7a7a6e; font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; padding:10px 0;">No emails dispatched yet in this session.</div>';
    return;
  }

  container.innerHTML = `
    <table class="lib-table">
      <thead><tr><th>Time</th><th>Recipient</th><th>Subject</th><th>Status</th><th>Preview / Info</th></tr></thead>
      <tbody>
        ${emailLogs.slice(0, 15).map(log => {
          const statusPill = log.status === 'success'
            ? '<span class="pill paid">✓ Sent</span>'
            : (log.status === 'simulated' ? '<span class="pill pending">Simulated</span>' : '<span class="pill overdue">Failed</span>');
          
          const previewBtn = log.previewUrl
            ? `<a href="${log.previewUrl}" target="_blank" class="action-btn pay-btn" style="font-size:10px; padding:4px 8px;">🔗 View Email Webpage</a>`
            : (log.error ? `<span style="color:var(--overdue); font-size:11px;">${escapeHtml(log.error.slice(0, 40))}…</span>` : '<span style="color:#888; font-size:11px;">Direct SMTP</span>');

          return `
            <tr>
              <td><span style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${new Date(log.timestamp).toLocaleTimeString('en-GB')}</span></td>
              <td><b>${escapeHtml(log.to)}</b></td>
              <td>${escapeHtml(log.subject)}</td>
              <td>${statusPill}</td>
              <td>${previewBtn}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

document.getElementById('btnRefreshEmailLogs')?.addEventListener('click', async () => {
  const logs = await api(API_BASE + 'api/email-logs');
  emailLogs = Array.isArray(logs) ? logs : [];
  renderEmailLogs();
});

// ----------------------------------------------------
// ADMIN DASHBOARD RENDERING
// ----------------------------------------------------

async function renderAdminDashboard() {
  const stats = await api(API_BASE + 'admin-stats');
  document.getElementById('d-total').textContent = books.length;
  document.getElementById('d-students').textContent = students.length;
  document.getElementById('d-issued').textContent = books.filter(b => b.status === 'out').length;
  document.getElementById('d-overdue').textContent = stats?.overdueCount ?? books.filter(isOverdue).length;
  document.getElementById('d-fines').textContent = `₹${stats?.totalOutstanding ?? 0}`;

  // 1. Render 2-Day Return Alert List
  const dueIn2Container = document.getElementById('dueIn2List');
  const dueIn2List = stats?.dueIn2 || [];
  if (dueIn2List.length === 0) {
    dueIn2Container.innerHTML = '<div style="color:#7a7a6e; font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; padding:10px 0;">No books are due in 2 days right now.</div>';
  } else {
    dueIn2Container.innerHTML = dueIn2List.map(item => {
      const statusBadge = item.reminderSent
        ? '<span class="pill alert-sent">✓ Alert Sent</span>'
        : '<span class="pill pending">⏰ 2 Days Left</span>';
      return `
        <div class="mini-row" style="padding:10px 0;">
          <div>
            <span class="t">${escapeHtml(item.title)}</span>
            <div style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:#555; margin-top:2px;">
              Borrower: <b>${escapeHtml(item.studentName)}</b> (${escapeHtml(item.studentEmail)}) • Due: ${fmtDate(item.due)}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${statusBadge}
            <button class="action-btn" onclick="sendIndividualReminder(${item.loanId})">📧 Send Alert</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Overdue Right Now List with ₹10/day fine breakdown
  const overdueContainer = document.getElementById('overdueList');
  const overdueLoans = (stats?.overdueLoans || []).filter(l => l.paymentStatus !== 'paid');
  if (overdueLoans.length === 0) {
    overdueContainer.innerHTML = '<div style="color:#7a7a6e; font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; padding:10px 0;">Great! No books are currently overdue.</div>';
  } else {
    overdueContainer.innerHTML = overdueLoans.map(item => {
      return `
        <div class="mini-row" style="padding:12px 0;">
          <div>
            <span class="t">${escapeHtml(item.title)}</span>
            <div style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:#555; margin-top:2px;">
              Borrower: <b>${escapeHtml(item.studentName)}</b> • Due: ${fmtDate(item.due)} • <span style="color:var(--overdue); font-weight:600;">${item.daysLate} day(s) overdue</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="text-align:right;">
              <div class="fine-badge" style="font-size:15px;">₹${item.fine}</div>
              <div style="font-family:'IBM Plex Mono',monospace; font-size:10px; color:#777;">₹${fineRate}/day</div>
            </div>
            <button class="action-btn pay-btn" onclick="openPaymentModal(${item.loanId}, ${item.studentId}, ${item.fine}, '${escapeHtml(item.title)}')">💳 Settle Fine</button>
            <button class="action-btn" onclick="doReturn(${item.bookId})">Return</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Render Activity List
  document.getElementById('activityList').innerHTML = activityLog.map(a => 
    `<div class="activity-row"><span class="time" style="color:var(--brass-dark); font-weight:600; margin-right:8px;">[${escapeHtml(a.time)}]</span>${escapeHtml(a.text)}</div>`
  ).join('');

  // 4. Render Recent Fine Payments List
  renderPaymentsList();
  renderStudentSearchResults();
}

function renderPaymentsList() {
  const container = document.getElementById('paymentsList');
  if (!container) return;
  if (!paymentRecords || paymentRecords.length === 0) {
    container.innerHTML = '<div style="color:#7a7a6e; font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; padding:10px 0;">No UPI fine payments recorded yet.</div>';
    return;
  }
  container.innerHTML = `
    <table class="lib-table">
      <thead><tr><th>Date</th><th>Student</th><th>Book / Description</th><th>Amount</th><th>UPI Transaction ID</th><th>Proof</th><th>Status</th></tr></thead>
      <tbody>
        ${paymentRecords.slice(0, 10).map(p => {
          const proofBtn = p.screenshot
            ? `<button class="action-btn" onclick="viewPaymentProof(${p.id})">🖼️ View Proof</button>`
            : '<span style="color:#888; font-size:12px;">None</span>';
          return `
            <tr>
              <td>${new Date(p.createdAt || p.date).toLocaleDateString('en-GB')}</td>
              <td><b>${escapeHtml(p.studentName)}</b></td>
              <td>${escapeHtml(p.bookTitle)}</td>
              <td><b style="color:#059669;">₹${p.amount}</b></td>
              <td><span style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${escapeHtml(p.transactionId)}</span></td>
              <td>${proofBtn}</td>
              <td><span class="pill paid">✓ Verified</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ----------------------------------------------------
// STUDENT DASHBOARD & BORROWED BOOKS
// ----------------------------------------------------

async function renderStudentDashboard() {
  if (!currentUser || currentUser.role !== 'student') return;
  document.getElementById('studentWelcome').textContent = 'Welcome back, ' + currentUser.name;

  const result = await api(API_BASE + 'students/' + currentUser.id);
  if (!result || !result.success) return;

  const currentLoans = result.currentLoans || [];
  const history = result.history || [];
  const totalOutstanding = result.outstanding || 0;
  const overdueLoans = currentLoans.filter(l => (l.isOverdue || l.daysRemaining < 0) && l.paymentStatus !== 'paid');
  const dueIn2Loans = currentLoans.filter(l => l.daysRemaining === 2);

  document.getElementById('s-borrowed').textContent = currentLoans.length;
  document.getElementById('s-overdue').textContent = overdueLoans.length;
  document.getElementById('s-fine').textContent = `₹${totalOutstanding}`;
  document.getElementById('s-total').textContent = books.length;

  // 1. Outstanding Fine Alert Banner
  const fineBanner = document.getElementById('studentFineBanner');
  if (totalOutstanding > 0) {
    fineBanner.className = 'fine-alert-banner';
    fineBanner.innerHTML = `
      <div class="fine-msg">
        <div>⚠️ <strong>Outstanding Library Fine: ₹${totalOutstanding}</strong></div>
        <div class="fine-sub">Fines accrue at <b>₹${fineRate}/day</b> for books returned after the due date. Please pay via UPI QR code.</div>
      </div>
      <button class="action-btn pay-btn" style="padding:10px 18px; font-size:12px;" onclick="openStudentGeneralPayment(${totalOutstanding})">💳 Pay Fine via UPI QR (₹${totalOutstanding})</button>
    `;
  } else {
    fineBanner.className = 'hidden';
    fineBanner.innerHTML = '';
  }

  // 2. 2-Day Return Reminder Banner
  const due2Banner = document.getElementById('studentDue2Banner');
  if (dueIn2Loans.length > 0) {
    due2Banner.className = 'reminder-alert-banner';
    due2Banner.innerHTML = `
      <div class="msg">
        ⏰ <b>Reminder:</b> You have <b>${dueIn2Loans.length} book(s)</b> due in <b>2 days</b> ("${escapeHtml(dueIn2Loans[0].title)}"). Return on time to avoid a ₹${fineRate}/day late fine!
      </div>
    `;
  } else {
    due2Banner.className = 'hidden';
    due2Banner.innerHTML = '';
  }

  // 3. My Borrowed Books List
  const myBooksContainer = document.getElementById('myBooksList');
  if (currentLoans.length === 0) {
    myBooksContainer.innerHTML = '<div style="color:#7a7a6e; font-family:\'IBM Plex Mono\',monospace; font-size:13px; padding:16px 0;">You have no books currently checked out. Visit the Catalog to explore available titles.</div>';
  } else {
    myBooksContainer.innerHTML = currentLoans.map(loan => {
      const isLate = loan.daysRemaining < 0;
      const isPaid = loan.paymentStatus === 'paid';
      const overdueDays = isLate ? Math.abs(loan.daysRemaining) : 0;
      const accruedFine = (isLate && !isPaid) ? (overdueDays * fineRate) : (loan.fineAmount || 0);
      
      const statusPill = isPaid
        ? '<span class="pill paid">✓ Fine Paid</span>'
        : (isLate
            ? `<span class="pill overdue">⚠️ ${overdueDays}d Overdue</span>`
            : (loan.daysRemaining <= 2
                ? `<span class="pill pending">⏰ Due in ${loan.daysRemaining} days</span>`
                : `<span class="pill avail">Due in ${loan.daysRemaining} days</span>`));

      const fineSection = (isLate && !isPaid)
        ? `
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="text-align:right;">
              <div class="fine-badge" style="font-size:14px;">Fine: ₹${accruedFine}</div>
              <div style="font-family:'IBM Plex Mono',monospace; font-size:10px; color:#777;">(₹${fineRate}/day)</div>
            </div>
            <button class="action-btn pay-btn" onclick="openPaymentModal(${loan.id}, ${currentUser.id}, ${accruedFine}, '${escapeHtml(loan.title)}')">💳 Pay Fine</button>
          </div>
        `
        : '';

      return `
        <div class="mini-row" style="padding:14px 0;">
          <div>
            <div class="t" style="font-size:16px;">${escapeHtml(loan.title)}</div>
            <div style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:#555; margin-top:4px;">
              Issued: ${fmtDate(loan.issued)} • <b>Due Back: ${fmtDate(loan.due)}</b>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            ${statusPill}
            ${fineSection}
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Student Borrowing & Payment History
  const historyTbody = document.getElementById('studentHistoryBody');
  if (history.length === 0) {
    historyTbody.innerHTML = '<tr><td colspan="8" class="empty">No borrowing history yet.</td></tr>';
  } else {
    historyTbody.innerHTML = history.map(item => {
      const isPaid = item.paymentStatus === 'paid' || item.fineAmount === 0;
      const statusPill = isPaid
        ? '<span class="pill paid">Paid / Cleared</span>'
        : '<span class="pill overdue">Fine Pending</span>';
      
      const payAction = (!isPaid && item.fineAmount > 0)
        ? `<button class="action-btn pay-btn" onclick="openPaymentModal(${item.id}, ${currentUser.id}, ${item.fineAmount}, '${escapeHtml(item.title)}')">💳 Pay ₹${item.fineAmount}</button>`
        : '<span style="color:#059669; font-size:12px; font-weight:600;">✓ Settled</span>';

      return `
        <tr>
          <td><b>${escapeHtml(item.title)}</b></td>
          <td>${fmtDate(item.issued)}</td>
          <td>${fmtDate(item.due)}</td>
          <td>${fmtDate(item.returned)}</td>
          <td>${item.lateDays > 0 ? `<span style="color:var(--overdue); font-weight:600;">${item.lateDays}d late</span>` : 'On time'}</td>
          <td><b>₹${item.fineAmount || 0}</b></td>
          <td>${statusPill}</td>
          <td>${payAction}</td>
        </tr>
      `;
    }).join('');
  }
}

// ----------------------------------------------------
// 2-DAY REMINDERS & EMAIL ALERT ACTIONS
// ----------------------------------------------------

async function triggerAllReminders() {
  triggerRemindersBtn.disabled = true;
  triggerRemindersBtn.textContent = '⏳ Sending Reminders…';
  try {
    const res = await api(API_BASE + 'send-reminders', { method: 'POST' });
    if (res && res.success) {
      alert(`✅ Reminder Pass Complete!\n${res.message}`);
      await refreshAllData();
      renderAdminDashboard();
    } else {
      alert('Reminder pass failed: ' + (res?.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Error connecting to backend.');
  } finally {
    triggerRemindersBtn.disabled = false;
    triggerRemindersBtn.textContent = '🚀 Send 2-Day Alerts to All';
  }
}

async function sendIndividualReminder(loanId) {
  const result = await api(API_BASE + 'send-reminder', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ loanId })
  });
  if (result && result.success) {
    alert('✅ ' + result.message);
    await refreshAllData();
    renderAdminDashboard();
  } else {
    alert('❌ Failed to dispatch email: ' + (result?.message || 'Check SMTP settings.'));
  }
}

window.sendIndividualReminder = sendIndividualReminder;

// ----------------------------------------------------
// ADMIN UPI QR CONFIGURATION MODAL
// ----------------------------------------------------

openPaymentSettingsBtn?.addEventListener('click', () => {
  document.getElementById('cfgUpiId').value = paymentConfig.upiId || '';
  document.getElementById('cfgPayeeName').value = paymentConfig.payeeName || '';
  const prev = document.getElementById('cfgQrPreview');
  if (paymentConfig.qrCodeImage) {
    prev.src = paymentConfig.qrCodeImage;
    prev.classList.remove('hidden');
  } else {
    prev.classList.add('hidden');
  }
  showModal(paymentSettingsModal);
});

document.getElementById('cfgQrImageFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const preview = document.getElementById('cfgQrPreview');
    preview.src = evt.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

document.getElementById('savePaymentSettingsBtn')?.addEventListener('click', async () => {
  const upiId = document.getElementById('cfgUpiId').value.trim();
  const payeeName = document.getElementById('cfgPayeeName').value.trim();
  const qrPreview = document.getElementById('cfgQrPreview');
  const qrCodeImage = (!qrPreview.classList.contains('hidden') && qrPreview.src) ? qrPreview.src : null;

  const result = await api(API_BASE + 'api/payment-config', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ upiId, payeeName, qrCodeImage })
  });

  if (result && result.success) {
    paymentConfig = result.paymentConfig;
    alert('✅ UPI & QR Settings saved!');
    hideModal(paymentSettingsModal);
  } else {
    alert('Failed to save settings.');
  }
});

document.getElementById('closePaymentSettingsBtn')?.addEventListener('click', () => hideModal(paymentSettingsModal));

// ----------------------------------------------------
// CATALOG, ISSUE & RETURN
// ----------------------------------------------------

function populateGenres() {
  const genres = [...new Set(books.map(b => b.genre))].sort();
  const sel = document.getElementById('genreFilter');
  if (sel) {
    sel.innerHTML = '<option value="">All genres</option>' + genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
  }
}

function renderCatalog() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const genre = document.getElementById('genreFilter').value;
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');

  const filtered = books.filter(b => {
    const matchesSearch = !search || b.title.toLowerCase().includes(search) || b.author.toLowerCase().includes(search) || b.call.toLowerCase().includes(search);
    const matchesGenre = !genre || b.genre === genre;
    return matchesSearch && matchesGenre;
  });

  grid.innerHTML = '';
  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  filtered.forEach(b => grid.appendChild(renderCard(b)));
}

function renderCard(book) {
  const card = document.createElement('div');
  card.className = 'card';
  const overdue = isOverdue(book);
  const statusClass = book.status === 'available' ? 'avail' : (overdue ? 'overdue' : 'out');
  const statusLabel = book.status === 'available' ? 'On shelf' : (overdue ? `Overdue (${daysOverdue(book)}d)` : 'Checked out');
  const dueNote = book.status === 'out' ? `<div class="due-note">${overdue ? 'was due' : 'due back'} ${fmtDate(book.due)} · ${escapeHtml(studentName(book.studentId))}</div>` : '';
  const actions = currentUser?.role === 'admin'
    ? `<div class="card-actions">${book.status === 'available' ? `<button class="action-btn" data-action="goissue" data-id="${book.id}">Issue</button>` : `<button class="action-btn" data-action="return" data-id="${book.id}">Return</button>`}<button class="action-btn danger" data-action="remove" data-id="${book.id}">Remove</button></div>`
    : '';

  card.innerHTML = `<div class="card-inner"><div class="call-number">${escapeHtml(book.call)}</div><div class="card-title">${escapeHtml(book.title)}</div><div class="card-author">${escapeHtml(book.author)}</div><div class="card-genre">${escapeHtml(book.genre)}</div><div class="status-row"><span class="status-dot"><span class="dot ${statusClass}"></span><span class="status-text ${statusClass}">${statusLabel}</span></span></div>${dueNote}${actions}</div>`;
  return card;
}

document.getElementById('grid')?.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);
  if (action === 'goissue') {
    showView('issue');
    document.getElementById('issueBook').value = id;
    updateIssueSummary();
  }
  if (action === 'return') {
    await doReturn(id);
    await refreshAllData();
    renderCatalog();
  }
  if (action === 'remove') {
    await deleteBook(id);
    await refreshAllData();
    renderCatalog();
  }
});

function renderIssueForm(preselectStudentId = null) {
  const studentSel = document.getElementById('issueStudent');
  studentSel.innerHTML = students.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.email)})</option>`).join('');
  if (preselectStudentId) studentSel.value = preselectStudentId;

  const bookSel = document.getElementById('issueBook');
  const search = document.getElementById('issueBookSearch')?.value.trim().toLowerCase() || '';
  let availableBooks = books.filter(b => b.status === 'available');
  if (search) {
    availableBooks = availableBooks.filter(b =>
      b.title.toLowerCase().includes(search) || b.author.toLowerCase().includes(search) || String(b.id).includes(search)
    );
  }
  bookSel.innerHTML = availableBooks.length
    ? availableBooks.map(b => `<option value="${b.id}">${escapeHtml(b.title)} — ${escapeHtml(b.author)} (ID:${b.id})</option>`).join('')
    : '<option value="">No titles currently available</option>';
  document.getElementById('issueConfirmBtn').disabled = availableBooks.length === 0;
  updateIssueSummary();
}

[document.getElementById('issueStudent'), document.getElementById('issueBook'), document.getElementById('issueDays')].forEach(el => el?.addEventListener('change', updateIssueSummary));

function updateIssueSummary() {
  const box = document.getElementById('issueSummary');
  const studentId = Number(document.getElementById('issueStudent').value);
  const bookId = Number(document.getElementById('issueBook').value);
  const days = Number(document.getElementById('issueDays').value);
  const student = students.find(s => s.id === studentId);
  const book = books.find(b => b.id === bookId);
  if (!student || !book) {
    box.classList.remove('show');
    return;
  }
  box.classList.add('show');
  box.innerHTML = `${escapeHtml(student.name)} will borrow <b>${escapeHtml(book.title)}</b><br>Due back: ${fmtDate(daysFromNow(days))} (${days} days) • Overdue rate: ₹${fineRate}/day`;
}

document.getElementById('issueConfirmBtn')?.addEventListener('click', async () => {
  const studentId = Number(document.getElementById('issueStudent').value);
  const bookId = Number(document.getElementById('issueBook').value);
  const days = Number(document.getElementById('issueDays').value);
  const result = await api(API_BASE + 'issue', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ studentId, bookId, days })
  });
  if (result && result.success) {
    playStamp('ISSUED');
    await refreshAllData();
    showView('admin-dashboard');
  }
});

async function doReturn(bookId) {
  const result = await api(API_BASE + 'return', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ bookId })
  });
  if (result && result.success) {
    playStamp('RETURNED');
    if (result.fineAmount > 0) {
      const book = books.find(b => b.id === bookId);
      const payNow = confirm(`⚠️ Overdue Fine Assessed: ₹${result.fineAmount} (calculated at ₹${fineRate}/day).\n\nWould you like to open the UPI QR Payment Modal to settle this fine now?`);
      if (payNow) {
        openPaymentModal(result.loanId, null, result.fineAmount, book ? book.title : 'Returned Book Fine');
      }
    }
    await refreshAllData();
    renderReturnTable();
  }
}

window.doReturn = doReturn;

async function deleteBook(bookId) {
  if (!confirm('Remove this book from catalog?')) return;
  const result = await api(API_BASE + 'books/' + bookId, { method: 'DELETE' });
  if (result && result.success) {
    await refreshAllData();
  }
}

function renderReturnTable() {
  const issuedBooks = books.filter(b => b.status === 'out');
  const tbody = document.getElementById('returnTableBody');
  const empty = document.getElementById('returnEmpty');
  if (!issuedBooks.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = issuedBooks.map(b => {
    const overdue = isOverdue(b);
    const daysLate = daysOverdue(b);
    const currentFine = daysLate * fineRate;
    const pillClass = overdue ? 'overdue' : 'out';
    const pillLabel = overdue ? `${daysLate}d overdue` : 'On loan';

    return `
      <tr>
        <td><b>${escapeHtml(b.title)}</b></td>
        <td>${escapeHtml(studentName(b.studentId))}</td>
        <td>${fmtDate(b.issued)}</td>
        <td>${fmtDate(b.due)}</td>
        <td>${daysLate > 0 ? `<b style="color:var(--overdue);">${daysLate} days</b>` : 'On time'}</td>
        <td><b class="${currentFine > 0 ? 'fine-badge' : ''}">₹${currentFine}</b></td>
        <td><span class="pill ${pillClass}">${pillLabel}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="action-btn" onclick="doReturn(${b.id})">Return</button>
            ${currentFine > 0 ? `<button class="action-btn pay-btn" onclick="openPaymentModal(null, ${b.studentId}, ${currentFine}, '${escapeHtml(b.title)}')">💳 Pay Fine</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ----------------------------------------------------
// STUDENTS MANAGEMENT
// ----------------------------------------------------

function renderStudentsTable(filteredStudents = null) {
  const list = filteredStudents || students;
  const tbody = document.getElementById('studentsTableBody');
  tbody.innerHTML = list.map(s => {
    const count = books.filter(b => b.status === 'out' && b.studentId === s.id).length;
    return `
      <tr>
        <td>
          <b>${escapeHtml(s.name)}</b>
          <div style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:#555;">${escapeHtml(s.email)} • ID: ${s.id}</div>
        </td>
        <td>${escapeHtml(s.username)}</td>
        <td><b>${count}</b> title(s)</td>
        <td><span class="fine-badge" id="student_fine_${s.id}">...</span></td>
        <td><button class="action-btn" onclick="loadStudentProfile(${s.id})">View Account</button></td>
      </tr>
    `;
  }).join('');

  if (studentCount) studentCount.textContent = `Showing ${list.length} student${list.length === 1 ? '' : 's'}`;

  // Fetch individual student fines
  list.forEach(async (s) => {
    const res = await api(API_BASE + 'students/' + s.id);
    const el = document.getElementById(`student_fine_${s.id}`);
    if (el && res) {
      el.textContent = `₹${res.outstanding || 0}`;
    }
  });
}

function filterStudentsTable() {
  const query = (studentListSearchInput?.value || '').trim().toLowerCase();
  if (!query) {
    renderStudentsTable();
    return;
  }
  const filtered = students.filter(s =>
    [s.name, s.username, s.email, String(s.id)].some(f => f.toLowerCase().includes(query))
  );
  renderStudentsTable(filtered);
}

async function loadStudentProfile(studentId) {
  const result = await api(API_BASE + 'students/' + studentId);
  if (!result?.success) {
    alert('Unable to load student profile.');
    return;
  }
  currentProfileId = studentId;
  const s = result.student;
  profileName.textContent = s.name;
  profileId.textContent = s.id;
  profileEmail.textContent = s.email;
  profileOutstanding.textContent = `₹${result.outstanding || 0}`;

  profileCurrentBody.innerHTML = result.currentLoans.length
    ? result.currentLoans.map(loan => {
        const isLate = loan.daysRemaining < 0;
        return `
          <tr>
            <td><b>${escapeHtml(loan.title)}</b></td>
            <td>${fmtDate(loan.issued)}</td>
            <td>${fmtDate(loan.due)}</td>
            <td>${isLate ? `<span style="color:var(--overdue); font-weight:600;">${Math.abs(loan.daysRemaining)}d overdue</span>` : `${loan.daysRemaining}d left`}</td>
            <td><b class="${loan.fineAmount > 0 ? 'fine-badge' : ''}">₹${loan.fineAmount}</b></td>
            <td>${loan.fineAmount > 0 ? `<button class="action-btn pay-btn" onclick="openPaymentModal(${loan.id}, ${s.id}, ${loan.fineAmount}, '${escapeHtml(loan.title)}')">💳 Pay</button>` : ''}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="6" class="empty">No active loans.</td></tr>';

  profileHistoryBody.innerHTML = result.history.length
    ? result.history.map(loan => {
        const isPaid = loan.paymentStatus === 'paid';
        return `
          <tr>
            <td><b>${escapeHtml(loan.title)}</b></td>
            <td>${fmtDate(loan.returned)}</td>
            <td>${loan.lateDays > 0 ? `${loan.lateDays}d late` : 'On time'}</td>
            <td>₹${loan.fineAmount}</td>
            <td><span class="pill ${isPaid ? 'paid' : 'overdue'}">${isPaid ? 'Paid' : 'Pending'}</span></td>
            <td>${(!isPaid && loan.fineAmount > 0) ? `<button class="action-btn pay-btn" onclick="openPaymentModal(${loan.id}, ${s.id}, ${loan.fineAmount}, '${escapeHtml(loan.title)}')">💳 Pay</button>` : ''}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="6" class="empty">No borrowing history yet.</td></tr>';

  showView('student-profile');
}

window.loadStudentProfile = loadStudentProfile;

profileBackBtn?.addEventListener('click', () => showView('students'));
profileIssueBtn?.addEventListener('click', () => {
  renderIssueForm(currentProfileId);
  showView('issue');
});
profilePayFineBtn?.addEventListener('click', async () => {
  if (!currentProfileId) return;
  const res = await api(API_BASE + 'students/' + currentProfileId);
  if (res && res.outstanding > 0) {
    openPaymentModal(null, currentProfileId, res.outstanding, 'Student Fine Clearance');
  } else {
    alert('This student has no outstanding fines.');
  }
});

// Search in Admin
function renderStudentSearchResults() {
  if (!studentSearchInput) return;
  const term = studentSearchInput.value.trim().toLowerCase();
  if (!term) {
    studentSearchResults.innerHTML = '<div class="empty" style="padding:0; margin:0;">Type name, student ID, or email to find a borrower.</div>';
    return;
  }
  const results = students.filter(s =>
    s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || String(s.id).includes(term)
  );
  studentSearchResults.innerHTML = results.length
    ? results.map(s => `<button class="student-result-btn" style="padding:8px 12px; font-family:'IBM Plex Mono',monospace; width:100%; text-align:left; cursor:pointer; margin-bottom:4px;" onclick="loadStudentProfile(${s.id})">🔍 ${escapeHtml(s.name)} · ${escapeHtml(s.email)} · ID: ${s.id}</button>`).join('')
    : '<div class="empty" style="padding:0; margin:0;">No student found.</div>';
}

studentSearchInput?.addEventListener('input', renderStudentSearchResults);
studentListSearchInput?.addEventListener('input', filterStudentsTable);

// ----------------------------------------------------
// ADD BOOK & REGISTER STUDENT
// ----------------------------------------------------

addBookBtn?.addEventListener('click', () => {
  document.getElementById('fTitle').value = '';
  document.getElementById('fAuthor').value = '';
  document.getElementById('fGenre').value = '';
  const assignSel = document.getElementById('assignStudentSelect');
  if (assignSel) assignSel.innerHTML = students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  showModal(addModal);
});

document.getElementById('cancelAdd')?.addEventListener('click', () => hideModal(addModal));
document.getElementById('confirmAdd')?.addEventListener('click', async () => {
  const title = document.getElementById('fTitle').value.trim();
  const author = document.getElementById('fAuthor').value.trim();
  const genre = document.getElementById('fGenre').value.trim() || 'General';
  if (!title || !author) {
    alert('Enter title and author.');
    return;
  }
  const res = await api(API_BASE + 'books', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ title, author, genre })
  });
  if (res && res.success) {
    hideModal(addModal);
    await refreshAllData();
    renderCatalog();
  }
});

function showSignupModal() {
  setRole('student');
  document.getElementById('sName').value = '';
  document.getElementById('sUsername').value = '';
  document.getElementById('sPassword').value = '';
  document.getElementById('sEmail').value = '';
  showModal(addStudentModal);
}
window.showSignupModal = showSignupModal;

document.getElementById('addStudentBtn')?.addEventListener('click', () => {
  document.getElementById('sName').value = '';
  document.getElementById('sUsername').value = '';
  document.getElementById('sPassword').value = '';
  document.getElementById('sEmail').value = '';
  showModal(addStudentModal);
});

document.getElementById('cancelAddStudent')?.addEventListener('click', () => hideModal(addStudentModal));
document.getElementById('confirmAddStudent')?.addEventListener('click', async () => {
  const name = document.getElementById('sName').value.trim();
  const username = document.getElementById('sUsername').value.trim();
  const password = document.getElementById('sPassword').value.trim();
  const email = document.getElementById('sEmail').value.trim();
  if (!name || !username || !password || !email) {
    alert('Please complete all fields.');
    return;
  }
  const res = await api(API_BASE + 'students', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name, username, password, email })
  });
  if (res && res.success) {
    hideModal(addStudentModal);
    await refreshAllData();
    alert('Student registered successfully!');
    if (!currentUser) {
      loginUser.value = email;
      loginPass.value = password;
      await login();
    } else {
      renderStudentsTable();
    }
  } else {
    alert(res?.message || 'Registration failed.');
  }
});

// Fine Rate Save
saveFineRateBtn?.addEventListener('click', async () => {
  const val = Number(fineRateInput.value);
  if (Number.isNaN(val) || val < 0) {
    alert('Enter a valid non-negative fine rate.');
    return;
  }
  const result = await api(API_BASE + 'fine-rate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ fineRate: val })
  });
  if (result?.success) {
    fineRate = val;
    alert(`Fine rate set to ₹${fineRate}/day`);
    await refreshAllData();
    renderAdminDashboard();
  }
});

// Event Listeners
document.getElementById('loginBtn')?.addEventListener('click', login);
loginRoleBtn?.addEventListener('click', () => setRole('admin'));
studentRoleBtn?.addEventListener('click', () => setRole('student'));
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  stopPaymentCamera();
  currentUser = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
  loginUser.value = '';
  loginPass.value = '';
});

triggerRemindersBtn?.addEventListener('click', triggerAllReminders);
refreshPaymentsBtn?.addEventListener('click', async () => {
  await refreshAllData();
  renderPaymentsList();
});

document.getElementById('searchInput')?.addEventListener('input', renderCatalog);
document.getElementById('genreFilter')?.addEventListener('change', renderCatalog);
document.querySelectorAll('.quick-btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.goto)));

window.addEventListener('DOMContentLoaded', () => {
  setRole('admin');
});
