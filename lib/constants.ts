export const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
export const CATEGORIES: [string, string][] = [
  ["general","General ward bed"],["male_ward","Male ward bed"],["female_ward","Female ward bed"],["pediatric","Pediatric bed"],
  ["emergency_obs","Emergency observation bed"],["icu","ICU - Intensive Care Unit"],["ccu","CCU - Coronary Care Unit"],
  ["nicu","NICU - Neonatal ICU"],["picu","PICU - Pediatric ICU"],["hdu","HDU - High Dependency Unit"],["sicu","SICU - Surgical ICU"],
  ["micu","MICU - Medical ICU"],["isolation","Isolation room / bed"],["dialysis","Dialysis bed / station"],["recovery","Recovery / post-op bed"],
  ["cabin","Private cabin"],["vip_cabin","Deluxe / VIP cabin"],["single_room","Single room"],["double_room","Double room"],
  ["shared_room","Shared room"],["maternity","Maternity / labor"],["other","Other"],
];
export const catLabel = (k: string) => CATEGORIES.find((c) => c[0] === k)?.[1] || k;
// AC / Non-AC only makes sense for these (not for clinical beds like ICU/CCU)
export const AC_CATS = ["general","male_ward","female_ward","isolation","cabin","vip_cabin","single_room","double_room","shared_room","maternity"];
export const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested", AWAITING_PAYMENT: "Awaiting payment", PAID: "Paid - awaiting hospital", CONFIRMED: "Confirmed",
  REJECTED: "Rejected", CANCELLED: "Cancelled", COMPLETED: "Completed", REFUND_PENDING: "Refund pending", REFUNDED: "Refunded",
};
export const SUB_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pending payment", PENDING_VERIFICATION: "Pending verification", ACTIVE: "Active", PAST_DUE: "Past due", SUSPENDED: "Suspended",
};
