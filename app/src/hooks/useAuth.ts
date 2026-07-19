import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/authContext';

/**
 * Read the global auth state from anywhere in the tree.
 * Throws if used outside <AuthProvider> so mistakes fail loudly in dev.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
