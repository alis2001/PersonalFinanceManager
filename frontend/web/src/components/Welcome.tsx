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
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      color: 'white',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '50px' }}>
        Rapilot
      </h1>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          style={{
            backgroundColor: 'black',
            color: 'white',
            border: '2px solid white',
            padding: '15px 30px',
            fontSize: '1.2rem',
            borderRadius: '8px',
            cursor: 'pointer'
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
            cursor: 'pointer'
          }}
          onClick={() => navigate('/register')}
        >
          Register
        </button>
      </div>
      
      <p style={{ marginTop: '30px' }}>
        Mobile Test - If you see this, the component works!
      </p>
    </div>
  );
};

export default Welcome;