"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board";
import { applyMove, emptyBoard, type Player } from "@/lib/gameLogic";

type Step = {
  title: string;
  description: string;
  init: () => { board: number[]; turn: Player };
  allowed: number[];
  isSuccess: (res: ReturnType<typeof applyMove>) => boolean;
  successMessage: string;
};

function makeBoard(values: Record<number, number>) {
  const b = emptyBoard();
  for (const [k, v] of Object.entries(values)) {
    b[Number(k)] = v;
  }
  return b;
}

export default function TutorialPage() {
  const WIN_INTERVAL_MS = 4000;
  const CAPTURE_INTERVAL_MS = 1000;
  const steps: Step[] = useMemo(() => {
    return [
      {
        title: "1. ルールを確認する",
        description: "下のボタンをすべてクリックしてルールを確認しましょう。",
        init: () => ({ board: emptyBoard(), turn: "p1" }),
        allowed: [],
        isSuccess: () => true,
        successMessage: "OK！ ルールを確認しました。",
      },
      {
        title: "2. まずは置いてみる",
        description: "空マスに自分の石を置いてみましょう。中央のマスをクリックしてください。",
        init: () => ({ board: emptyBoard(), turn: "p1" }),
        allowed: [12],
        isSuccess: res => res.ok,
        successMessage: "OK！ 石が置けました。",
      },
      {
        title: "3. 取り込み（挟み）",
        description: "相手の石を挟むと +1 されて取り込まれます。左端の空きマスをクリックしてください。",
        init: () => ({
          board: makeBoard({
            11: 1,
            12: 1,
            13: 1,
            14: 2,
          }),
          turn: "p1",
        }),
        allowed: [10],
        isSuccess: res => res.ok && res.changed.length >= 2,
        successMessage: "OK！ 挟んだ石が取り込まれました。",
      },
      {
        title: "4. 5（ロック）は壁",
        description: "相手の5が間にあると、その方向の取り込みは起きません。左端の空きマスをクリックしてください。",
        init: () => ({
          board: makeBoard({
            11: 5,
            12: 1,
            13: 2,
          }),
          turn: "p1",
        }),
        allowed: [10],
        isSuccess: res => res.ok && res.changed.length === 1,
        successMessage: "OK！ 5が壁になり、取り込みは起きませんでした。",
      },
      {
        title: "5. 勝利条件",
        description: "縦・横・斜めの1列が自分の数字で揃うと勝利です。右端をクリックしてください。",
        init: () => ({
          board: makeBoard({
            0: 2,
            1: 2,
            2: 2,
            3: 2,
          }),
          turn: "p1",
        }),
        allowed: [4],
        isSuccess: res => res.ok && "winner" in res && res.winner === "p1",
        successMessage: "OK！ 先手の勝ちです。",
      },
    ];
  }, []);

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const [board, setBoard] = useState(step.init().board);
  const [turn, setTurn] = useState<Player>(step.init().turn);
  const [msg, setMsg] = useState("");
  const [completed, setCompleted] = useState(false);
  const [lastChanged, setLastChanged] = useState<Set<number>>(new Set());
  const [ruleClicks, setRuleClicks] = useState<Set<string>>(new Set());
  const [doneMsg, setDoneMsg] = useState<string>("");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const init = step.init();
    setBoard(init.board);
    setTurn(init.turn);
    setMsg("");
    setCompleted(false);
    setLastChanged(new Set());
    setRuleClicks(new Set());
    setDoneMsg("");
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  }, [step]);

  const onClickCell = (pos: number) => {
    if (step.allowed.length === 0) {
      setMsg("下のルールボタンをすべてクリックしてください。");
      return;
    }
    if (!step.allowed.includes(pos)) {
      setMsg("指定のマスをクリックしてください。");
      return;
    }
    const res = applyMove(board, pos, turn);
    if (!res.ok) {
      setMsg(res.reason);
      return;
    }
    setBoard(res.newBoard);
    setLastChanged(new Set(res.changed.map(c => c.i)));
    if (step.isSuccess(res)) {
      setCompleted(true);
      setMsg(step.successMessage);
    } else {
      setMsg("もう一度お試しください。");
    }
  };

  const goNext = () => {
    if (stepIndex >= steps.length - 1) return;
    setStepIndex(i => i + 1);
  };

  const goPrev = () => {
    if (stepIndex <= 0) return;
    setStepIndex(i => i - 1);
  };

  const resetStep = () => {
    const init = step.init();
    setBoard(init.board);
    setTurn(init.turn);
    setMsg("");
    setCompleted(false);
    setLastChanged(new Set());
    setRuleClicks(new Set());
    setDoneMsg("");
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  };

  const runCaptureDemo = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];

    const frames: Array<Record<number, number>> = [
      { 11: 2, 12: 1 },
      { 11: 2, 12: 1, 13: 2 },
      { 11: 2, 12: 2, 13: 2 },
    ];

    frames.forEach((frame, idx) => {
      const t = window.setTimeout(() => {
        setBoard(makeBoard(frame));
        setLastChanged(new Set(Object.keys(frame).map(k => Number(k))));
      }, idx * CAPTURE_INTERVAL_MS);
      timersRef.current.push(t);
    });
  };

  const runWinDemo = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];

    const frames: Array<Record<number, number>> = [
      // 縦（奇数側の勝ち: 1多め + 3/5を混ぜる）
      { 2: 1, 7: 1, 12: 3, 17: 1, 22: 5 },
      // 横（偶数側の勝ち: 2多め + 4を混ぜる）
      { 10: 2, 11: 2, 12: 4, 13: 2, 14: 2 },
      // 斜め（奇数側の勝ち: 1多め + 3/5を混ぜる）
      { 0: 1, 6: 3, 12: 1, 18: 5, 24: 1 },
    ];

    frames.forEach((frame, idx) => {
      const t = window.setTimeout(() => {
        setBoard(makeBoard(frame));
        setLastChanged(new Set(Object.keys(frame).map(k => Number(k))));
      }, idx * WIN_INTERVAL_MS);
      timersRef.current.push(t);
    });
  };

  const onClickRule = (
    key: string,
    text: string,
    boardValues?: Record<number, number>,
    demo?: "capture" | "win"
  ) => {
    setRuleClicks(prev => {
      const next = new Set(prev);
      next.add(key);
      setMsg(text);
      if (demo === "capture") {
        runCaptureDemo();
      } else if (demo === "win") {
        runWinDemo();
      } else if (boardValues) {
        setBoard(makeBoard(boardValues));
        setLastChanged(new Set(Object.keys(boardValues).map(k => Number(k))));
      } else {
        setBoard(emptyBoard());
        setLastChanged(new Set());
      }
      if (next.size === 4 && stepIndex === 0) {
        setCompleted(true);
        setDoneMsg("OK！ ルールを確認しました。");
      }
      return next;
    });
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>一正（hisei）ルール体験</h1>
      <div style={{ width: "100%", maxWidth: 720, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{step.title}</div>
        <p style={{ margin: 0 }}>{step.description}</p>
      </div>

      {stepIndex === 0 && (
        <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 720 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() =>
                onClickRule(
                  "sente",
                  "先手は偶数画（2と4）を使います。",
                  { 11: 2, 13: 4 }
                )
              }
              style={btnStyle}
            >
              先手
            </button>
            <button
              onClick={() =>
                onClickRule(
                  "gote",
                  "後手は奇数画（1・3・5）を使います。",
                  { 7: 1, 12: 3, 17: 5 }
                )
              }
              style={btnStyle}
            >
              後手
            </button>
            <button
              onClick={() =>
                onClickRule(
                  "capture",
                  "相手を挟むと+1され、最大5（ロック）まで増えます。",
                  undefined,
                  "capture"
                )
              }
              style={btnStyle}
            >
              取り込み
            </button>
            <button
              onClick={() =>
                onClickRule(
                  "win",
                  "縦・横・斜めの1列が自分の数字で揃えば勝利です。",
                  undefined,
                  "win"
                )
              }
              style={btnStyle}
            >
              勝利条件
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
            クリック済み: {ruleClicks.size}/4
          </div>
        </div>
      )}

      <Board board={board} onClickCell={onClickCell} lastChanged={lastChanged} disabled={completed} />

      {msg && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 720 }}>
          {msg}
        </div>
      )}
      {doneMsg && (
        <div style={{ padding: 8, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 720, textAlign: "center" }}>
          {doneMsg}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <a href="/" style={btnStyle}>
          ホームへ戻る
        </a>
        <button onClick={goPrev} disabled={stepIndex === 0} style={btnStyle}>
          前へ
        </button>
        <button onClick={resetStep} style={btnStyle}>
          この手順をやり直す
        </button>
        <button onClick={goNext} disabled={!completed || stepIndex === steps.length - 1} style={btnStyle}>
          次へ
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {steps.map((s, i) => {
          const isActive = i === stepIndex;
          return (
            <button
              key={s.title}
              onClick={() => setStepIndex(i)}
              style={{
                ...btnStyle,
                padding: "6px 10px",
                borderWidth: isActive ? 2 : 1,
                background: isActive
                  ? "linear-gradient(180deg, #f9ecd4 0%, #e8c89a 100%)"
                  : "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
              }}
              aria-current={isActive ? "step" : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--ink)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};
