import React, { useState } from 'react';
import './Auth.css';
import API_BASE_URL from '../../config';

const Signup = ({ onSignup, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to initialize link.');
      } else {
        onSignup(data.token); // Pass token up
      }
    } catch (err) {
      setError('Server unreachable.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h2 className="auth-title">Initialize Link</h2>
        <p className="auth-subtitle">Create your unique neural profile.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="name">Display Name</label>
          <input
            id="name"
            type="text"
            className="auth-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            className="auth-input"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="password">Security Key</label>
          <input
            id="password"
            type="password"
            className="auth-input"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="confirmPassword">Verify Key</label>
          <input
            id="confirmPassword"
            type="password"
            className="auth-input"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="auth-button">
          Establish Connection
        </button>
      </form>

      <div className="auth-footer">
        Already have a profile?
        <span className="auth-link" onClick={onSwitchToLogin}>
          Authenticate
        </span>
      </div>
    </div>
  );
};

export default Signup;
