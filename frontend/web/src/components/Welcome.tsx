import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Welcome.css';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome">
      <div className="popup-overlay">
        <div className="popup-content">
          <div className="popup-header">
            {/* Rainbow Curved Rapilot Title */}
            <div className="logo-popup">
              <h1 className="rainbow-title">Rapilot</h1>
            </div>
            
            {/* Side by Side Buttons */}
            <div className="welcome-buttons">
              <button 
                className="btn-black"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
              <button 
                className="btn-white"
                onClick={() => navigate('/register')}
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;