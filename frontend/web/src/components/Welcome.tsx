import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Welcome.css';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome">
      <div className="welcome-content">
        <div className="logo">
          <span className="logo-icon">💰</span>
          <h1>FinanceTracker</h1>
        </div>
        
        <p className="tagline">Simple. Fast. Professional.</p>
        
        <div className="features">
          <div className="feature">
            <span>📊</span>
            <h3>Track</h3>
          </div>
          <div className="feature">
            <span>💵</span>
            <h3>Manage</h3>
          </div>
          <div className="feature">
            <span>📈</span>
            <h3>Analyze</h3>
          </div>
        </div>

        <button 
          className="btn-primary"
          onClick={() => navigate('/login')}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default Welcome;