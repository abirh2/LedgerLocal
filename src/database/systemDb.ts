import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { UserProfile, UserSettings } from '../models/types';

interface SystemDB extends DBSchema {
  profiles: {
    key: string;
    value: UserProfile;
  };
  settings: {
    key: string;
    value: { id: string } & UserSettings;
  };
  state: {
    key: string;
    value: { id: 'app_state', currentProfileId: string };
  };
}

let systemDbPromise: Promise<IDBPDatabase<SystemDB>>;

export const DEFAULT_SETTINGS: UserSettings = {
  currency: 'USD',
  locale: 'en-US',
  dateFormat: 'MM/dd/yyyy',
  numberFormat: 'standard',
  firstDayOfWeek: 0,
  defaultReportingPeriod: 'this_month',
  fiscalYearStartMonth: 1,
  density: 'comfortable',
  sidebarCollapsed: false,
  defaultTransactionColumns: ['date', 'merchant', 'category', 'amount'],
  reducedMotion: false,
  theme: 'light',
  importDuplicates: 'skip',
  retainRawImportRows: false,
  retainSourceFile: false,
  defaultDuplicateBehavior: 'skip',
  requireImportConfirmation: true
};

export function initSystemDB() {
  if (!systemDbPromise) {
    systemDbPromise = openDB<SystemDB>('ledger-local-system', 1, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('state', { keyPath: 'id' });
      },
    });
  }
  return systemDbPromise;
}

export const systemApi = {
  async getProfiles() {
    const db = await initSystemDB();
    return db.getAll('profiles');
  },
  async putProfile(profile: UserProfile) {
    const db = await initSystemDB();
    await db.put('profiles', profile);
  },
  async deleteProfile(id: string) {
    const db = await initSystemDB();
    await db.delete('profiles', id);
    // Also delete the associated database
    const indexedDB = window.indexedDB;
    if (indexedDB) {
      indexedDB.deleteDatabase(`ledger-local-profile-${id}`);
    }
  },
  async getCurrentProfileId() {
    const db = await initSystemDB();
    const state = await db.get('state', 'app_state');
    if (!state) {
      // Create default profile if none exists
      const defaultId = 'default';
      await db.put('state', { id: 'app_state', currentProfileId: defaultId });
      const profiles = await db.getAll('profiles');
      if (profiles.length === 0) {
        await db.put('profiles', {
          id: defaultId,
          name: 'Personal',
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString()
        });
      }
      return defaultId;
    }
    return state.currentProfileId;
  },
  async setCurrentProfileId(id: string) {
    const db = await initSystemDB();
    await db.put('state', { id: 'app_state', currentProfileId: id });
    const profile = await db.get('profiles', id);
    if (profile) {
      profile.lastUsedAt = new Date().toISOString();
      await db.put('profiles', profile);
    }
  },
  async getSettings(profileId: string) {
    const db = await initSystemDB();
    const settings = await db.get('settings', profileId);
    return settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
  },
  async putSettings(profileId: string, settings: UserSettings) {
    const db = await initSystemDB();
    await db.put('settings', { ...settings, id: profileId });
  }
};
