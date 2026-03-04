import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'expense-control-theme';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) || 'dark') : 'dark';
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  const setTheme = (next) => {
    setThemeState((prev) => (next === 'light' || next === 'dark' ? next : prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
