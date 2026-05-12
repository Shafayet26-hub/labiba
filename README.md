# Labiba AI Assistant

An AI assistant app with a React frontend and Express backend.

## Structure
- `forntend/` — Vite/React frontend (deploy to Netlify)
- `backend/` — Express + SQLite backend (deploy to Railway)

## Local Development

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd forntend
npm install
npm run dev
```

## Deployment
- **Backend** → [Railway](https://railway.app)
- **Frontend** → [Netlify](https://netlify.com)

### Environment Variables

**Railway (Backend):**
- `SECRET_KEY` — JWT secret key
- `FRONTEND_URL` — Your Netlify URL

**Netlify (Frontend):**
- `VITE_API_URL` — Your Railway backend URL
- `VITE_GROQ_API_KEY` — Your Groq API key
