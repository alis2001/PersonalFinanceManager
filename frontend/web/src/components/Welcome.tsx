import React from 'react';
import { useNavigate } from 'react-router-dom';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      backgroundColor: '#1a1a1a',
      color: 'white',
      padding: '20px',
      paddingTop: '15vh'
    }}>
      {/* Large Curved Rapilot Title */}
      <h1 style={{
        fontSize: 'clamp(4rem, 8vw, 7rem)',
        marginBottom: '12vh',
        background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7, #dda0dd)',
        backgroundSize: '300% 300%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'rainbow 3s ease-in-out infinite',
        fontWeight: '300',
        textAlign: 'center',
        letterSpacing: '-0.02em',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        transform: 'perspective(500px) rotateX(15deg)',
        textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.1))'
      }}>
        Rapilot
      </h1>
      
      {/* Side by Side Buttons with Hover */}
      <div style={{
        display: 'flex',
        gap: '30px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button 
          style={{
            backgroundColor: 'black',
            color: 'white',
            border: '2px solid white',
            padding: '18px 40px',
            fontSize: '1.2rem',
            fontWeight: '600',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '150px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#333333';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'black';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={() => navigate('/login')}
        >
          Login
        </button>
        
        <button 
          style={{
            backgroundColor: 'white',
            color: 'black',
            border: '2px solid black',
            padding: '18px 40px',
            fontSize: '1.2rem',
            fontWeight: '600',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '150px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={() => navigate('/register')}
        >
          Register
        </button>
      </div>
      
      {/* CSS Animation for Rainbow Effect */}
      <style>{`
        @keyframes rainbow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @media (max-width: 768px) {
          div[style*="gap: 30px"] {
            flex-direction: column;
            gap: 20px !important;
            width: 100%;
          }
          
          button {
            width: 100% !important;
            max-width: 250px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Welcome;