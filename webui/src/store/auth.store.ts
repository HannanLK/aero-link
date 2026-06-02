import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole =
  | 'PASSENGER'
  | 'GATE_AGENT'
  | 'CHECK_IN_STAFF'
  | 'BAGGAGE_HANDLER'
  | 'FLIGHT_OPS'
  | 'FLIGHT_ATTENDANT'
  | 'AIRCRAFT_CREW'
  | 'IMMIGRATION_OFFICER'
  | 'ADMIN';

interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  exp: number;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtPayload | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => {
        const user = parseJwt(accessToken);
        set({ accessToken, refreshToken, user });
      },
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
    }),
    { name: 'aerolink-auth' },
  ),
);
