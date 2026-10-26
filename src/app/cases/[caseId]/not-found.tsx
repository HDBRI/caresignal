import Link from "next/link";

/** Shown for unknown IDs — including other users' records, which are indistinguishable from missing ones. */
export default function NotFound() {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ fontSize: 24 }}>Not found</h1>
      <p>This case or note doesn&apos;t exist, or it isn&apos;t available to you.</p>
      <Link href="/cases">Back to your cases</Link>
    </div>
  );
}
