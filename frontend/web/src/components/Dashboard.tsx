import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/Dashboard.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const profile = await authService.getProfile();
    if (profile) {
      setUser(profile);
    } else {
      navigate('/login');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="dashboard loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">💰</span>
            <h1>FinanceTracker</h1>
          </div>
          <div className="user-menu">
            <span className="welcome">Welcome, {user?.firstName}!</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <h3>Total Expenses</h3>
                <p className="stat-value">$0.00</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💵</div>
              <div className="stat-info">
                <h3>Total Income</h3>
                <p className="stat-value">$0.00</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <h3>Balance</h3>
                <p className="stat-value">$0.00</p>
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <button className="btn-action">
                <span>➕</span>
                Add Expense
              </button>
              <button className="btn-action">
                <span>💰</span>
                Add Income
              </button>
              <button className="btn-action">
                <span>📊</span>
                View Analytics
              </button>
            </div>
          </div>

          <div className="recent-activity">
            <h2>Recent Activity</h2>
            <div className="activity-placeholder">
              <p>No transactions yet. Start by adding your first expense or income!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;