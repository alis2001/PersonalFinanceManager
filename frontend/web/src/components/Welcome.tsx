import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Welcome.css';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome">
      <div className="popup-overlay">
        <div className="popup-content">
          <div className="popup-header">
            <div className="logo-popup">
              <h1 className="popup-title">FinanceTracker</h1>
              <div className="title-underline"></div>
            </div>
            
            <div className="slogan-container">
              <h2 className="main-slogan">Simple. Fast. Professional.</h2>
              <div className="sub-slogans">
                <p className="sub-slogan delay-1">Take Control of Your Financial Future</p>
                <p className="sub-slogan delay-2">Track Every Dollar, Build Every Dream</p>
                <p className="sub-slogan delay-3">Professional Tools for Personal Success</p>
              </div>
            </div>

            <div className="popup-features">
              <div className="popup-feature delay-4">
                <div className="feature-box">
                  <h4>Advanced Analytics</h4>
                </div>
              </div>
              <div className="popup-feature delay-5">
                <div className="feature-box">
                  <h4>Smart Tracking</h4>
                </div>
              </div>
              <div className="popup-feature delay-6">
                <div className="feature-box">
                  <h4>Growth Insights</h4>
                </div>
              </div>
            </div>

            <div className="loading-indicator delay-7">
              <div className="loading-text">Ready to start your financial journey?</div>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>

            {/* Beautiful Buttons inside the popup */}
            <div className="popup-action-buttons delay-8">
              <button 
                className="btn-primary"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
              <button 
                className="btn-secondary"
                onClick={() => navigate('/register')}
              >
                Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;