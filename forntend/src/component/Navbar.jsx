import React from 'react';
import './Navbar.css';

const Navbar = ({ activeTab, setActiveTab }) => {
  const navItems = ['Home', 'Dashboard', 'About', 'Settings'];

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <span className="logo-text">Aura</span>
      </div>
      <ul className="navbar-links">
        {navItems.map((item) => (
          <li 
            key={item} 
            className={`nav-item ${activeTab === item.toLowerCase() ? 'active' : ''}`}
            onClick={() => setActiveTab(item.toLowerCase())}
          >
            {item}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
