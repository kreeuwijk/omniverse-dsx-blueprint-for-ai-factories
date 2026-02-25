/**
 * MockAuthProvider - Provides fake auth context for local streaming mode
 * This allows components that use useAuth() to work without real OIDC
 */

import { ReactNode } from "react";
import { AuthContext, AuthContextProps } from "react-oidc-context";

// Mock user object
const mockUser = {
  profile: {
    sub: "local-user",
    name: "Local User",
    given_name: "Local",
    family_name: "User",
    email: "local@localhost",
  },
  access_token: "mock-token",
  id_token: "mock-id-token",  // Required by AgentPanel for chat auth check
  token_type: "Bearer",
  expires_at: Date.now() + 3600000,
  expired: false,
  scopes: ["openid", "profile", "email"],
  toStorageString: () => "{}",
};

// Mock auth context value
const mockAuthContext: AuthContextProps = {
  // User state
  user: mockUser as any,
  isLoading: false,
  isAuthenticated: true,
  error: undefined,

  // Auth actions (no-ops for local mode)
  signinRedirect: async () => {},
  signinSilent: async () => mockUser as any,
  signinPopup: async () => mockUser as any,
  signinResourceOwnerCredentials: async () => mockUser as any,
  signoutRedirect: async () => {},
  signoutPopup: async () => {},
  signoutSilent: async () => {},
  removeUser: async () => {},

  // Settings
  settings: {} as any,
  events: {} as any,
  clearStaleState: async () => {},
  querySessionStatus: async () => ({} as any),
  revokeTokens: async () => {},
  startSilentRenew: () => {},
  stopSilentRenew: () => {},

  // Additional required properties
  activeNavigator: undefined,
};

interface MockAuthProviderProps {
  children: ReactNode;
}

export function MockAuthProvider({ children }: MockAuthProviderProps) {
  return (
    <AuthContext.Provider value={mockAuthContext}>
      {children}
    </AuthContext.Provider>
  );
}

export default MockAuthProvider;
