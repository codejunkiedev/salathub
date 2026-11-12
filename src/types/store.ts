import type {
  DisplayScreen,
  MasjidBilling,
  MasjidProfile,
  MasjidVerification,
  MemberRole,
} from './supabase';

export type DisplayStore = {
  loggedIn: boolean;
  setLoggedIn: (loggedIn: boolean) => void;
  masjidProfile: MasjidProfile | null;
  setMasjidProfile: (masjidProfile: MasjidProfile | null) => void;
  displayScreen: DisplayScreen | null;
  setDisplayScreen: (displayScreen: DisplayScreen | null) => void;
  signOut: () => void;
};

export type AuthStore = {
  masjidId: string | null;
  role: MemberRole | null;
  isPlatformAdmin: boolean;
  setAuth: (masjidId: string | null, role: MemberRole) => void;
  setPlatformAdmin: (isPlatformAdmin: boolean) => void;
  clearAuth: () => void;
};

export type VerificationStore = {
  verification: MasjidVerification | null;
  /** The masjid the loaded status belongs to, so a different account reloads it. */
  loadedFor: string | null;
  setVerification: (masjidId: string, verification: MasjidVerification | null) => void;
};

export type BillingStore = {
  billing: MasjidBilling | null;
  /** The masjid the loaded billing belongs to, so a different account reloads it. */
  loadedFor: string | null;
  setBilling: (masjidId: string, billing: MasjidBilling | null) => void;
};
