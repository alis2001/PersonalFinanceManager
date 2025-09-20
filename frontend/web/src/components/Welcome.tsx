import React from 'react';
import { useNavigate } from 'react-router-dom';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      maxHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      color: 'white',
      padding: '20px',
      overflow: 'hidden'
    }}>
      <h1 style={{ 
        fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', 
        marginBottom: 'clamp(6vh, 8vh, 10vh)',
        marginTop: '0',
        textAlign: 'center',
        textShadow: '0 0 15px #ffffff, 0 0 30px #ffffff, 0 0 45px #ffffff',
        animation: 'relaxedWave 6s ease-in-out infinite',
        fontWeight: 'bold'
      }}>
        Rapilot
      </h1>
      
      <style>{`
        @keyframes relaxedWave {
          0% {
            text-shadow: 0 0 15px #ffffff, 0 0 30px #ffffff, 0 0 45px #ffffff;
            color: #ffffff;
          }
          25% {
            text-shadow: 0 0 10px #cccccc, 0 0 20px #cccccc, 0 0 35px #cccccc;
            color: #cccccc;
          }
          50% {
            text-shadow: 0 0 8px #aaaaaa, 0 0 15px #aaaaaa, 0 0 25px #aaaaaa;
            color: #aaaaaa;
          }
          75% {
            text-shadow: 0 0 12px #dddddd, 0 0 25px #dddddd, 0 0 40px #dddddd;
            color: #dddddd;
          }
          100% {
            text-shadow: 0 0 15px #ffffff, 0 0 30px #ffffff, 0 0 45px #ffffff;
            color: #ffffff;
          }
        }
      `}</style>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          style={{
            backgroundColor: 'black',
            color: 'white',
            border: '2px solid white',
            padding: '15px 30px',
            fontSize: '1.2rem',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#333333';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 255, 255, 0.3)';
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
            padding: '15px 30px',
            fontSize: '1.2rem',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
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
    </div>
  );
};

export default Welcome;