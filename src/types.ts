export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  potential: number;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  jobs: Job[];
};

export type JobStatus = 'förfrågan' | 'offert' | 'accepterad' | 'klar';

export type Job = {
  id: string;
  clientId: string;
  duration: number;
  status: JobStatus;
  scheduledDate?: string;
  manualDate?: string;
  notes: string;
  photos: string[];
  addedBy?: string;
  locked?: boolean;
  createdAt?: string;
};
