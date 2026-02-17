import Link from "next/link";

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 860,
  border: "1px solid var(--line)",
  borderRadius: 14,
  background: "linear-gradient(180deg, rgba(255,248,236,0.92) 0%, rgba(241,223,191,0.72) 100%)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.2)",
  padding: "14px 16px",
  lineHeight: 1.8,
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
};

const listStyle: React.CSSProperties = {
  margin: "8px 0 0",
  paddingLeft: 0,
  listStyle: "none",
  display: "grid",
  gap: 8,
};

const linkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  color: "var(--ink)",
  textDecoration: "none",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};

export default function RulesPage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 14, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>ルール説明</h1>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>対局ルール（実装準拠）</h2>
        <ol style={listStyle}>
          <li>一. 盤面は 5x5（合計25マス）です。</li>
          <li>二. 先手が新しく置ける数字は「2」、後手が新しく置ける数字は「1」です。</li>
          <li>三. 先手側の石は偶数（2・4）、後手側の石は奇数（1・3・5）として判定されます。</li>
          <li>四. 手番では、空いているマス（0）に1つだけ置けます。</li>
          <li>五. 置いた石で相手の石を一直線に挟むと、挟まれた相手石の数字が1つ増えます。</li>
          <li>六. 挟みが成立するのは、途中に相手石があり、その先を自分石で閉じられた方向だけです（空マスで切れる方向は不成立）。</li>
          <li>七. 数字が「5」になった石は固定され、以後は増えません。挟み判定では壁として扱われます。</li>
          <li>八. 新ルール: 同じプレイヤーが同じ辺の両角を取り、間の3マスがすべて空の間は、その3マスにそのプレイヤー自身は置けません。ただし、他に置ける合法手が1つもない場合は、その3マスにも置けます。</li>
          <li>九. 勝利条件は「縦・横・斜め」のいずれか1列を自分側の偶奇でそろえることです。盤面が埋まったら、偶数マス数と奇数マス数の多い側が勝ちです。</li>
        </ol>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>アプリ内補足</h2>
        <ol style={listStyle}>
          <li>一. 「1手戻す」は対局操作として利用できます。</li>
          <li>二. CPU戦では、その試合で初回の「1手戻す」時にアチーブメント記録対象外になる確認が表示されます。</li>
          <li>三. チュートリアルは学習用の演出を含みますが、対局本体の勝敗判定は上の「対局ルール」に従います。</li>
        </ol>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/tutorial" style={linkStyle}>体験チュートリアルへ</Link>
      </div>
    </main>
  );
}
