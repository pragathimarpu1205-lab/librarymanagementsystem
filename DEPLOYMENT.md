# 🚀 Deployment Guide — Library Management System

This repository is pre-configured for instant deployment on all major cloud platforms. Choose the platform that best suits your needs below:

---

## 📋 Table of Contents
1. [Option 1: Render (Recommended — Free & Easiest)](#option-1-render-recommended--free--easiest)
2. [Option 2: Railway (Fastest Cloud Setup)](#option-2-railway)
3. [Option 3: Vercel (Serverless Deployment)](#option-3-vercel-serverless)
4. [Option 4: Docker & Docker Compose (Self-Hosted / VPS)](#option-4-docker--docker-compose)
5. [Option 5: Traditional VPS / Ubuntu Server (PM2 + Nginx)](#option-5-traditional-vps-or-ubuntu-server)
6. [Environment Variables Reference](#environment-variables-reference)

---

## Option 1: Render (Recommended — Free & Easiest)

Render provides free hosting for Node.js web services and reads the included `render.yaml` automatically.

### Steps:
1. Push this repository to **GitHub** or **GitLab**.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **"New +"** > **"Blueprint"** (or **"Web Service"**).
3. Connect your GitHub repository.
4. If using **Web Service** manually:
   - **Environment**: `Node`
   - **Build Command**: `npm install && cd server && npm install`
   - **Start Command**: `node server/server.js`
   - **Health Check Path**: `/api/books`
5. Click **"Create Web Service"**.
6. Render will automatically build, deploy, and provide a live `https://<your-app>.onrender.com` URL!

---

## Option 2: Railway

Railway automatically detects the `railway.json` and `Procfile`.

### Steps:
1. Go to [Railway.app](https://railway.app/) and sign in with GitHub.
2. Click **"New Project"** > **"Deploy from GitHub repo"**.
3. Select your repository.
4. Railway will automatically build and deploy your project.
5. In your project settings, click **"Generate Domain"** to get your public live URL.

---

## Option 3: Vercel (Serverless)

Vercel deployment is configured via `vercel.json` and `api/index.js`.

### Steps:
1. Install the Vercel CLI (optional) or use the Vercel web dashboard:
   ```bash
   npm i -g vercel
   vercel
   ```
2. Or import via the [Vercel Dashboard](https://vercel.com/new):
   - Select your GitHub repository.
   - Leave the root directory as `./`.
   - Click **Deploy**.

---

## Option 4: Docker & Docker Compose

For deploying on any Docker-enabled host (AWS EC2, DigitalOcean, Linode, Hetzner, etc.):

### Run with Docker Compose:
```bash
# Build and run the container in the background
docker compose up --build -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Run with Docker CLI:
```bash
# Build Docker image
docker build -t library-management-system .

# Run container on port 5000
docker run -d -p 5000:5000 --name library-system library-management-system
```

Your app will be live at `http://<your-server-ip>:5000`.

---

## Option 5: Traditional VPS or Ubuntu Server

If you have a Linux VPS (Ubuntu/Debian):

### 1. Install Node.js and PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 2. Clone and Install:
```bash
git clone <your-repo-url> /var/www/library-system
cd /var/www/library-system
npm install
cd server && npm install --production
```

### 3. Start with PM2:
```bash
pm2 start server/server.js --name "library-system"
pm2 startup
pm2 save
```

### 4. Optional: Nginx Reverse Proxy (for port 80/443 & SSL):
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for the HTTP server to listen on. |
| `NODE_ENV` | `production` | Environment mode (`development` or `production`). |
| `EMAIL_USER` | *(optional)* | Email sender address for SMTP reminder alerts. |
| `EMAIL_PASS` | *(optional)* | Email app password / SMTP password. |
| `VERCEL` | *(auto)* | Detected automatically when running on Vercel. |

---

## 🔐 Default Admin & Student Accounts

- **Admin Login**:
  - **Username**: `admin`
  - **Password**: `admin123`

- **Student Login**:
  - **Username**: `student`
  - **Password**: `student123`
