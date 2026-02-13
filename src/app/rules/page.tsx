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
          <li>二. 先手は偶数側（2・4）、後手は奇数側（1・3・5）です。</li>
          <li>三. 自分の手番では、空マス（0）に1つだけ置けます。</li>
          <li>四. 置いた石で相手石を挟むと、挟まれた相手石の数値が +1 されます。</li>
          <li>五. 数値 5 はロック状態で、以後は増えず、挟み処理でも壁として扱われます。</li>
          <li>六. 相手石を1つ以上挟めた方向だけが取り込み対象です。空マスに突き当たる方向は不成立です。</li>
          <li>七. 新ルール: 同一プレイヤーが隣接する両角を取っていて、間の3マスがすべて空の間は、そのプレイヤーはその間3マスに置けません。</li>
          <li>八. 勝利条件は、縦・横・斜めのいずれか1列を自分側の偶奇で揃えることです。</li>
          <li>九. 盤面がすべて埋まった場合は、偶数マス数と奇数マス数を比較し、多い側の勝利です。</li>
          <li>十. 合法でない手は実行されず、理由メッセージが表示されます。</li>
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
        <Link href="/" style={linkStyle}>ホームへ戻る</Link>
        <Link href="/tutorial" style={linkStyle}>体験チュートリアルへ</Link>
      </div>
    </main>
  );
}
