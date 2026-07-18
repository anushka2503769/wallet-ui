import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const USERS_KEY = 'tradeflow_users';
const SESSION_KEY = 'tradeflow_session';

// Seed a single demo admin account the first time the app ever runs.
// Everyone who registers through the Register page becomes role: 'user'.
function seedUsers() {
  const existing = localStorage.getItem(USERS_KEY);
  if (existing) return JSON.parse(existing);

  const seeded = [
    {
      email: 'admin@tradeflow.io',
      password: 'admin123',
      displayName: 'Admin',
      role: 'admin'
    }
  ];

  localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
  return seeded;
}

function toSession(u) {
  return {
    email: u.email,
    displayName: u.displayName || u.email.split('@')[0],
    role: u.role
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedUsers();

    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      setUser(JSON.parse(session));
    }
    setLoading(false);
  }, []);

  const login = ({ email, password }) => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const match = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!match) {
      throw new Error('Invalid email or password.');
    }

    const session = toSession(match);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  };

  const register = ({ email, password }) => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with that email already exists.');
    }

    // New sign-ups are always regular users — only the seeded
    // account (or another admin promoted by editing localStorage)
    // gets the admin role. Display name defaults to whatever's
    // before the @ in their email; they can change it in Settings.
    const newUser = {
      email,
      password,
      displayName: email.split('@')[0],
      role: 'user'
    };

    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));

    const session = toSession(newUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  // Settings page → "Profile Information" card. Updates display
  // name and/or email for the currently signed-in account.
  const updateProfile = ({ displayName, email }) => {
    if (!user) throw new Error('Not signed in.');

    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

    if (
      email.toLowerCase() !== user.email.toLowerCase() &&
      users.some((u) => u.email.toLowerCase() === email.toLowerCase())
    ) {
      throw new Error('That email is already in use by another account.');
    }

    const updatedUsers = users.map((u) =>
      u.email.toLowerCase() === user.email.toLowerCase()
        ? { ...u, displayName, email }
        : u
    );

    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));

    const session = { email, displayName, role: user.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  };

  // Settings page → "Password" card.
  const changePassword = ({ currentPassword, newPassword }) => {
    if (!user) throw new Error('Not signed in.');

    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const existing = users.find(
      (u) => u.email.toLowerCase() === user.email.toLowerCase()
    );

    if (!existing || existing.password !== currentPassword) {
      throw new Error('Current password is incorrect.');
    }

    const updatedUsers = users.map((u) =>
      u.email.toLowerCase() === user.email.toLowerCase()
        ? { ...u, password: newPassword }
        : u
    );

    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}