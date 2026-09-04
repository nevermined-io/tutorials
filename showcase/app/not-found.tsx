import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <h1 style={{ fontFamily: "var(--disp)", fontSize: "34px", letterSpacing: "-0.025em" }}>
        No such tutorial
      </h1>
      <p style={{ color: "var(--muted)", marginTop: "12px", fontSize: "16px" }}>
        That page doesn&apos;t exist. Pick a tutorial from the menu, or head back to the overview.
      </p>
      <p style={{ marginTop: "22px" }}>
        <Link href="/" className="cta" style={{ textDecoration: "none" }}>
          Back to the overview
        </Link>
      </p>
    </div>
  );
}
