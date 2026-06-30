import { Client, Job } from '../types';
import { AppSettings } from '../storage';

const AVG_SPEED_KMH = 70;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function driveH(km: number): number {
  return km / AVG_SPEED_KMH;
}

function hasCoords(lat: number, lng: number) {
  return lat !== 0 || lng !== 0;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function advanceWeekday(d: Date): Date {
  const r = new Date(d);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

function nextWeekday(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + 1);
  return advanceWeekday(r);
}

export type ScheduleEntry = {
  job: Job;
  client: Client;
  driveFromPrevKm: number;
  splitDay?: 1 | 2;
  splitHours?: number;
};

export type ScheduleDay = {
  date: Date;
  items: ScheduleEntry[];
  returnKm: number; // drive from last job back home
};

export function totalDayHours(day: ScheduleDay): { workH: number; driveH: number; totalH: number } {
  const workH = day.items.reduce((s, e) => s + (e.splitHours ?? e.job.duration), 0);
  const driveHours =
    day.items.reduce((s, e) => s + driveH(e.driveFromPrevKm), 0) +
    driveH(day.returnKm);
  return { workH, driveH: driveHours, totalH: workH + driveHours };
}

function calcReturnKm(posLat: number, posLng: number, HOME_LAT: number, HOME_LNG: number, bothValid: boolean): number {
  if (!bothValid || !hasCoords(posLat, posLng)) return 0;
  return haversineKm(posLat, posLng, HOME_LAT, HOME_LNG);
}

export function buildSchedule(
  clients: Client[],
  jobs: Job[],
  settings: AppSettings
): ScheduleDay[] {
  const MAX_KM = settings.maxDriveKm;
  const HOME_LAT = settings.homeLat;
  const HOME_LNG = settings.homeLng;
  const homeHasCoords = hasCoords(HOME_LAT, HOME_LNG);
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const pinned = new Map<string, ScheduleEntry[]>();
  const pool: { job: Job; client: Client }[] = [];

  const todayStr = isoDate(new Date());

  for (const job of jobs) {
    if (job.status !== 'accepterad') continue;
    const client = clientMap[job.clientId];
    if (!client) continue;
    if (job.manualDate && job.manualDate < todayStr && !job.locked) {
      pool.push({ job, client });
    } else if (job.manualDate) {
      const arr = pinned.get(job.manualDate) ?? [];
      arr.push({ job, client, driveFromPrevKm: 0 });
      pinned.set(job.manualDate, arr);
    } else {
      pool.push({ job, client });
    }
  }

  const days = new Map<string, ScheduleDay>();

  const ensureDay = (d: Date): ScheduleDay => {
    const key = isoDate(d);
    if (!days.has(key)) {
      const fixed = new Date(d); fixed.setHours(12, 0, 0, 0);
      days.set(key, { date: fixed, items: [], returnKm: 0 });
    }
    return days.get(key)!;
  };

  // Insert pinned jobs and compute their return km
  for (const [dateStr, entries] of pinned) {
    const d = advanceWeekday(new Date(dateStr + 'T12:00:00'));
    const day = ensureDay(d);
    day.items.push(...entries);
    const last = day.items[day.items.length - 1];
    day.returnKm = calcReturnKm(last.client.location.lat, last.client.location.lng, HOME_LAT, HOME_LNG, homeHasCoords);
  }

  pool.sort((a, b) => b.client.potential - a.client.potential);
  let remaining = [...pool];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let cursor = advanceWeekday(today);
  let safety = 0;

  while (remaining.length > 0 && safety++ < 400) {
    if (cursor.getDay() === 0 || cursor.getDay() === 6) {
      cursor = nextWeekday(cursor);
      continue;
    }

    const day = ensureDay(cursor);

    const lastEntry = day.items[day.items.length - 1];
    let posLat = lastEntry ? lastEntry.client.location.lat : HOME_LAT;
    let posLng = lastEntry ? lastEntry.client.location.lng : HOME_LNG;

    // totalDayHours already includes returnKm; to compute budgetLeft for adding more jobs,
    // add back the current returnH (it will shift to the new last job)
    const { totalH: usedH } = totalDayHours(day);
    let budgetLeft = Math.max(0, 8 - usedH + driveH(day.returnKm));

    if (budgetLeft < 0.25) {
      cursor = nextWeekday(cursor);
      continue;
    }

    const posHasCoords = hasCoords(posLat, posLng);
    const dayCoordsArr = day.items
      .map(e => ({ lat: e.client.location.lat, lng: e.client.location.lng }))
      .filter(c => hasCoords(c.lat, c.lng));
    const dayIsEmpty = dayCoordsArr.length === 0;

    type Candidate = {
      item: typeof remaining[0];
      driveKm: number;
      dHours: number;
      returnAfterKm: number;
      returnAfterH: number;
      fits: boolean;
      tooFar: boolean;
      score: number;
    };

    const candidates: Candidate[] = remaining.map(x => {
      const jobHasCoords = hasCoords(x.client.location.lat, x.client.location.lng);

      const driveKm = jobHasCoords && posHasCoords
        ? haversineKm(posLat, posLng, x.client.location.lat, x.client.location.lng)
        : 0;
      const dHours = driveH(driveKm);

      const returnAfterKm = calcReturnKm(
        x.client.location.lat, x.client.location.lng,
        HOME_LAT, HOME_LNG,
        homeHasCoords && jobHasCoords
      );
      const returnAfterH = driveH(returnAfterKm);

      const nearestDayKm = jobHasCoords && dayCoordsArr.length > 0
        ? Math.min(...dayCoordsArr.map(c => haversineKm(c.lat, c.lng, x.client.location.lat, x.client.location.lng)))
        : 0;

      const tooFar = jobHasCoords && !dayIsEmpty && nearestDayKm > MAX_KM;

      const tooFarFromHome = homeHasCoords && jobHasCoords && dayIsEmpty
        && haversineKm(HOME_LAT, HOME_LNG, x.client.location.lat, x.client.location.lng) > MAX_KM * 1.5;

      if (tooFarFromHome) return null;

      // Must fit: drive to job + work + drive home
      const netBudget = budgetLeft - dHours - returnAfterH;
      const fits = x.job.duration <= netBudget && !tooFar;

      const proximityScore = jobHasCoords
        ? Math.max(0, MAX_KM - (dayCoordsArr.length > 0 ? nearestDayKm : driveKm))
        : MAX_KM / 2;
      const score = proximityScore * 2 + x.client.potential * 8;

      return { item: x, driveKm, dHours, returnAfterKm, returnAfterH, fits, tooFar, score };
    }).filter(Boolean) as Candidate[];

    const fitting = candidates.filter(c => c.fits).sort((a, b) => b.score - a.score);

    if (fitting.length === 0) {
      if (dayIsEmpty) {
        const splittable = candidates
          .filter(c => !c.tooFar && c.item.job.duration <= 16 && (budgetLeft - c.dHours - c.returnAfterH) > 0.5)
          .sort((a, b) => b.score - a.score);

        if (splittable.length > 0) {
          const s = splittable[0];
          const workForToday = budgetLeft - s.dHours - s.returnAfterH;
          day.items.push({ job: s.item.job, client: s.item.client, driveFromPrevKm: s.driveKm, splitDay: 1, splitHours: workForToday });
          day.returnKm = s.returnAfterKm;
          remaining = remaining.filter(r => r.job.id !== s.item.job.id);
          const nextDay = ensureDay(nextWeekday(cursor));
          nextDay.items.push({ job: s.item.job, client: s.item.client, driveFromPrevKm: 0, splitDay: 2, splitHours: s.item.job.duration - workForToday });
          nextDay.returnKm = calcReturnKm(s.item.client.location.lat, s.item.client.location.lng, HOME_LAT, HOME_LNG, homeHasCoords);
          cursor = nextWeekday(cursor);
          continue;
        }
      }
      cursor = nextWeekday(cursor);
      continue;
    }

    // Add best fitting job
    const best = fitting[0];
    day.items.push({ job: best.item.job, client: best.item.client, driveFromPrevKm: best.driveKm });
    day.returnKm = best.returnAfterKm;
    budgetLeft -= best.item.job.duration + best.dHours + best.returnAfterH;
    posLat = best.item.client.location.lat;
    posLng = best.item.client.location.lng;
    if (hasCoords(posLat, posLng)) dayCoordsArr.push({ lat: posLat, lng: posLng });
    remaining = remaining.filter(r => r.job.id !== best.item.job.id);

    // Keep filling the day
    while (remaining.length > 0) {
      const posIsValid = hasCoords(posLat, posLng);

      const next: Candidate[] = remaining.map(x => {
        const jobHasCoords = hasCoords(x.client.location.lat, x.client.location.lng);
        const driveKm = jobHasCoords && posIsValid
          ? haversineKm(posLat, posLng, x.client.location.lat, x.client.location.lng)
          : 0;
        const dHours = driveH(driveKm);
        const returnAfterKm = calcReturnKm(
          x.client.location.lat, x.client.location.lng,
          HOME_LAT, HOME_LNG,
          homeHasCoords && jobHasCoords
        );
        const returnAfterH = driveH(returnAfterKm);
        const nearestDayKm = jobHasCoords && dayCoordsArr.length > 0
          ? Math.min(...dayCoordsArr.map(c => haversineKm(c.lat, c.lng, x.client.location.lat, x.client.location.lng)))
          : 0;
        const tooFar = jobHasCoords && nearestDayKm > MAX_KM;
        if (tooFar) return null;
        const netBudget = budgetLeft - dHours - returnAfterH;
        if (x.job.duration > netBudget || netBudget < 0) return null;
        const proximityScore = jobHasCoords ? Math.max(0, MAX_KM - driveKm) : MAX_KM / 2;
        const score = proximityScore * 2 + x.client.potential * 8;
        return { item: x, driveKm, dHours, returnAfterKm, returnAfterH, fits: true, tooFar: false, score };
      }).filter(Boolean) as Candidate[];

      if (next.length === 0) break;
      next.sort((a, b) => b.score - a.score);
      const pick = next[0];
      day.items.push({ job: pick.item.job, client: pick.item.client, driveFromPrevKm: pick.driveKm });
      day.returnKm = pick.returnAfterKm;
      budgetLeft -= pick.item.job.duration + pick.dHours + pick.returnAfterH;
      posLat = pick.item.client.location.lat;
      posLng = pick.item.client.location.lng;
      if (hasCoords(posLat, posLng)) dayCoordsArr.push({ lat: posLat, lng: posLng });
      remaining = remaining.filter(r => r.job.id !== pick.item.job.id);
    }

    cursor = nextWeekday(cursor);
  }

  return Array.from(days.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}
