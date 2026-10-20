import { db } from "./db";
import { activeWhere } from "./subscription";
const ci = (q?: string) => (q ? { contains: q, mode: "insensitive" as const } : undefined);
const H = { select: { id: true, name: true, location: true } };

export const listDoctors = (q?: string) => db.doctor.findMany({
  where: { published: true, hospital: activeWhere(), ...(q ? { OR: [{ name: ci(q) }, { specialty: ci(q) }, { hospital: { name: ci(q) } }] } : {}) },
  include: { hospital: H }, orderBy: { createdAt: "desc" }, take: 60 });

export const listAccommodations = (q?: string, cat?: string) => db.accommodation.findMany({
  where: { published: true, hospital: activeWhere(), ...(cat ? { category: cat } : {}), ...(q ? { OR: [{ name: ci(q) }, { hospital: { name: ci(q) } }, { hospital: { location: ci(q) } }] } : {}) },
  include: { hospital: H }, orderBy: { pricePerDay: "asc" }, take: 60 });

export const listBlood = (group?: string) => db.bloodStock.findMany({
  where: { units: { gt: 0 }, hospital: activeWhere(), ...(group ? { group } : {}) },
  include: { hospital: { select: { id: true, name: true, location: true, bloodNote: true } } }, orderBy: { updatedAt: "desc" }, take: 80 });

export const listTests = (q?: string) => db.diagnosticTest.findMany({
  where: { published: true, hospital: activeWhere(), ...(q ? { OR: [{ name: ci(q) }, { category: ci(q) }, { hospital: { name: ci(q) } }] } : {}) },
  include: { hospital: H }, take: 60 });

export const listHospitals = (q?: string) => db.hospital.findMany({
  where: { ...activeWhere(), ...(q ? { OR: [{ name: ci(q) }, { location: ci(q) }, { address: ci(q) }] } : {}) },
  select: { id: true, name: true, location: true, address: true, description: true, photoUrl: true, _count: { select: { doctors: true, accommodations: true, tests: true } } }, take: 60 });

export const getHospital = (id: string) => db.hospital.findFirst({
  where: { id, ...activeWhere() },
  select: { id: true, name: true, location: true, address: true, description: true, facilities: true, photoUrl: true, bloodNote: true, emergency: true,
    doctors: { where: { published: true } }, accommodations: { where: { published: true } }, tests: { where: { published: true } }, blood: { where: { units: { gt: 0 } } },
    user: { select: { ambulanceProvider: { select: { vehicles: { where: { available: true } } } } } } } });

// Hospital-run ambulances are visible only while that hospital's subscription is active.
export const ambVisible = () => ({ OR: [{ provider: { user: { hospital: { is: null } } } }, { provider: { user: { hospital: { is: activeWhere() } } } }] });
export const listAmbulances = (q?: string) => db.ambulance.findMany({
  where: { available: true, ...ambVisible(), ...(q ? { OR: [{ type: ci(q) }, { area: ci(q) }, { provider: { name: ci(q) } }] } : {}) },
  include: { provider: { select: { name: true, area: true } } }, orderBy: { baseFare: "asc" }, take: 60 });
