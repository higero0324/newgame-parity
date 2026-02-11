import Link from "next/link";

export default function Home() {
  const linkStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--line)",
    display: "inline-block",
    width: "fit-content",
    background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
    color: "var(--ink)",
    boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
    textDecoration: "none",
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>一正 (hisei)</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/hajimeni" style={linkStyle}>初めに</Link>
        <Link href="/play" style={linkStyle}>対局を始める</Link>
        <Link href="/login" style={linkStyle}>ログイン</Link>
        <Link href="/tutorial" style={linkStyle}>チュートリアル</Link>
        <Link href="/history" style={linkStyle}>保存棋譜（ログイン時）</Link>
      </div>
      <p style={{ color: "#555", textAlign: "center" }}>
        ※ログインは棋譜保存用。ログインなしでも対局できます。
      </p>
    </main>
  );
}
