class AuthService {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/auth';

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (response.ok) {
      this.setTokens(data.tokens);
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  }

  async register(userData: any) {
    const response = await fetch(`${this.baseURL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    
    if (response.ok) {
      this.setTokens(data.tokens);
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  }

  async logout() {
    const token = this.getAccessToken();
    
    if (token) {
      try {
        await fetch(`${this.baseURL}/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Logout failed:', err);
      }
    }

    this.clearTokens();
  }

  async getProfile() {
    const token = this.getAccessToken();
    
    if (!token) return null;

    try {
      const response = await fetch(`${this.baseURL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
    } catch (err) {
      console.error('Get profile failed:', err);
    }

    return null;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  private setTokens(tokens: any) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  private clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

export default new AuthService();