"use client";
import { useEffect, useState } from "react";
import { signIn, getProviders } from "next-auth/react";

const G = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#FFC107"
      d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
    />
  </svg>
);

const F = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path
      fill="#fff"
      d="M13.5 19v-6.2h2.1l.4-2.6h-2.5V8.6c0-.8.3-1.3 1.4-1.3H16V5.2c-.2 0-1-.1-1.9-.1-2 0-3.3 1.2-3.3 3.4v1.7H8.7v2.6h2.1V19z"
    />
  </svg>
);

export default function SocialButtons({
  dividerText = "or sign in with email",
}: {
  dividerText?: string;
}) {
  const [providers, setProviders] = useState<any>(null);

  useEffect(() => {
    getProviders()
      .then(setProviders)
      .catch(() => setProviders({}));
  }, []);

  if (!providers) return null;

  const hasGoogle = Boolean(providers.google);
  const hasFacebook = Boolean(providers.facebook);

  if (!hasGoogle && !hasFacebook) return null;

  const st = {
    width: "100%",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  } as const;

  return (
    <div>
      {hasGoogle && (
        <button
          type="button"
          className="btn ghost"
          style={st}
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          {G} Continue with Google
        </button>
      )}
      {hasFacebook && (
        <button
          type="button"
          className="btn ghost"
          style={st}
          onClick={() => signIn("facebook", { callbackUrl: "/dashboard" })}
        >
          {F} Continue with Facebook
        </button>
      )}
      <p className="sub" style={{ textAlign: "center", margin: "6px 0" }}>
        {dividerText}
      </p>
    </div>
  );
}
