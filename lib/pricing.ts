export const num = (v: any, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const FEE = () => num(process.env.SERVICE_FEE_BDT, 10);
export const REG_FEE = () => num(process.env.HOSPITAL_REG_FEE_BDT, 100);
export const MONTHLY_FEE = () => num(process.env.HOSPITAL_MONTHLY_FEE_BDT, 50);

export function bedEstimate(pricePerDay: number, days: number, additional = 0, deposit = 0) {
  const accommodation = pricePerDay * days;
  return { accommodation, additional, deposit, estimate: accommodation + additional, dueAtHospital: accommodation + additional + deposit };
}
export const AMB_FEE = () => num(process.env.AMBULANCE_FEE_BDT, 10);
