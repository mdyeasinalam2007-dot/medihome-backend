// The Ratchet AI brand mark: the glowing, slowly rotating orb (pure CSS, see .ai-orb in globals.css).
// Decorative: always paired with visible text or an accessible label. Reduced motion stops the rotation.
export default function RatchetOrb({ size = "sm", busy, className = "" }: { size?: "xs" | "sm" | "md" | "lg"; busy?: boolean; className?: string }) {
  return <span className={`ai-orb ${size}${busy ? " busy" : ""}${className ? " " + className : ""}`} aria-hidden />;
}
