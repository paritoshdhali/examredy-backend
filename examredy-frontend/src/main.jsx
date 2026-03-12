import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import api from './services/api' // Make sure api service is imported

const RootApp = () => {
    const [clientId, setClientId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                console.log("[INIT] Fetching settings from:", api.defaults.baseURL);
                const res = await api.get('/settings');
                console.log("[INIT] Settings received:", res.data);
                setClientId(res.data.GOOGLE_CLIENT_ID || '');
            } catch (error) {
                console.error("[INIT] Failed to load settings:", error);
                setInitError(error.message || "Failed to connect to backend");
                setClientId('');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Global Error Catcher for rendering errors
    if (initError && !loading) {
        return (
            <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-10 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Critical Initialization Error</h1>
                <p className="text-gray-700 font-mono bg-white p-4 rounded border border-red-200">{initError}</p>
                <div className="mt-4 text-[10px] text-gray-400 font-mono">Backend: {api.defaults.baseURL}</div>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg">Retry</button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Booting ExamRedy Engine...</p>
                </div>
            </div>
        );
    }

    try {
        return (
            <GoogleOAuthProvider clientId={clientId || "dummy_client_id_to_prevent_crash"}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </GoogleOAuthProvider>
        );
    } catch (renderError) {
        return (
            <div className="p-20 text-red-500 font-bold">
                Render Error: {renderError.message}
            </div>
        );
    }
};

// Global sink for unhandled errors
window.onerror = function(msg, url, line, col, error) {
    const errorInfo = document.createElement('div');
    errorInfo.style.cssText = 'position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.8);color:white;padding:10px;font-family:monospace;z-index:9999;font-size:10px;border-radius:5px;';
    errorInfo.innerText = 'Runtime Error: ' + msg + (line ? ' (Line: ' + line + ')' : '');
    document.body.appendChild(errorInfo);
    return false;
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <RootApp />
    </React.StrictMode>,
)
