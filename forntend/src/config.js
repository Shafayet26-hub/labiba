// API base URL — set VITE_API_URL in Netlify environment variables
// pointing to your Railway backend URL (e.g. https://labiba-backend.railway.app)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default API_BASE_URL;
