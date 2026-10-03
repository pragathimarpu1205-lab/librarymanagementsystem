const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { readableBooks, generateBookContent } = require('./booksData');

const app = express();
app.use(cors());
// Support JSON & URL-encoded bodies up to 25MB for QR code and screenshot uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Simple request logger
app.use((req, res, next) => {
  console.log('[REQ]', req.method, req.url);
  next();
});

// Serve static client assets
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use(express.static(path.join(__dirname, '..', 'client-old')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

const admin = { username: 'admin', password: 'admin123', name: 'Ms. Okafor' };
let fineRate = 10; // Default ₹10 / day late fine

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

let students = [
  { id: 1, name: 'Aisha Khan', username: 'student', password: 'student123', email: 'aisha@gmail.com', phone: '+91 98765 43210' },
  { id: 2, name: 'Diego Ramirez', username: 'diego', password: 'student123', email: 'diego@gmail.com', phone: '+91 98765 43211' },
  { id: 3, name: 'Wei Chen', username: 'wei', password: 'student123', email: 'wei@gmail.com', phone: '+91 98765 43212' }
];

// Initialize books with full readable chapter content
let books = readableBooks.map(b => {
  const cloned = JSON.parse(JSON.stringify(b));
  if (cloned.id === 4) {
    cloned.status = 'out';
    cloned.studentId = 2;
    cloned.issued = daysFromNow(-17);
    cloned.due = daysFromNow(-3);
  } else if (cloned.id === 5) {
    cloned.status = 'out';
    cloned.studentId = 1;
    cloned.issued = daysFromNow(-12);
    cloned.due = daysFromNow(2);
  } else if (cloned.id === 7) {
    cloned.status = 'out';
    cloned.studentId = 3;
    cloned.issued = daysFromNow(-15);
    cloned.due = daysFromNow(-1);
  }
  return cloned;
});

let nextStudentId = 4;
let nextBookId = 11;
let nextLoanId = 4;
let nextPaymentId = 1;
let nextSmsId = 1;

let activityLog = [
  { time: 'Now', text: 'System ready. ₹10/day fine system, 2-day alerts, SMS dispatch & Real Book Flip Reader active.' }
];

let loanRecords = [
  {
    id: 1,
    bookId: 4,
    studentId: 2,
    title: 'The Brothers Karamazov',
    issued: daysFromNow(-17),
    due: daysFromNow(-3),
    returned: null,
    fineAmount: 30,
    paymentStatus: 'pending',
    fineRateAtLoan: fineRate,
    issuedTime: '10:30 AM',
    issuedDate: new Date(daysFromNow(-17)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    reminders: { twoDays: true, threeDays: false, oneDay: false, due: false, overdue: true }
  },
  {
    id: 2,
    bookId: 5,
    studentId: 1,
    title: 'Piranesi',
    issued: daysFromNow(-12),
    due: daysFromNow(2),
    returned: null,
    fineAmount: null,
    paymentStatus: 'pending',
    fineRateAtLoan: fineRate,
    issuedTime: '02:15 PM',
    issuedDate: new Date(daysFromNow(-12)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    reminders: { twoDays: false, threeDays: false, oneDay: false, due: false, overdue: false }
  },
  {
    id: 3,
    bookId: 7,
    studentId: 3,
    title: 'The Overstory',
    issued: daysFromNow(-15),
    due: daysFromNow(-1),
    returned: null,
    fineAmount: 10,
    paymentStatus: 'pending',
    fineRateAtLoan: fineRate,
    issuedTime: '11:45 AM',
    issuedDate: new Date(daysFromNow(-15)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    reminders: { twoDays: true, threeDays: false, oneDay: false, due: false, overdue: true }
  }
];

let paymentRecords = [];
let emailLogs = [];
let smsLogs = [
  {
    id: nextSmsId++,
    type: 'issue_alert',
    to: '+91 98765 43211',
    studentName: 'Diego Ramirez',
    bookTitle: 'The Brothers Karamazov',
    issuedDate: new Date(daysFromNow(-17)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    issuedTime: '10:30 AM',
    dueDate: new Date(daysFromNow(-3)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    message: '📚 The Reading Room Library Alert: Hello Diego Ramirez, you have borrowed "The Brothers Karamazov" on ' + new Date(daysFromNow(-17)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' at 10:30 AM. Due Date: ' + new Date(daysFromNow(-3)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '. Late fine: ₹10/day.',
    status: 'delivered',
    timestamp: daysFromNow(-17)
  },
  {
    id: nextSmsId++,
    type: 'issue_alert',
    to: '+91 98765 43210',
    studentName: 'Aisha Khan',
    bookTitle: 'Piranesi',
    issuedDate: new Date(daysFromNow(-12)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    issuedTime: '02:15 PM',
    dueDate: new Date(daysFromNow(2)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    message: '📚 The Reading Room Library Alert: Hello Aisha Khan, you have borrowed "Piranesi" on ' + new Date(daysFromNow(-12)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' at 02:15 PM. Due Date: ' + new Date(daysFromNow(2)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '. Late fine: ₹10/day.',
    status: 'delivered',
    timestamp: daysFromNow(-12)
  }
];

function dispatchSmsNotification({ type, to, studentName, bookTitle, message, metadata = {} }) {
  const logEntry = {
    id: nextSmsId++,
    type: type || 'issue_alert',
    to: to || '+91 98765 43210',
    studentName: studentName || 'Student',
    bookTitle: bookTitle || 'Library Title',
    message,
    status: 'delivered',
    timestamp: new Date().toISOString(),
    ...metadata
  };
  smsLogs.unshift(logEntry);
  if (smsLogs.length > 200) smsLogs.pop();
  console.log('[SMS DISPATCHED]', logEntry.to, ':', logEntry.message);
  saveData();
  return logEntry;
}

// UPI and Payment Configuration
let paymentConfig = {
  upiId: 'librarypay@upi',
  payeeName: 'The Reading Room Library',
  qrCodeImage: null, // Base64 or URL if uploaded
  instructions: 'Scan the QR code with any UPI app (Google Pay, PhonePe, Paytm, etc.) to pay your fine of ₹10/day, then submit your transaction reference or screenshot.'
};

// Data Persistence File (persists students, books, loan records, etc.)
const DATA_FILE = path.join(__dirname, 'data.json');

function saveData() {
  try {
    const data = {
      fineRate,
      nextStudentId,
      nextBookId,
      nextLoanId,
      nextPaymentId,
      nextSmsId,
      students,
      books,
      loanRecords,
      paymentRecords,
      activityLog,
      emailLogs,
      smsLogs,
      paymentConfig
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data.json:', err);
  }
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (typeof data.fineRate === 'number') fineRate = data.fineRate;
      if (typeof data.nextStudentId === 'number') nextStudentId = data.nextStudentId;
      if (typeof data.nextBookId === 'number') nextBookId = data.nextBookId;
      if (typeof data.nextLoanId === 'number') nextLoanId = data.nextLoanId;
      if (typeof data.nextPaymentId === 'number') nextPaymentId = data.nextPaymentId;
      if (typeof data.nextSmsId === 'number') nextSmsId = data.nextSmsId;
      if (Array.isArray(data.students)) students = data.students;
      if (Array.isArray(data.books)) books = data.books;
      if (Array.isArray(data.loanRecords)) loanRecords = data.loanRecords;
      if (Array.isArray(data.paymentRecords)) paymentRecords = data.paymentRecords;
      if (Array.isArray(data.activityLog)) activityLog = data.activityLog;
      if (Array.isArray(data.emailLogs)) emailLogs = data.emailLogs;
      if (Array.isArray(data.smsLogs)) smsLogs = data.smsLogs;
      if (data.paymentConfig) paymentConfig = data.paymentConfig;
      console.log('Loaded persisted data from data.json');
    } catch (err) {
      console.error('Failed to parse data.json:', err);
    }
  } else {
    saveData();
  }
}

// Load persisted data on server startup
loadData();

// Email Configuration (persisted in email-config.json if updated via UI)
const EMAIL_CONFIG_FILE = path.join(__dirname, 'email-config.json');
let emailSettings = {
  mode: 'gmail',
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: process.env.EMAIL_USER || 'readingroomlibrary40@gmail.com',
  pass: process.env.EMAIL_PASS || 'llfntofniqutlkbh',
  from: process.env.EMAIL_FROM || 'The Reading Room Library <readingroomlibrary40@gmail.com>'
};

if (fs.existsSync(EMAIL_CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8'));
    emailSettings = Object.assign(emailSettings, saved);
  } catch (e) {
    console.error('Failed to load email-config.json', e);
  }
} else {
  // If email-config.json doesn't exist yet, save default configuration
  try {
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(emailSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write default email-config.json', e);
  }
}

function getTransporter() {
  if (!emailSettings.user || !emailSettings.pass) {
    return null;
  }
  const mode = String(emailSettings.mode || emailSettings.service || '').toLowerCase();

  // 1. Gmail Mode (Uses official Gmail SMTP service & App Password)
  if (mode === 'gmail' || emailSettings.service === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: String(emailSettings.user).trim(),
        pass: String(emailSettings.pass).replace(/\s+/g, '') // Automatically remove any spaces from 16-letter code
      }
    });
  }

  // 2. Ethereal Test Inbox Mode
  if (mode === 'ethereal') {
    return nodemailer.createTransport({
      host: emailSettings.host || 'smtp.ethereal.email',
      port: Number(emailSettings.port) || 587,
      secure: false,
      auth: {
        user: String(emailSettings.user).trim(),
        pass: String(emailSettings.pass).trim()
      }
    });
  }

  // 3. Custom SMTP Host / Outlook / Yahoo
  if (emailSettings.host && !emailSettings.host.includes('ethereal')) {
    return nodemailer.createTransport({
      host: emailSettings.host.trim(),
      port: Number(emailSettings.port) || 587,
      secure: Boolean(emailSettings.secure),
      auth: {
        user: String(emailSettings.user).trim(),
        pass: String(emailSettings.pass).trim()
      }
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: String(emailSettings.user).trim(),
      pass: String(emailSettings.pass).replace(/\s+/g, '')
    }
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]+/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function formatStudent(student) {
  return {
    id: student.id,
    name: student.name,
    username: student.username,
    email: student.email,
    phone: student.phone || ''
  };
}

function calculateFine(dueDate, returnedDate = new Date()) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const ret = new Date(returnedDate);
  const diffDays = Math.ceil((ret - due) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays * fineRate : 0;
}

function logActivity(text) {
  activityLog.unshift({ time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), text });
  if (activityLog.length > 50) activityLog.pop();
  saveData();
}

function generateEmailTemplate({ title, heading, bodyHtml, alertText, actionText, footerText }) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f1ea; color: #1c2541; }
      .email-container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-top: 5px solid #b8935a; }
      .header { background: #152b21; color: #fbf8f1; padding: 24px; text-align: center; }
      .header h1 { margin: 0; font-size: 22px; font-family: Georgia, serif; letter-spacing: 1px; }
      .header p { margin: 6px 0 0 0; font-size: 12px; opacity: 0.8; letter-spacing: 2px; text-transform: uppercase; }
      .content { padding: 30px 25px; }
      .alert-box { background: #fff4e5; border-left: 4px solid #b8935a; padding: 14px 18px; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #5a3b00; }
      .alert-box.danger { background: #fee2e2; border-left-color: #dc2626; color: #991b1b; }
      .alert-box.success { background: #ecfdf5; border-left-color: #059669; color: #065f46; }
      .book-details { background: #fbf8f1; border: 1px solid #e7dfc9; border-radius: 6px; padding: 18px; margin: 20px 0; }
      .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e7dfc9; font-size: 13.5px; }
      .detail-row:last-child { border-bottom: none; }
      .detail-label { color: #7a7a6e; font-weight: 600; }
      .detail-value { color: #152b21; font-weight: bold; }
      .footer { background: #fbf8f1; border-top: 1px solid #e7dfc9; padding: 18px; text-align: center; font-size: 12px; color: #7a7a6e; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #b8935a; color: #ffffff; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <h1>The Reading Room</h1>
        <p>Library Management System</p>
      </div>
      <div class="content">
        <h2 style="color: #152b21; font-size: 18px; margin-top: 0;">${heading}</h2>
        ${alertText ? `<div class="alert-box">${alertText}</div>` : ''}
        ${bodyHtml}
      </div>
      <div class="footer">
        ${footerText || 'This is an automated notification from The Reading Room Library Circulation Desk.'}
        <br><br>Late return fine rate: <b>₹${fineRate}/day</b>. Please return books on time.
      </div>
    </div>
  </body>
  </html>
  `;
}

async function sendEmail(options) {
  const logEntry = {
    id: emailLogs.length + 1,
    to: options.to,
    subject: options.subject,
    timestamp: new Date().toISOString(),
    status: 'pending',
    error: null,
    previewUrl: null
  };

  const transporter = getTransporter();
  if (!transporter) {
    console.log('[EMAIL SIMULATION] SMTP not configured. Simulating delivery:', options.subject, '->', options.to);
    logEntry.status = 'simulated';
    logEntry.notes = 'EMAIL_USER/EMAIL_PASS not configured. Simulated delivery.';
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 100) emailLogs.pop();
    saveData();
    return { success: true, simulated: true, message: 'Simulated email sent. Configure SMTP or 1-Click Test Inbox in Email Hub for real delivery.' };
  }

  try {
    const info = await transporter.sendMail({
      from: emailSettings.from || emailSettings.user,
      ...options
    });
    console.log('[EMAIL SENT]', options.subject, 'to', options.to, 'MessageId:', info.messageId);

    // Check if an Ethereal preview URL is available
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[EMAIL PREVIEW URL]', previewUrl);
      logEntry.previewUrl = previewUrl;
    }

    logEntry.status = 'success';
    logEntry.messageId = info.messageId;
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 100) emailLogs.pop();
    saveData();
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    let friendlyError = error.message;
    if (error.code === 'EAUTH' || (error.message && error.message.includes('535'))) {
      friendlyError = 'Authentication failed (535). For Gmail, Google requires a 16-letter App Password (generated at myaccount.google.com/apppasswords with 2-Step Verification ON) instead of your regular password.';
    }
    console.error('[EMAIL ERROR] Delivery failed to', options.to, ':', friendlyError);
    logEntry.status = 'failed';
    logEntry.error = friendlyError;
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 100) emailLogs.pop();
    saveData();
    return { success: false, error: friendlyError, rawError: error.message };
  }
}

async function scheduleDueNotifications() {
  const now = new Date();
  const results = [];

  for (const record of loanRecords.filter(r => !r.returned)) {
    const student = students.find(s => s.id === record.studentId);
    if (!student || !record.due) continue;

    const dueDate = new Date(record.due);
    const diffMs = dueDate.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const title = record.title;
    const dueText = new Date(record.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    record.reminders = record.reminders || {};

    // 1. Send 2-DAY REMINDER ALERT (When days remaining is 2 or <= 2 and not yet sent)
    if (daysUntilDue === 2 && !record.reminders.twoDays) {
      record.reminders.twoDays = true;
      const subject = `⏰ Library Alert: "${title}" is due in 2 days`;
      const alertHtml = `<b>Urgent Notice:</b> You have <b>2 days remaining</b> to return your borrowed book.`;
      const bodyHtml = `
        <p>Dear <b>${student.name}</b>,</p>
        <p>This is a courtesy reminder that your borrowed book from The Reading Room is due back in <b>2 days</b>.</p>
        <div class="book-details">
          <div class="detail-row"><span class="detail-label">Book Title</span><span class="detail-value">${title}</span></div>
          <div class="detail-row"><span class="detail-label">Borrower</span><span class="detail-value">${student.name}</span></div>
          <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value" style="color: #b8935a;">${dueText}</span></div>
          <div class="detail-row"><span class="detail-label">Days Remaining</span><span class="detail-value"><span class="badge">2 Days</span></span></div>
        </div>
        <p>Please return or renew the book on or before <b>${dueText}</b> to avoid an overdue fine of <b>₹${fineRate} per day</b>.</p>
      `;
      const text = `Dear ${student.name},\n\nYour borrowed book "${title}" is due in 2 days on ${dueText}.\n\nPlease return the book on or before ${dueText} to avoid late fines of ₹${fineRate}/day.\n\nThank you,\nThe Reading Room Library`;

      const html = generateEmailTemplate({
        heading: 'Book Return Reminder — 2 Days Remaining',
        alertText: alertHtml,
        bodyHtml
      });

      const res = await sendEmail({ to: student.email, subject, text, html });

      // Dispatch 2-Day SMS Notification
      dispatchSmsNotification({
        type: '2day_alert',
        to: student.phone || '+91 98765 43210',
        studentName: student.name,
        bookTitle: title,
        message: `⏰ Library 2-Day Alert: Hello ${student.name}, "${title}" is due in 2 days on ${dueText}. Please return on time to avoid late fines (₹${fineRate}/day).`,
        metadata: { loanId: record.id, dueDate: dueText }
      });

      logActivity(`Sent 2-day reminder & SMS to ${student.name} for "${title}"`);
      results.push({ student: student.name, email: student.email, phone: student.phone, title, type: '2-day-reminder', result: res });
    }

    // 2. Overdue notice if overdue and reminder not sent
    if (daysUntilDue < 0 && !record.reminders.overdue) {
      record.reminders.overdue = true;
      const daysLate = Math.abs(daysUntilDue);
      const fineAmount = daysLate * fineRate;
      const subject = `⚠️ Overdue Notice: "${title}" — Fine Accruing (₹${fineAmount})`;
      const alertHtml = `Your book is <b>${daysLate} day(s) overdue</b>. An overdue fine of <b>₹${fineAmount}</b> (₹${fineRate}/day) has accrued.`;
      const bodyHtml = `
        <p>Dear <b>${student.name}</b>,</p>
        <p>Our records show that your borrowed book was due on <b>${dueText}</b> and has not yet been returned.</p>
        <div class="book-details">
          <div class="detail-row"><span class="detail-label">Book Title</span><span class="detail-value">${title}</span></div>
          <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value" style="color: #dc2626;">${dueText}</span></div>
          <div class="detail-row"><span class="detail-label">Days Overdue</span><span class="detail-value">${daysLate} day(s)</span></div>
          <div class="detail-row"><span class="detail-label">Accrued Fine</span><span class="detail-value" style="color: #dc2626;">₹${fineAmount}</span></div>
        </div>
        <p>Please return the book immediately to the library circulation desk and settle the fine via UPI QR code or cash.</p>
      `;
      const text = `Dear ${student.name},\n\nYour borrowed book "${title}" was due on ${dueText} and is now ${daysLate} day(s) overdue.\n\nAccrued late fine: ₹${fineAmount} (₹${fineRate}/day).\n\nPlease return the book immediately.\n\nThank you,\nThe Reading Room Library`;

      const html = generateEmailTemplate({
        heading: 'Overdue Book Notice',
        alertText: alertHtml,
        bodyHtml
      });

      const res = await sendEmail({ to: student.email, subject, text, html });

      // Dispatch Overdue SMS Notification
      dispatchSmsNotification({
        type: 'overdue_alert',
        to: student.phone || '+91 98765 43210',
        studentName: student.name,
        bookTitle: title,
        message: `⚠️ Library Overdue Notice: Hello ${student.name}, "${title}" was due on ${dueText} and is now ${daysLate} day(s) overdue. Fine accrued: ₹${fineAmount} (₹${fineRate}/day). Please return immediately.`,
        metadata: { loanId: record.id, dueDate: dueText, daysLate, fineAmount }
      });

      logActivity(`Sent overdue notice & SMS to ${student.name} for "${title}" (Fine: ₹${fineAmount})`);
      results.push({ student: student.name, email: student.email, phone: student.phone, title, type: 'overdue-notice', result: res });
    }
  }

  return results;
}

// Hourly notification check & immediate check on start
setInterval(scheduleDueNotifications, 60 * 60 * 1000);
setTimeout(scheduleDueNotifications, 3000);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Authentication
app.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  if (role === 'admin') {
    if (username === admin.username && password === admin.password) {
      return res.json({ success: true, user: { role: 'admin', name: admin.name } });
    }
    return res.json({ success: false, message: 'Incorrect admin username or password.' });
  }
  const loginId = String(username || '').trim().toLowerCase();
  const student = students.find(s =>
    (String(s.username).toLowerCase() === loginId || String(s.email).toLowerCase() === loginId) && s.password === password
  );
  if (student) {
    return res.json({ success: true, user: { role: 'student', id: student.id, name: student.name, email: student.email } });
  }
  res.json({ success: false, message: 'Incorrect student email/username or password.' });
});

// Catalog & Students
app.get('/books', (req, res) => res.json(books));
app.get('/students', (req, res) => res.json(students));
app.get('/activity', (req, res) => res.json(activityLog));

// Fine Rate
app.get('/fine-rate', (req, res) => res.json({ fineRate }));
app.post('/fine-rate', (req, res) => {
  const { fineRate: newFineRate } = req.body;
  const parsed = Number(newFineRate);
  if (Number.isNaN(parsed) || parsed < 0) {
    return res.json({ success: false, message: 'Fine rate must be a non-negative number.' });
  }
  fineRate = parsed;
  logActivity(`Fine rate updated to ₹${fineRate}/day`);
  res.json({ success: true, fineRate });
});

// Loans list
app.get('/loans', (req, res) => {
  const loansWithLiveFines = loanRecords.map(r => {
    const isReturned = Boolean(r.returned);
    const dueDate = new Date(r.due);
    const now = new Date();
    const isOverdue = !isReturned && dueDate < now;
    const daysLate = isReturned
      ? Math.max(0, Math.ceil((new Date(r.returned) - dueDate) / (1000 * 60 * 60 * 24)))
      : (isOverdue ? Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)) : 0);
    const calculatedFine = isReturned ? (r.fineAmount || 0) : (isOverdue ? daysLate * fineRate : 0);
    return {
      ...r,
      daysLate,
      liveFine: calculatedFine,
      isOverdue
    };
  });
  res.json(loansWithLiveFines);
});

// Student profile & borrowing status
app.get('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (!student) return res.json({ success: false, message: 'Student not found.' });

  const now = new Date();
  const currentLoans = loanRecords.filter(r => r.studentId === id && !r.returned).map(r => {
    const dueDate = new Date(r.due);
    const diffMs = dueDate.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = daysRemaining < 0;
    const overdueDays = isOverdue ? Math.abs(daysRemaining) : 0;
    const isPaid = r.paymentStatus === 'paid';
    const currentFine = (isOverdue && !isPaid) ? overdueDays * fineRate : 0;

    return {
      id: r.id,
      bookId: r.bookId,
      title: r.title,
      issued: r.issued,
      due: r.due,
      daysRemaining,
      isOverdue,
      overdueDays,
      fineAmount: (isOverdue || r.fineAmount) ? (r.fineAmount || currentFine) : 0,
      paymentStatus: r.paymentStatus || 'pending'
    };
  });

  const history = loanRecords.filter(r => r.studentId === id && r.returned).map(r => ({
    id: r.id,
    bookId: r.bookId,
    title: r.title,
    issued: r.issued,
    due: r.due,
    returned: r.returned,
    lateDays: Math.max(0, Math.ceil((new Date(r.returned) - new Date(r.due)) / (1000 * 60 * 60 * 24))),
    fineAmount: r.fineAmount || 0,
    paymentStatus: r.paymentStatus
  }));

  const activeFines = currentLoans.reduce((sum, item) => sum + ((item.paymentStatus !== 'paid') ? (item.fineAmount || 0) : 0), 0);
  const historyUnpaidFines = history.reduce((sum, item) => sum + ((item.fineAmount > 0 && item.paymentStatus !== 'paid') ? item.fineAmount : 0), 0);
  const totalOutstanding = activeFines + historyUnpaidFines;

  res.json({
    success: true,
    student: formatStudent(student),
    currentLoans,
    history,
    fineRate,
    activeFines,
    historyUnpaidFines,
    outstanding: totalOutstanding
  });
});

// Admin stats
app.get('/admin-stats', (req, res) => {
  const now = new Date();
  let totalOutstanding = 0;
  const overdueLoans = [];
  const dueIn2Loans = [];

  loanRecords.forEach(r => {
    if (r.returned) {
      if (r.fineAmount > 0 && r.paymentStatus !== 'paid') {
        totalOutstanding += r.fineAmount;
      }
    } else {
      const dueDate = new Date(r.due);
      const diffMs = dueDate.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const student = students.find(s => s.id === r.studentId);

      if (daysUntilDue < 0) {
        const daysLate = Math.abs(daysUntilDue);
        const fine = (r.paymentStatus === 'paid') ? 0 : daysLate * fineRate;
        totalOutstanding += (r.paymentStatus !== 'paid' ? (daysLate * fineRate) : 0);
        overdueLoans.push({
          loanId: r.id,
          bookId: r.bookId,
          title: r.title,
          studentId: r.studentId,
          studentName: student ? student.name : 'Unknown',
          studentEmail: student ? student.email : '',
          due: r.due,
          daysLate,
          fine: daysLate * fineRate,
          paymentStatus: r.paymentStatus
        });
      } else if (daysUntilDue === 2 || (daysUntilDue <= 2 && daysUntilDue >= 0)) {
        dueIn2Loans.push({
          loanId: r.id,
          bookId: r.bookId,
          title: r.title,
          studentId: r.studentId,
          studentName: student ? student.name : 'Unknown',
          studentEmail: student ? student.email : '',
          due: r.due,
          daysRemaining: daysUntilDue,
          reminderSent: Boolean(r.reminders && r.reminders.twoDays)
        });
      }
    }
  });

  const studentsWithFines = new Set(
    loanRecords.filter(r => {
      if (r.returned) return r.fineAmount > 0 && r.paymentStatus !== 'paid';
      return new Date(r.due) < now && r.paymentStatus !== 'paid';
    }).map(r => r.studentId)
  ).size;

  res.json({
    totalOutstanding,
    studentsWithFines,
    dueIn2Count: dueIn2Loans.length,
    overdueCount: overdueLoans.filter(l => l.paymentStatus !== 'paid').length,
    dueIn2: dueIn2Loans,
    overdueLoans
  });
});

// Register student
app.post('/students', (req, res) => {
  const { name, username, password, email, phone } = req.body;
  if (!name || !username || !password || !email) {
    return res.json({ success: false, message: 'Name, username, email, and password are required.' });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPhone = String(phone || `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`).trim();
  const exists = students.some(s =>
    String(s.username).toLowerCase() === cleanUsername || String(s.email).toLowerCase() === cleanEmail
  );
  if (exists) {
    return res.json({ success: false, message: 'Username or email already exists. Choose another.' });
  }
  const newStudent = { id: nextStudentId++, name, username: cleanUsername, password, email: cleanEmail, phone: cleanPhone };
  students.push(newStudent);
  logActivity(`${name} registered as a new student (${cleanEmail}, ${cleanPhone})`);

  // Welcome SMS Notification
  dispatchSmsNotification({
    type: 'welcome',
    to: cleanPhone,
    studentName: name,
    bookTitle: 'Library Membership Active',
    message: `🎉 Welcome to The Reading Room Library, ${name}! Your membership is active. You can now browse our catalog, read digital flipbooks, and borrow titles.`
  });

  // Welcome email
  sendEmail({
    to: cleanEmail,
    subject: 'Welcome to The Reading Room Library',
    text: `Hello ${name},\n\nYour library student account has been created successfully!\n\nUsername: ${cleanUsername}\nLogin: http://localhost:5000\n\nHappy reading!`,
    html: generateEmailTemplate({
      heading: `Welcome, ${name}!`,
      bodyHtml: `<p>Your student membership is now active.</p><p>You can browse the collection, borrow titles, read interactive 3D flipbooks, and track your loans online.</p>`
    })
  }).catch(() => { });

  res.json({ success: true, student: formatStudent(newStudent) });
});

// Update student details (name, email, phone)
app.put('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);
  if (!student) {
    return res.json({ success: false, message: 'Student not found.' });
  }
  const { name, email, phone } = req.body;
  if (name) student.name = String(name).trim();
  if (email) student.email = String(email).trim().toLowerCase();
  if (phone) student.phone = String(phone).trim();

  logActivity(`Student "${student.name}" details updated (Email: ${student.email}, Phone: ${student.phone})`);
  res.json({ success: true, student: formatStudent(student), message: 'Student updated successfully.' });
});

// Delete student account
app.delete('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = students.findIndex(s => s.id === id);
  if (index === -1) {
    return res.json({ success: false, message: 'Student not found.' });
  }
  const [removed] = students.splice(index, 1);
  logActivity(`Student "${removed.name}" (${removed.email}) deleted`);
  res.json({ success: true, message: 'Student account deleted successfully.' });
});

// Add book (with rich chapters for digital flipbook reader)
app.post('/books', (req, res) => {
  const { title, author, genre } = req.body;
  if (!title || !author) {
    return res.json({ success: false, message: 'Title and author are required.' });
  }
  const initials = author.split(' ').pop().slice(0, 3).toUpperCase();
  const call = `${Math.floor(Math.random() * 900 + 100)} ${initials}`;
  const generated = generateBookContent(title, author, genre);
  const newBook = {
    id: nextBookId++,
    title,
    author,
    genre: genre || 'General',
    call,
    status: 'available',
    coverTheme: generated.coverTheme,
    publicationYear: generated.publicationYear,
    pagesCount: generated.pagesCount,
    chapters: generated.chapters
  };
  books.push(newBook);
  logActivity(`"${title}" added to catalog with 3D Flipbook Reader edition`);
  res.json({ success: true, book: newBook });
});

// Issue book (With Exact Date & Time SMS Notification)
app.post('/issue', async (req, res) => {
  const { studentId, bookId, days } = req.body;
  const book = books.find(b => b.id === Number(bookId));
  const student = students.find(s => s.id === Number(studentId));
  if (!book || !student || book.status !== 'available') {
    return res.json({ success: false, message: 'Unable to issue this book.' });
  }
  const loanDays = Number(days) || 14;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  book.status = 'out';
  book.studentId = student.id;
  book.issued = daysFromNow(0);
  book.due = daysFromNow(loanDays);

  const dueText = new Date(book.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const loan = {
    id: nextLoanId++,
    bookId: book.id,
    studentId: student.id,
    title: book.title,
    author: book.author,
    studentName: student.name,
    studentPhone: student.phone || '+91 98765 43210',
    issued: book.issued,
    due: book.due,
    issuedDate: formattedDate,
    issuedTime: formattedTime,
    issuedTimestamp: now.toISOString(),
    dueText,
    loanDays,
    returned: null,
    fineAmount: null,
    paymentStatus: 'pending',
    fineRateAtLoan: fineRate,
    reminders: { twoDays: false, threeDays: false, oneDay: false, due: false, overdue: false }
  };
  loanRecords.push(loan);

  // Compose Detailed SMS Text Message with exact date and time
  const smsText = `📚 The Reading Room Library Alert: Hello ${student.name}, you have checked out "${book.title}" by ${book.author} on ${formattedDate} at ${formattedTime}. Due Date: ${dueText} (${loanDays} days). Late fine: ₹${fineRate}/day. Enjoy reading!`;

  // Dispatch SMS Notification
  const smsRecord = dispatchSmsNotification({
    type: 'issue_alert',
    to: student.phone || '+91 98765 43210',
    studentName: student.name,
    bookTitle: book.title,
    message: smsText,
    metadata: {
      loanId: loan.id,
      bookId: book.id,
      studentId: student.id,
      issuedDate: formattedDate,
      issuedTime: formattedTime,
      dueDate: dueText,
      loanDays
    }
  });

  logActivity(`"${book.title}" issued to ${student.name} on ${formattedDate} at ${formattedTime} (SMS sent to ${student.phone || 'mobile'})`);

  // Email Notification
  sendEmail({
    to: student.email,
    subject: `Book Issued: "${book.title}" (${formattedDate} at ${formattedTime})`,
    text: `Dear ${student.name},\n\nYou have borrowed "${book.title}" by ${book.author}.\nIssue Timestamp: ${formattedDate} at ${formattedTime}\nDue Date: ${dueText} (${loanDays} days).\n\nPlease return it on time to avoid a ₹${fineRate}/day fine.`,
    html: generateEmailTemplate({
      heading: 'Book Issued Successfully',
      bodyHtml: `
        <p>Dear <b>${student.name}</b>,</p>
        <p>You have successfully checked out the following title from the circulation desk:</p>
        <div class="book-details">
          <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${book.title}</span></div>
          <div class="detail-row"><span class="detail-label">Author</span><span class="detail-value">${book.author}</span></div>
          <div class="detail-row"><span class="detail-label">Issue Date & Time</span><span class="detail-value" style="color: #152b21;">${formattedDate} at ${formattedTime}</span></div>
          <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value" style="color: #b8935a;">${dueText}</span></div>
          <div class="detail-row"><span class="detail-label">Loan Duration</span><span class="detail-value">${loanDays} Days</span></div>
          <div class="detail-row"><span class="detail-label">SMS Alert Sent To</span><span class="detail-value">${student.phone || 'Registered Mobile'}</span></div>
        </div>
      `
    })
  }).catch(() => { });

  res.json({ success: true, loan, sms: smsRecord });
});

// Return book & calculate final fine (₹10/day overdue) with SMS receipt
app.post('/return', (req, res) => {
  const { bookId } = req.body;
  const book = books.find(b => b.id === Number(bookId));
  if (!book || book.status !== 'out') {
    return res.json({ success: false, message: 'Unable to return this book. It is not marked as checked out.' });
  }
  const student = students.find(s => s.id === book.studentId);
  const loan = loanRecords.find(r => r.bookId === book.id && !r.returned);
  const returned = new Date().toISOString();
  const returnDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const returnTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  let fineAmount = 0;
  let paymentStatus = 'paid';

  if (loan) {
    fineAmount = calculateFine(loan.due, returned);
    paymentStatus = fineAmount > 0 ? 'pending' : 'paid';
    loan.returned = returned;
    loan.returnDate = returnDate;
    loan.returnTime = returnTime;
    loan.fineAmount = fineAmount;
    loan.paymentStatus = paymentStatus;
  }

  book.status = 'available';
  delete book.studentId;
  delete book.issued;
  delete book.due;

  // Dispatch Return SMS Receipt
  if (student) {
    const returnSms = `📚 The Reading Room Library: "${book.title}" returned by ${student.name} on ${returnDate} at ${returnTime}.${fineAmount > 0 ? ` Overdue fine: ₹${fineAmount}. Please settle via UPI QR in student portal.` : ' Returned on time with zero late fine. Thank you!'}`;
    dispatchSmsNotification({
      type: 'return_receipt',
      to: student.phone || '+91 98765 43210',
      studentName: student.name,
      bookTitle: book.title,
      message: returnSms,
      metadata: { bookId: book.id, studentId: student.id, fineAmount, returnDate, returnTime }
    });
  }

  logActivity(`"${book.title}" returned by ${student ? student.name : 'a student'} on ${returnDate} at ${returnTime}${fineAmount > 0 ? ` (Overdue Fine: ₹${fineAmount})` : ' (On Time)'}`);

  if (student && fineAmount > 0) {
    sendEmail({
      to: student.email,
      subject: `Book Returned: "${book.title}" — Overdue Fine: ₹${fineAmount}`,
      text: `Dear ${student.name},\n\n"${book.title}" has been returned on ${returnDate} at ${returnTime}. An overdue fine of ₹${fineAmount} (calculated at ₹${fineRate}/day) is pending.\n\nPlease pay using UPI QR code in your dashboard.`,
      html: generateEmailTemplate({
        heading: 'Book Returned with Overdue Fine',
        alertText: `Overdue late return fine: <b>₹${fineAmount}</b>`,
        bodyHtml: `
          <p>Dear <b>${student.name}</b>,</p>
          <p>You have returned <b>"${book.title}"</b> after the scheduled due date.</p>
          <div class="book-details">
            <div class="detail-row"><span class="detail-label">Book Title</span><span class="detail-value">${book.title}</span></div>
            <div class="detail-row"><span class="detail-label">Return Date & Time</span><span class="detail-value">${returnDate} at ${returnTime}</span></div>
            <div class="detail-row"><span class="detail-label">Late Fine Total</span><span class="detail-value" style="color: #dc2626;">₹${fineAmount}</span></div>
          </div>
          <p>Please log in to your student dashboard to complete the fine payment via UPI QR code.</p>
        `
      })
    }).catch(() => { });
  }

  res.json({ success: true, fineAmount, paymentStatus, loanId: loan ? loan.id : null });
});

// Delete book
app.delete('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = books.findIndex(b => b.id === id);
  if (index === -1) {
    return res.json({ success: false, message: 'Book not found.' });
  }
  const [removed] = books.splice(index, 1);
  logActivity(`"${removed.title}" removed from catalog`);
  res.json({ success: true });
});

// ----------------------------------------------------
// 2-DAY REMINDERS & EMAIL DISPATCH ENDPOINTS
// ----------------------------------------------------

// Run full reminder pass
app.post('/send-reminders', async (req, res) => {
  try {
    const results = await scheduleDueNotifications();
    const successful = results.filter(r => r.result && r.result.success);
    const failed = results.filter(r => !r.result || !r.result.success);

    if (results.length === 0) {
      return res.json({ success: true, message: 'No active loans require a 2-day reminder or overdue notice right now.', results });
    }

    if (failed.length > 0 && successful.length === 0) {
      return res.json({
        success: false,
        message: `Failed to send alerts: ${failed[0].result?.error || 'Email authentication failed.'}`,
        results
      });
    }

    res.json({
      success: true,
      message: `Dispatched ${successful.length} alert(s) successfully.${failed.length > 0 ? ` (${failed.length} failed: check Mail Hub)` : ''}`,
      results
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Reminder pass failed.', error: err.message });
  }
});

app.post('/api/send-reminders', async (req, res) => {
  try {
    const results = await scheduleDueNotifications();
    const successful = results.filter(r => r.result && r.result.success);
    const failed = results.filter(r => !r.result || !r.result.success);

    if (results.length === 0) {
      return res.json({ success: true, message: 'No active loans require a 2-day reminder or overdue notice right now.', results });
    }

    if (failed.length > 0 && successful.length === 0) {
      return res.json({
        success: false,
        message: `Failed to send alerts: ${failed[0].result?.error || 'Email authentication failed.'}`,
        results
      });
    }

    res.json({
      success: true,
      message: `Dispatched ${successful.length} alert(s) successfully.${failed.length > 0 ? ` (${failed.length} failed)` : ''}`,
      results
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Reminder pass failed.', error: err.message });
  }
});

// Send manual 2-day reminder for a specific loan
app.post('/send-reminder', async (req, res) => {
  const { loanId } = req.body || {};
  const record = loanRecords.find(r => r.id === Number(loanId));
  if (!record) return res.json({ success: false, message: 'Loan record not found.' });
  if (record.returned) return res.json({ success: false, message: 'Book has already been returned.' });
  const student = students.find(s => s.id === record.studentId);
  if (!student) return res.json({ success: false, message: 'Student account not found.' });

  const dueDate = new Date(record.due);
  const dueText = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

  const subject = `⏰ Library Alert: "${record.title}" is due in ${Math.max(0, diffDays)} days`;
  const bodyHtml = `
    <p>Dear <b>${student.name}</b>,</p>
    <p>This is a direct reminder from the library regarding your active loan:</p>
    <div class="book-details">
      <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${record.title}</span></div>
      <div class="detail-row"><span class="detail-label">Borrower</span><span class="detail-value">${student.name}</span></div>
      <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value" style="color: #b8935a;">${dueText}</span></div>
      <div class="detail-row"><span class="detail-label">Time Remaining</span><span class="detail-value">${diffDays} day(s)</span></div>
    </div>
    <p>Please return the book on or before the due date. Overdue fine rate is <b>₹${fineRate}/day</b>.</p>
  `;

  try {
    const result = await sendEmail({
      to: student.email,
      subject,
      text: `Dear ${student.name},\n\nYour borrowed book "${record.title}" is due on ${dueText}.\nPlease return it to avoid late fines of ₹${fineRate}/day.\n\nThank you,\nThe Reading Room Library`,
      html: generateEmailTemplate({
        heading: 'Library Book Return Notice',
        alertText: `Due Date: <b>${dueText}</b> (${diffDays} days remaining)`,
        bodyHtml
      })
    });

    if (!result.success) {
      return res.json({
        success: false,
        message: `Failed to dispatch email to ${student.email}: ${result.error}`,
        emailResult: result
      });
    }

    record.reminders = record.reminders || {};
    record.reminders.twoDays = true;
    logActivity(`Sent manual reminder to ${student.name} (${student.email}) for "${record.title}"`);
    res.json({ success: true, message: `Reminder successfully sent to ${student.email}`, emailResult: result });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Failed to dispatch email.', error: err.message });
  }
});

app.post('/api/send-reminder', async (req, res) => {
  const { loanId } = req.body || {};
  const record = loanRecords.find(r => r.id === Number(loanId));
  if (!record) return res.json({ success: false, message: 'Loan record not found.' });
  if (record.returned) return res.json({ success: false, message: 'Book has already been returned.' });
  const student = students.find(s => s.id === record.studentId);
  if (!student) return res.json({ success: false, message: 'Student account not found.' });

  const dueDate = new Date(record.due);
  const dueText = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

  const subject = `⏰ Library Alert: "${record.title}" is due in ${Math.max(0, diffDays)} days`;
  const bodyHtml = `
    <p>Dear <b>${student.name}</b>,</p>
    <p>This is a direct reminder from the library regarding your active loan:</p>
    <div class="book-details">
      <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${record.title}</span></div>
      <div class="detail-row"><span class="detail-label">Borrower</span><span class="detail-value">${student.name}</span></div>
      <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value" style="color: #b8935a;">${dueText}</span></div>
      <div class="detail-row"><span class="detail-label">Time Remaining</span><span class="detail-value">${diffDays} day(s)</span></div>
    </div>
    <p>Please return the book on or before the due date. Overdue fine rate is <b>₹${fineRate}/day</b>.</p>
  `;

  try {
    const result = await sendEmail({
      to: student.email,
      subject,
      text: `Dear ${student.name},\n\nYour borrowed book "${record.title}" is due on ${dueText}.\nPlease return it to avoid late fines of ₹${fineRate}/day.\n\nThank you,\nThe Reading Room Library`,
      html: generateEmailTemplate({
        heading: 'Library Book Return Notice',
        alertText: `Due Date: <b>${dueText}</b> (${diffDays} days remaining)`,
        bodyHtml
      })
    });

    if (!result.success) {
      return res.json({
        success: false,
        message: `Failed to dispatch email to ${student.email}: ${result.error}`,
        emailResult: result
      });
    }

    record.reminders = record.reminders || {};
    record.reminders.twoDays = true;
    logActivity(`Sent manual reminder to ${student.name} (${student.email}) for "${record.title}"`);
    res.json({ success: true, message: `Reminder successfully sent to ${student.email}`, emailResult: result });
  } catch (err) {
    res.json({ success: false, message: 'Failed to dispatch email.', error: err.message });
  }
});

// Direct Custom Email Endpoint
app.post('/api/send-custom-email', async (req, res) => {
  const { to, subject, message, heading } = req.body;
  if (!to || !subject || !message) {
    return res.json({ success: false, message: 'Recipient, subject, and message are required.' });
  }

  const result = await sendEmail({
    to,
    subject,
    text: message,
    html: generateEmailTemplate({
      heading: heading || 'Library Notice',
      bodyHtml: `<div style="font-size:14.5px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(message)}</div>`
    })
  });

  res.json({
    success: result.success,
    message: result.success ? `Email sent to ${to}` : `Failed to send email: ${result.error}`,
    detail: result
  });
});

// 1-Click Instant Test Inbox Creator (Ethereal Email)
app.post('/api/create-test-inbox', async (req, res) => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    emailSettings.mode = 'ethereal';
    emailSettings.host = testAccount.smtp.host;
    emailSettings.port = testAccount.smtp.port;
    emailSettings.secure = testAccount.smtp.secure;
    emailSettings.user = testAccount.user;
    emailSettings.pass = testAccount.pass;
    emailSettings.from = `The Reading Room Library <${testAccount.user}>`;

    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(emailSettings, null, 2));
    logActivity(`1-Click Instant Test Inbox activated (${testAccount.user})`);

    res.json({
      success: true,
      message: 'Instant test email inbox generated! Emails will now produce instant live browser preview links.',
      account: {
        user: testAccount.user,
        pass: testAccount.pass,
        webUrl: `https://ethereal.email/messages`
      }
    });
  } catch (err) {
    res.json({ success: false, message: 'Failed to generate test inbox: ' + err.message });
  }
});

// Test Email endpoint
app.post('/api/test-email', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.json({ success: false, message: 'Destination email is required.' });

  const result = await sendEmail({
    to,
    subject: '🧪 Library Management System — SMTP Test Email',
    text: 'This is a test email confirming that your Library Management System email engine is working successfully!',
    html: generateEmailTemplate({
      heading: 'SMTP Email Delivery Test',
      alertText: '✅ Real email delivery engine is active and working!',
      bodyHtml: `<p>Your library email server is connected and configured to deliver 2-day return reminders, overdue notices, and fine receipts.</p>`
    })
  });

  res.json({
    success: result.success,
    message: result.success ? `Test email sent to ${to}` : `Failed to send email: ${result.error}`,
    detail: result
  });
});

// Email settings get/post
app.get('/api/email-settings', (req, res) => {
  res.json({
    mode: emailSettings.mode || 'gmail',
    service: emailSettings.service,
    host: emailSettings.host,
    port: emailSettings.port,
    secure: emailSettings.secure,
    user: emailSettings.user,
    hasPass: Boolean(emailSettings.pass),
    from: emailSettings.from,
    configured: Boolean(emailSettings.user && emailSettings.pass)
  });
});

app.post('/api/email-settings', (req, res) => {
  const { mode, service, host, port, secure, user, pass, from } = req.body;
  if (mode !== undefined) emailSettings.mode = mode;
  if (service !== undefined) emailSettings.service = service;
  if (host !== undefined) emailSettings.host = host;
  if (port !== undefined) emailSettings.port = Number(port);
  if (secure !== undefined) emailSettings.secure = Boolean(secure);
  if (user !== undefined && user !== '') emailSettings.user = user;
  if (pass !== undefined && pass !== '') emailSettings.pass = pass;
  if (from !== undefined && from !== '') emailSettings.from = from;

  try {
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(emailSettings, null, 2));
    logActivity('Email/SMTP server configuration updated');
    res.json({ success: true, message: 'Email settings saved successfully.' });
  } catch (err) {
    res.json({ success: false, message: 'Failed to write config file', error: err.message });
  }
});

// Email dispatch logs
app.get('/api/email-logs', (req, res) => {
  res.json(emailLogs);
});

// ----------------------------------------------------
// SCANNER & LOOKUP ENDPOINTS (BARCODE / QR / UPI)
// ----------------------------------------------------

app.get('/api/scan-lookup', (req, res) => {
  const rawCode = String(req.query.code || '').trim();
  if (!rawCode) {
    return res.json({ success: false, message: 'Scan code is required.' });
  }

  // 1. Check if UPI intent QR code
  if (rawCode.startsWith('upi://pay') || rawCode.includes('pa=')) {
    try {
      const url = new URL(rawCode.startsWith('upi:') ? rawCode.replace('upi://pay', 'http://upi.org') : `http://upi.org?${rawCode}`);
      const pa = url.searchParams.get('pa') || '';
      const pn = url.searchParams.get('pn') || '';
      const am = url.searchParams.get('am') || '';
      const tn = url.searchParams.get('tn') || '';
      return res.json({
        success: true,
        type: 'upi',
        data: { upiId: pa, payeeName: pn, amount: am, note: tn, raw: rawCode }
      });
    } catch (e) {
      // fallback parsing
      return res.json({
        success: true,
        type: 'upi',
        data: { raw: rawCode }
      });
    }
  }

  // 2. Search for Book (by ID, call number, title, author)
  const codeLower = rawCode.toLowerCase();
  const matchedBook = books.find(b =>
    String(b.id) === rawCode ||
    (b.call && b.call.toLowerCase() === codeLower) ||
    (b.title && b.title.toLowerCase().includes(codeLower))
  );

  if (matchedBook) {
    const currentLoan = loanRecords.find(r => r.bookId === matchedBook.id && !r.returned);
    return res.json({
      success: true,
      type: 'book',
      data: {
        book: matchedBook,
        loan: currentLoan || null
      }
    });
  }

  // 3. Search for Student (by ID, username, email, or name)
  const matchedStudent = students.find(s =>
    String(s.id) === rawCode ||
    (s.username && s.username.toLowerCase() === codeLower) ||
    (s.email && s.email.toLowerCase() === codeLower) ||
    (s.name && s.name.toLowerCase().includes(codeLower))
  );

  if (matchedStudent) {
    const studentLoans = loanRecords.filter(r => r.studentId === matchedStudent.id && !r.returned);
    return res.json({
      success: true,
      type: 'student',
      data: {
        student: matchedStudent,
        loansCount: studentLoans.length
      }
    });
  }

  // Generic/Unknown result
  res.json({
    success: true,
    type: 'raw',
    data: { raw: rawCode, message: 'Unmatched raw scan text' }
  });
});

// ----------------------------------------------------
// UPI PAYMENT QR & FINE SETTLEMENT ENDPOINTS
// ----------------------------------------------------

// Get / Update UPI Payment Config
app.get('/api/payment-config', (req, res) => {
  res.json(paymentConfig);
});

app.post('/api/payment-config', (req, res) => {
  const { upiId, payeeName, qrCodeImage, instructions } = req.body;
  if (upiId) paymentConfig.upiId = upiId.trim();
  if (payeeName) paymentConfig.payeeName = payeeName.trim();
  if (qrCodeImage !== undefined) paymentConfig.qrCodeImage = qrCodeImage;
  if (instructions) paymentConfig.instructions = instructions;

  logActivity(`Payment QR settings updated (UPI: ${paymentConfig.upiId})`);
  res.json({ success: true, paymentConfig });
});

// Submit fine payment (by Student or Admin)
app.post('/api/pay-fine', async (req, res) => {
  const { loanId, studentId, amount, transactionId, screenshot, notes } = req.body;
  const loan = loanId ? loanRecords.find(r => r.id === Number(loanId)) : null;
  const student = studentId ? students.find(s => s.id === Number(studentId)) : (loan ? students.find(s => s.id === loan.studentId) : null);

  const payment = {
    id: nextPaymentId++,
    loanId: loan ? loan.id : null,
    studentId: student ? student.id : (studentId || null),
    studentName: student ? student.name : 'Student',
    studentEmail: student ? student.email : '',
    bookTitle: loan ? loan.title : 'Library Fine Settlement',
    amount: Number(amount) || (loan ? loan.fineAmount : 0) || 10,
    transactionId: transactionId || `UPI-${Date.now().toString().slice(-6)}`,
    screenshot: screenshot || null,
    notes: notes || '',
    status: 'verified', // Instant clearance with transaction record
    createdAt: new Date().toISOString()
  };

  paymentRecords.unshift(payment);

  if (loan) {
    loan.paymentStatus = 'paid';
    if (!loan.fineAmount) loan.fineAmount = payment.amount;
  }

  logActivity(`Fine of ₹${payment.amount} paid by ${payment.studentName} for "${payment.bookTitle}" (Ref: ${payment.transactionId})`);

  // Send Payment Confirmation Receipt Email
  if (student && student.email) {
    sendEmail({
      to: student.email,
      subject: `Receipt: Library Fine Payment of ₹${payment.amount} Received`,
      text: `Dear ${student.name},\n\nWe have received your payment of ₹${payment.amount} for "${payment.bookTitle}".\nTransaction ID: ${payment.transactionId}\nStatus: Paid / Cleared.\n\nThank you,\nThe Reading Room Library`,
      html: generateEmailTemplate({
        heading: 'Fine Payment Receipt',
        alertText: `Payment of <b>₹${payment.amount}</b> successfully cleared.`,
        bodyHtml: `
          <p>Dear <b>${student.name}</b>,</p>
          <p>Thank you for settling your library fine. Your account is now in good standing.</p>
          <div class="book-details">
            <div class="detail-row"><span class="detail-label">Receipt Number</span><span class="detail-value">RCP-${payment.id.toString().padStart(5, '0')}</span></div>
            <div class="detail-row"><span class="detail-label">Transaction ID / UTR</span><span class="detail-value">${payment.transactionId}</span></div>
            <div class="detail-row"><span class="detail-label">Book / Description</span><span class="detail-value">${payment.bookTitle}</span></div>
            <div class="detail-row"><span class="detail-label">Amount Paid</span><span class="detail-value" style="color: #059669;">₹${payment.amount}</span></div>
            <div class="detail-row"><span class="detail-label">Payment Date</span><span class="detail-value">${new Date().toLocaleString('en-GB')}</span></div>
          </div>
        `
      })
    }).catch(() => { });
  }

  res.json({
    success: true,
    message: `Payment of ₹${payment.amount} recorded successfully.`,
    payment
  });
});

// Get all payment transactions
app.get('/api/payments', (req, res) => {
  res.json(paymentRecords);
});

// ----------------------------------------------------
// SMS ALERTS & DIGITAL BOOK READER ENDPOINTS
// ----------------------------------------------------

// Get all dispatched SMS notifications
app.get('/api/sms-logs', (req, res) => {
  res.json(smsLogs);
});

// Send custom instant SMS notification
app.post('/api/send-sms', (req, res) => {
  const { to, message, studentName, bookTitle, type } = req.body;
  if (!to || !message) {
    return res.json({ success: false, message: 'Recipient phone number and message are required.' });
  }

  const logEntry = dispatchSmsNotification({
    type: type || 'custom_alert',
    to,
    studentName: studentName || 'Student',
    bookTitle: bookTitle || 'Library Notice',
    message,
    metadata: {
      sentBy: 'admin',
      deliveryMethod: 'Fast2SMS/Twilio Gateway Simulator'
    }
  });

  res.json({
    success: true,
    message: `SMS text message delivered to ${to}`,
    sms: logEntry
  });
});

// Get readable book content for flipbook reader
app.get('/api/books/:id/read', (req, res) => {
  const id = Number(req.params.id);
  const book = books.find(b => b.id === id);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found.' });
  }

  if (!book.chapters || book.chapters.length === 0) {
    const generated = generateBookContent(book.title, book.author, book.genre);
    book.chapters = generated.chapters;
    book.pagesCount = generated.pagesCount;
    book.coverTheme = generated.coverTheme;
  }

  res.json({
    success: true,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      genre: book.genre,
      call: book.call,
      status: book.status,
      coverTheme: book.coverTheme || 'emerald',
      publicationYear: book.publicationYear || '2024',
      pagesCount: book.pagesCount || 6,
      chapters: book.chapters
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`  Library Management System running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  Fine Rate: ₹${fineRate}/day`);
    console.log(`  2-Day Due Reminders: Active`);
    console.log(`  UPI Payment QR: Active (${paymentConfig.upiId})`);
    console.log(`  Scanner & Mail Hub: Ready`);
    console.log(`=========================================`);
  });
}

module.exports = app;

