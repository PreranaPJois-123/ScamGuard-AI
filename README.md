# ScamGuard — AI-Powered Online Scam & Fraud Detection System

ScamGuard is a full-stack, production-grade cybersecurity intelligence platform designed to detect phishing attacks, lottery fraud, UPI/banking scams, and social engineering in real time using Machine Learning and Explainable AI (XAI).

---

## 🌐 Live Production Demo

- **Frontend & App URL**: [https://frontend-psi-ebon-83.vercel.app](https://frontend-psi-ebon-83.vercel.app)
- **Backend API Base**: [https://scamguard-app-service.onrender.com](https://scamguard-app-service.onrender.com)
- **Backend Health Check**: [https://scamguard-app-service.onrender.com/api/v1/health](https://scamguard-app-service.onrender.com/api/v1/health)
- **ML Service Health Check**: [https://scamguard-ml-service.onrender.com/api/v1/health](https://scamguard-ml-service.onrender.com/api/v1/health)

> **Note on Free-Tier Sleep:** Render instances spin down after 15 minutes of inactivity. If testing after an idle period, allow 30–45 seconds for initial wake-up. The frontend is configured with generous 60-second timeouts to handle cold-starts smoothly.

---

## 🎯 Key Capabilities & Production Features

- **Real-Time Detection**: Classifies messages as legitimate or scam with high-confidence probability scores using scikit-learn models (Naive Bayes & TF-IDF).
- **Explainable AI (XAI)**: Identifies top contributing tokens/keywords, threat scores, risk dimensions (urgency, financial risk, credential theft, etc.), and suggested next steps.
- **Multi-Channel Scanners**: Supports raw text, URLs, emails (.eml/text), screenshot/image OCR, document PDFs, and QR codes.
- **Live Camera / Optical Scanner**: In-browser device camera viewfinder for real-time capture of printed phishing letters, SMS on secondary phones, or physical QR codes.
- **Enterprise Authentication**: Secure user registration, login, JWT access/refresh token rotation, bcrypt password hashing, and Role-Based Access Control (RBAC).
- **Comprehensive Settings Suite**:
  - **Profile Management**: Update display name, view role, and switch themes.
  - **Account Security**: Change password with live strength validation (8+ chars, uppercase, digit) and show/hide toggles.
  - **Detection Preferences**: Auto-save toggles, default input channels, and visual warning alerts.
  - **Privacy & Data Controls**: One-click JSON data export (GDPR-compliant) and irreversible history purging.
  - **Danger Zone**: Secure account deletion requiring strict typed confirmation (DELETE).
- **Scan History & Analytics**: Filterable history, CSV report generation, accuracy feedback loops, and live statistical distribution charts.
- **System Administration**: Live cluster telemetry from PostgreSQL, verified user directory, and threat volume tracking.

---

## 🏗️ System Architecture

`mermaid
graph TD
    Client[Web Browser] -->|HTTPS| Frontend[Next.js 14 Frontend - Vercel / Port 3000]
    Frontend -->|Same-Origin /backend-api Rewrite| AppService[FastAPI App Service - Port 8000]
    AppService -->|SQLAlchemy / Alembic| DB[(PostgreSQL / SQLite)]
    AppService -->|HTTP JSON /internal/predict| MLService[FastAPI ML Inference Service - Port 8002]
    MLService -->|Joblib Serialization| ModelRegistry[(Trained ML Artifacts - Naive Bayes / TF-IDF)]
`

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+ LTS
- **Python**: v3.10, v3.11, or v3.12
- **Docker & Docker Compose**: Optional (recommended for one-command containerized run)

---

### Option A: One-Command Startup with Docker Compose (Recommended)

From the project root directory, run:

`ash
docker compose up --build
`

This starts all services together:
- **Web UI**: [http://localhost:3000](http://localhost:3000) (or via Nginx on port 80)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ML Service**: [http://localhost:8002](http://localhost:8002)
- **PostgreSQL**: localhost:5432

---

### Option B: Local Setup Without Docker (VS Code / Terminal)

Open **three terminal windows** in your IDE/command prompt:

#### Terminal 1 — Backend App Service
`ash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
# Starts on http://localhost:8000 (uses local SQLite database automatically if PostgreSQL is not set)
uvicorn app_service.main:app --port 8000 --reload
`

#### Terminal 2 — ML Inference Service
`ash
cd backend
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements-ml.txt
# Starts on http://localhost:8002 (uses pre-trained models bundled in backend/artifacts)
uvicorn ml_service.main:app --port 8002 --reload
`

#### Terminal 3 — Frontend UI
`ash
cd frontend
npm install
npm run dev
`
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Testing and Verification

The project includes an automated test suite with **158 unit and integration tests**.

Run all tests:
`ash
cd backend
python -m pytest tests -v
python -m pytest ml_service/tests -v
python -m pytest ml_common/tests ml_training/tests -v
`

---

## 📁 Repository Structure

```
ScamGuard-AI/
├── docker-compose.yml          # Root one-command multi-container setup
├── backend/
│   ├── app_service/            # Core business logic, auth, REST API routes
│   │   ├── api/v1/             # Endpoints: auth, messages, users, health
│   │   ├── core/               # Config, JWT security, exceptions, rate-limiting
│   │   ├── db/                 # Models, database session, SQLite/PostgreSQL
│   │   └── services/           # Business logic & extraction service
│   ├── ml_service/             # Dedicated ML inference microservice
│   ├── ml_training/            # ML model training scripts & datasets
│   ├── ml_common/              # Shared NLP tokenizers, TF-IDF vectorizers
│   ├── artifacts/              # Bundled trained ML model weights & metadata
│   ├── requirements.txt        # App service dependencies
│   └── requirements-ml.txt     # ML service dependencies
├── frontend/                   # Next.js 14 React frontend with Tailwind CSS
│   ├── src/app/                # App router: login, register, dashboard, analyze, settings
│   ├── src/components/         # Reusable UI widgets, badges, verdict cards, camera scanner
│   └── src/lib/api/            # Typed API client with auto token refresh
├── infra/
│   └── docker/                 # Dockerfiles for each microservice
└── docs/                       # Architecture documentation and specs
```

---

## 🔒 Security Best Practices

- Passwords hashed using bcrypt.
- JWT access tokens with short expiry (15m) + secure refresh token rotation (7d).
- Strict Content Security Policy (CSP) & CORS configuration.
- Rate-limiting enabled via SlowAPI on sensitive auth & prediction routes.
- Privacy-first in-memory vectorization: message content is never sold or used for model retraining without consent.

---

## 👤 Author & Project Maintainer

- **Project Lead & Author**: **Prerna P Joyce** ([@PreranaPJois-123](https://github.com/PreranaPJois-123))
- **Repository**: [https://github.com/PreranaPJois-123/ScamGuard-AI](https://github.com/PreranaPJois-123/ScamGuard-AI)
- **Project**: ScamGuard AI — AI-Powered Online Scam & Fraud Detection System
