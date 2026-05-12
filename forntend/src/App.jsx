import React, { useState, useEffect, useRef } from 'react';
import bgImage from './images/background.png'
import './App.css'
import PlasmaBlob from './component/PlasmaBlob'
import Login from './component/Auth/Login'
import Signup from './component/Auth/Signup'
import Navbar from './component/Navbar'
import Terminal from './component/Terminal'
import { streamGroqResponse } from './services/groqService'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState('login'); // 'login' or 'signup'
  const [activeTab, setActiveTab] = useState('home');

  // Terminal / Conversation State
  const [messages, setMessages] = useState([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const conversationRef = useRef([]);

  const [blobConfig, setBlobConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('aura_blob_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          color: parsed.color || '#0084ff',
          size: typeof parsed.size === 'number' ? parsed.size : 1.0,
          position: parsed.position || { x: null, y: null }
        };
      }
    } catch (e) {
      console.error("Failed to parse config", e);
    }
    return { color: '#0084ff', size: 1.0, position: { x: null, y: null } };
  });

  const updateBlobConfig = (newConfig) => {
    const updated = { ...blobConfig, ...newConfig };
    setBlobConfig(updated);
    localStorage.setItem('aura_blob_config', JSON.stringify(updated));
  };

  // Dragging State
  const [isDragMode, setIsDragMode] = useState(false);
  const dragRef = useRef({ isDragging: false, currentX: 0, currentY: 0, lastX: 0, lastY: 0 });

  const handlePointerDown = (e) => {
    if (!isDragMode) return;
    dragRef.current.isDragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    
    // Capture the immediate rendered offset to prevent UI jumping
    if (blobConfig.position.x === null) {
      dragRef.current.currentX = e.currentTarget.offsetLeft;
      dragRef.current.currentY = e.currentTarget.offsetTop;
      
      setBlobConfig(prev => ({
        ...prev,
        position: { x: dragRef.current.currentX, y: dragRef.current.currentY }
      }));
    } else {
      dragRef.current.currentX = blobConfig.position.x;
      dragRef.current.currentY = blobConfig.position.y;
    }
    
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging) return;
    
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    
    dragRef.current.currentX += dx;
    dragRef.current.currentY += dy;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    
    setBlobConfig(prev => ({
      ...prev,
      position: { x: dragRef.current.currentX, y: dragRef.current.currentY }
    }));
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    e.target.releasePointerCapture(e.pointerId);
    updateBlobConfig({}); // trigger save to localStorage
  };

  useEffect(() => {
    const token = localStorage.getItem('aura_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('aura_token', token);
    setIsAuthenticated(true);
  };

  const handleSignup = (token) => {
    localStorage.setItem('aura_token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('aura_token');
    setIsAuthenticated(false);
  };
  // Called by PlasmaBlob as speech recognition progresses
  const handleInterimSpeech = (text) => {
    setLiveTranscript(text);
  };

  // Called by PlasmaBlob when a sentence is finalized
  const handleFinalSpeech = async (finalText) => {
    if (!finalText.trim()) return;

    setLiveTranscript('');

    // Add user message to conversation
    const userMsg = { role: 'user', content: finalText.trim() };
    const updatedHistory = [...conversationRef.current, userMsg];
    conversationRef.current = updatedHistory;
    setMessages([...updatedHistory]);

    // Start Groq streaming
    setIsThinking(true);
    let streamedText = '';

    await streamGroqResponse(
      finalText.trim(),
      conversationRef.current.slice(0, -1), // history excluding current msg
      (chunk) => {
        streamedText += chunk;
        // Add/update the in-progress assistant message
        setMessages([
          ...updatedHistory,
          { role: 'assistant', content: streamedText }
        ]);
      },
      (fullText) => {
        const assistantMsg = { role: 'assistant', content: fullText };
        conversationRef.current = [...updatedHistory, assistantMsg];
        setMessages([...conversationRef.current]);
        setIsThinking(false);
      }
    );
  };

  const handleMicStart = () => setIsListening(true);

  const switchToSignup = () => setAuthView('signup');
  const switchToLogin  = () => setAuthView('login');

  return (
    <>
      <img src={bgImage} alt="background" className="bg-image" />
      
      {!isAuthenticated ? (
        // Authentication Views
        <div className="app-container auth-wrapper">
          {authView === 'login' ? (
            <Login onLogin={handleLogin} onSwitchToSignup={switchToSignup} />
          ) : (
            <Signup onSignup={handleSignup} onSwitchToLogin={switchToLogin} />
          )}
        </div>
      ) : (
        // Main AI Assistant View
        <>
          <Terminal
            messages={messages}
            liveTranscript={liveTranscript}
            isListening={isListening}
            isThinking={isThinking}
            onSendMessage={handleFinalSpeech}
            onSpeakStart={() => setIsSpeaking(true)}
            onSpeakEnd={() => setIsSpeaking(false)}
          />
          <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <div className="app-container" style={{ marginTop: '80px', paddingTop: '40px', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
            
            {/* The Unconditionally Mounted Blob */}
            <div 
              className="orb-container" 
              style={{ 
                position: (blobConfig.position.x !== null || isDragMode) ? 'fixed' : (activeTab === 'home' ? 'relative' : 'fixed'),
                left: blobConfig.position.x !== null ? blobConfig.position.x : (activeTab === 'home' && !isDragMode ? 'auto' : '50%'),
                top: blobConfig.position.y !== null ? blobConfig.position.y : (activeTab === 'home' && !isDragMode ? 'auto' : '50%'),
                transform: (blobConfig.position.x === null && !isDragMode && activeTab !== 'home') ? 'scale(0.6)' : 'none',
                margin: (blobConfig.position.x !== null || isDragMode) ? 0 : (activeTab === 'home' ? '0 auto 40px auto' : '-50px auto -50px auto'),
                order: 3,
                zIndex: isDragMode ? 1000 : (blobConfig.position.x !== null ? 100 : 50),
                border: isDragMode ? '2px dashed var(--accent-1)' : 'none',
                cursor: isDragMode ? 'grab' : 'default',
                transition: isDragMode ? 'none' : 'z-index 0s, opacity 0.5s ease',
                touchAction: isDragMode ? 'none' : 'auto',
                pointerEvents: (!isDragMode && activeTab !== 'home' && blobConfig.position.x === null) ? 'none' : 'auto'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="orb-wrapper" style={{ pointerEvents: isDragMode ? 'none' : 'auto' }}>
                <PlasmaBlob
                  color={blobConfig.color}
                  size={blobConfig.size}
                  onInterimTranscript={handleInterimSpeech}
                  onFinalTranscript={handleFinalSpeech}
                  onMicStart={handleMicStart}
                  isSpeaking={isSpeaking}
                />
              </div>
            </div>

            {activeTab === 'home' && (
              <>
                <h1 className="title" style={{ order: 1 }}>Aura</h1>
                <p className="subtitle" style={{ order: 2 }}>Your intelligent, voice-activated assistant</p>

                <div className="features" style={{ order: 4 }}>
                  <div className="feature-card">
                    <div className="feature-icon">🎙️</div>
                    <div className="feature-title">Voice Recognition</div>
                    <div className="feature-desc">Speak naturally to interact with the intelligence.</div>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">⚡</div>
                    <div className="feature-title">Real-time Sync</div>
                    <div className="feature-desc">Instantaneous visual feedback to your voice.</div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'dashboard' && (
              <div style={{ width: '100%', textAlign: 'left', animation: 'slideUp 0.5s ease', order: 4 }}>
                <h2 className="title" style={{ fontSize: '2rem', marginBottom: '20px' }}>Dashboard</h2>
                <div className="feature-card" style={{ marginBottom: '20px' }}>
                  <div className="feature-icon">📊</div>
                  <div className="feature-title">Activity Overview</div>
                  <div className="feature-desc">Your AI interactions and usage metrics will appear here. No recent activity detected.</div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div style={{ width: '100%', textAlign: 'left', animation: 'slideUp 0.5s ease', order: 4 }}>
                <h2 className="title" style={{ fontSize: '2rem', marginBottom: '20px' }}>About Aura</h2>
                <div className="feature-card" style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.05)' }}>
                  <div className="feature-icon">🧠</div>
                  <div className="feature-title">System Information</div>
                  <div className="feature-desc">Aura is a cutting-edge interface powered by advanced neural architecture, designed to provide seamless voice-activated assistance and dynamic visualizations.</div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div style={{ width: '100%', textAlign: 'left', animation: 'slideUp 0.5s ease', order: 4 }}>
                <h2 className="title" style={{ fontSize: '2rem', marginBottom: '20px' }}>Settings</h2>
                <div className="feature-card" style={{ marginBottom: '20px' }}>
                  <div className="feature-icon">⚙️</div>
                  <div className="feature-title">Preferences</div>
                  <div className="feature-desc">Configure your voice profiles, theme settings, and connection properties in this panel.</div>
                </div>

                <div className="feature-card" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className="feature-icon">✨</div>
                  <div className="feature-title">Blob Configuration</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Color Hue</span>
                    <input 
                      type="color" 
                      value={blobConfig.color} 
                      onChange={(e) => updateBlobConfig({ color: e.target.value })} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '30px', width: '50px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Size ({blobConfig.size.toFixed(1)}x)</span>
                    <input 
                      type="range" 
                      min="0.5" max="2.0" step="0.1" 
                      value={blobConfig.size} 
                      onChange={(e) => updateBlobConfig({ size: parseFloat(e.target.value) })}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button 
                      onClick={() => setIsDragMode(!isDragMode)}
                      style={{ 
                        padding: '10px 15px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--accent-1)', 
                        background: isDragMode ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        flex: 1,
                        marginRight: '10px'
                      }}
                    >
                      {isDragMode ? 'Dragging... (Click to Save)' : 'Enable Drag Mode'}
                    </button>
                    <button 
                      onClick={() => updateBlobConfig({ position: { x: null, y: null } })}
                      style={{ 
                        padding: '10px 15px', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Position
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <button className="action-btn" onClick={handleLogout} style={{ marginTop: '30px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', width: '100%' }}>
              Log Out Session
            </button>
          </div>
        </>
      )}
    </>
  )
}

export default App
