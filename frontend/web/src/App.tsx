// Update frontend/web/src/App.tsx to add the new route

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './components/Welcome';
import Login from './components/Login';
import Register from './components/Register';
import VerifyEmail from './components/VerifyEmail';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import AllTransactions from './components/AllTransactions';
import authService from './services/authService';
import translationService from './services/translationService';
import './styles/App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  useEffect(() => {
    // Initialize translation service and load user language preference
    const initializeTranslation = async () => {
      if (authService.isAuthenticated()) {
        await translationService.loadUserLanguageFromBackend();
      }
    };
    
    initializeTranslation();
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } 
          />

          {/* NEW ROUTE: All Transactions */}
          <Route 
            path="/transactions" 
            element={
              <ProtectedRoute>
                <AllTransactions />
              </ProtectedRoute>
            } 
          />

          {/* NEW ROUTE: Category Management */}
          
          {/* Redirect unknown routes to welcome */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;