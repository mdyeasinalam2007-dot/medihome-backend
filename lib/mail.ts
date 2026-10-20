// Sends email through Resend's HTTP API (set RESEND_API_KEY + MAIL_FROM). No extra npm package needed.
// Without a key: in development the email is printed in the terminal; in production nothing is sent.
export async function sendMail(m: { to: string; subject: string; text: string }): Promise<"sent" | "console" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.MAIL_FROM || "MediHome <onboarding@resend.dev>", to: [m.to], subject: m.subject, text: m.text }) });
      return r.ok ? "sent" : "failed";
    } catch { return "failed"; }
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("\n[DEV MAIL: no email service configured, so the message is shown here]\nTo: " + m.to + "\nSubject: " + m.subject + "\n\n" + m.text + "\n");
    return "console";
  }
  return "failed";
}
