import React, { useEffect, useRef, useState } from 'react';
import './Terminal.css';

export default function Terminal({ messages, isListening, liveTranscript, isThinking, onSendMessage, onSpeakStart, onSpeakEnd }) {
  const bodyRef = useRef(null);
  const [chatInput, setChatInput] = useState('');
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const wasThinkingRef = useRef(false);

  // Auto-scroll to bottom on every update
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, liveTranscript, isThinking]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || isThinking) return;
    setChatInput('');
    if (onSendMessage) onSendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Speak the last Aura response when streaming completes
  useEffect(() => {
    if (wasThinkingRef.current && !isThinking && speakEnabled) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.content) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(lastMsg.content);
        utterance.lang  = 'en-GB';   // British English for Jarvis-style delivery
        utterance.rate  = 0.95;      // slightly measured, deliberate pacing
        utterance.pitch = 0.9;       // slightly lower pitch = more authoritative
        // Prefer the most Jarvis-like voice available
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v =>
          v.lang.startsWith('en') && (
            v.name.includes('Daniel') ||
            v.name.includes('Google UK English Male') ||
            v.name.includes('Microsoft Ryan') ||
            v.name.includes('Arthur') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Natural')
          )
        );
        if (preferred) utterance.voice = preferred;
        utterance.onstart = () => { if (onSpeakStart) onSpeakStart(); };
        utterance.onend   = () => { if (onSpeakEnd)   onSpeakEnd(); };
        utterance.onerror = () => { if (onSpeakEnd)   onSpeakEnd(); };
        window.speechSynthesis.speak(utterance);
      }
    }
    wasThinkingRef.current = isThinking;
  }, [isThinking, speakEnabled, messages]);

  return (
    <div className="terminal-container">
      {/* Header Bar */}
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="tdot red" />
          <span className="tdot yellow" />
          <span className="tdot green" />
        </div>
        <span className="terminal-title">AURA_NEURAL_LINK v2.4</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Voice toggle */}
          <button
            onClick={() => {
              if (speakEnabled) window.speechSynthesis.cancel();
              setSpeakEnabled(p => !p);
            }}
            title={speakEnabled ? 'Mute Aura voice' : 'Enable Aura voice'}
            style={{
              background: speakEnabled ? 'rgba(0,255,225,0.18)' : 'transparent',
              border: `1px solid ${speakEnabled ? 'rgba(0,255,225,0.6)' : 'rgba(0,255,225,0.2)'}`,
              borderRadius: '6px',
              color: speakEnabled ? '#00ffe1' : 'rgba(0,255,225,0.4)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '2px 7px',
              lineHeight: 1.4,
              transition: 'all 0.2s',
            }}
          >
            {speakEnabled ? '🔊' : '🔇'}
          </button>
          <div className="t-status">
            <span
              className="dot"
              style={{
                backgroundColor: isListening ? '#00ffe1' : '#ff3366',
                animation: isListening ? 'pulse 1.5s infinite ease-in-out' : 'none'
              }}
            />
            {isThinking ? 'PROCESSING' : isListening ? 'LISTENING' : 'STANDBY'}
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="terminal-body" ref={bodyRef}>
        {messages.length === 0 && !liveTranscript && (
          <div className="terminal-placeholder">
            {'> '}{isListening ? 'Awaiting vocal input...' : 'Tap mic to initialize neural link.'}
            {isListening && <span className="cursor-blink" />}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`terminal-msg ${msg.role}`}>
            <span className="msg-prefix">
              {msg.role === 'user' ? '[ YOU ]' : '[ AURA ]'}
            </span>
            <span className="msg-content">{msg.content}</span>
          </div>
        ))}

        {/* Live transcript while user is speaking */}
        {liveTranscript && (
          <div className="terminal-msg user live">
            <span className="msg-prefix">[ YOU ]</span>
            <span className="msg-content">
              {liveTranscript}
              <span className="cursor-blink" />
            </span>
          </div>
        )}

        {/* Thinking dots while waiting for Groq */}
        {isThinking && (
          <div className="terminal-msg assistant thinking">
            <span className="msg-prefix">[ AURA ]</span>
            <span className="msg-content">
              <span className="thinking-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Chat Input Bar */}
      <div className="terminal-input-bar">
        <input
          type="text"
          className="terminal-input"
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
        />
        <button
          className="terminal-send-btn"
          onClick={handleSend}
          disabled={isThinking || !chatInput.trim()}
          title="Send message"
        >
          {isThinking ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}
