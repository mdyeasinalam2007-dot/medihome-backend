export const maskPhone = (p?: string | null) => (p ? p.slice(0, 3) + "•".repeat(Math.max(0, p.length - 6)) + p.slice(-3) : "");
