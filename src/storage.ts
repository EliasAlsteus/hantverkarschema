import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client, Job } from './types';
import { geocodeAddress } from './utils/geocode';

const CLIENTS_KEY = '@carpenter_clients';
const JOBS_KEY = '@carpenter_jobs';
const SETTINGS_KEY = '@carpenter_settings';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export type AppSettings = {
  homeAddress: string;
  homeLat: number;
  homeLng: number;
  maxDriveKm: number;
  userName: string;
  onboardingDone: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  homeAddress: '',
  homeLat: 0,
  homeLng: 0,
  maxDriveKm: 60,
  userName: '',
  onboardingDone: false,
};

export const getSettings = async (): Promise<AppSettings> => {
  const data = await AsyncStorage.getItem(SETTINGS_KEY);
  return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
};

export const saveSettings = async (s: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
};

export const saveClient = async (client: Omit<Client, 'id' | 'jobs' | 'email'> & { email?: string }): Promise<Client> => {
  const newClient: Client = { email: '', ...client, id: generateId(), jobs: [] };
  const existing = await getClients();
  await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify([...existing, newClient]));
  return newClient;
};

export const getClients = async (): Promise<Client[]> => {
  const data = await AsyncStorage.getItem(CLIENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const updateClient = async (client: Client): Promise<void> => {
  const clients = await getClients();
  const index = clients.findIndex(c => c.id === client.id);
  if (index !== -1) {
    clients[index] = client;
    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }
};

export const deleteClient = async (clientId: string): Promise<void> => {
  const clients = await getClients();
  await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(clients.filter(c => c.id !== clientId)));
};

export const saveJob = async (job: Omit<Job, 'id'>): Promise<Job> => {
  const newJob: Job = { ...job, id: generateId(), createdAt: new Date().toISOString() };
  const existing = await getJobs();
  await AsyncStorage.setItem(JOBS_KEY, JSON.stringify([...existing, newJob]));
  return newJob;
};

export const getJobs = async (): Promise<Job[]> => {
  const data = await AsyncStorage.getItem(JOBS_KEY);
  if (!data) return [];
  const jobs: Job[] = JSON.parse(data);
  // Migrate old status values from before the 3-step flow
  return jobs.map(j => {
    if ((j.status as string) === 'pending') return { ...j, status: 'accepterad' as const };
    if ((j.status as string) === 'done') return { ...j, status: 'klar' as const };
    // Strip legacy difficulty field so TypeScript stays clean
    const { difficulty: _d, ...rest } = j as any;
    return rest as Job;
  });
};

export const updateJob = async (job: Job): Promise<void> => {
  const jobs = await getJobs();
  const index = jobs.findIndex(j => j.id === job.id);
  if (index !== -1) {
    jobs[index] = job;
    await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  }
};

export const deleteJob = async (jobId: string): Promise<void> => {
  const jobs = await getJobs();
  await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(jobs.filter(j => j.id !== jobId)));
};

export const regeoCodeAllClients = async (
  onProgress?: (done: number, total: number) => void
): Promise<number> => {
  const clients = await getClients();
  const missing = clients.filter(
    c => c.location.address && c.location.lat === 0 && c.location.lng === 0
  );
  let updated = 0;
  for (let i = 0; i < missing.length; i++) {
    const c = missing[i];
    onProgress?.(i, missing.length);
    const coords = await geocodeAddress(c.location.address);
    if (coords) {
      await updateClient({ ...c, location: { ...c.location, ...coords } });
      updated++;
    }
  }
  onProgress?.(missing.length, missing.length);
  return updated;
};
