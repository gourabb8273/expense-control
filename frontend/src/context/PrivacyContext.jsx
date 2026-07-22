import { createContext, useContext, useEffect, useState } from 'react';

const PrivacyContext = createContext(null);

const STORAGE_KEY = 'expense-control-hide-amounts';

export function PrivacyProvider({ children }) {
  const [hideAmounts, setHideAmounts] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    document.body.setAttribute('data-hide-amounts', hideAmounts ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, hideAmounts ? 'true' : 'false');
    }
  }, [hideAmounts]);

  const toggleHideAmounts = () => setHideAmounts((v) => !v);

  return (
    <PrivacyContext.Provider value={{ hideAmounts, setHideAmounts, toggleHideAmounts }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
