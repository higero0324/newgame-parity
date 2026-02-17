import Link from "next/link";

export default function HajimeniPage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 14, justifyItems: "center" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>初めに</h1>

      <article style={{ width: "100%", maxWidth: 760, lineHeight: 1.9, fontSize: 16 }}>
        <p>
          これは紙ゲーであり、神ゲーである。
          すなわち、紙とペンを手にしたときこそ本領を発揮するタイプのゲームだ。
        </p>
        <p>
          消しゴム？ なくてよし。
          多少の書き間違いすら、歴史として抱きしめて進めばいい。
          一正（hisei）は、アナログの気合いと勢いに優しい。
        </p>
        <p>
          準備は驚くほど簡単。
          紙を1枚、ペンを1本。
          あとは縦に4本、横に4本、線を引くだけで25マスの盤面が誕生する。
        </p>
        <p>
          これで準備完了。
          机の上は、もう立派な対局場だ。
          さあ、紙の上で一正を始めよう。
        </p>
        <p>
          そしてこのアプリの役目は、実はとてもシンプルだ。
          気分を高めながら、手軽にルールを覚えてもらうためのものに過ぎない。
        </p>
        <p>
          ただし、その「過ぎない」が侮れない。
          紙ゲー史を塗り替えるかもしれないこのゲームを、もっと遠くまで届けるための導火線。
          それが、このアプリである。
        </p>
      </article>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/?menu=learn" style={linkStyle}>
          学びへ戻る
        </Link>
        <Link href="/tutorial" style={linkStyle}>
          体験チュートリアルへ
        </Link>
      </div>
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  color: "var(--ink)",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  fontWeight: 700,
  fontSize: 17,
  textDecoration: "none",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};
