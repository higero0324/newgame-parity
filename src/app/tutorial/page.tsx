"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board";
import { applyMove, emptyBoard, type Player } from "@/lib/gameLogic";

type StepId = "rules" | "place" | "ritual" | "capture" | "lock" | "cornerBridge" | "win";

type Step = {
  id: StepId;
  title: string;
  description: string;
  init: () => { board: number[]; turn: Player };
  allowed: number[];
  isSuccess: (res: ReturnType<typeof applyMove>) => boolean;
  successMessage: string;
};

const WIN_INTERVAL_MS = 2500;
const CAPTURE_INTERVAL_MS = 1000;
const RITUAL_DELAY_MS = 1000;
const CORNERS = [0, 4, 20, 24] as const;
const RULE_CARD_COUNT = 7;

function makeBoard(values: Record<number, number>) {
  const b = emptyBoard();
  for (const [k, v] of Object.entries(values)) {
    b[Number(k)] = v;
  }
  return b;
}

function diagonalCorner(pos: number): number {
  if (pos === 0) return 24;
  if (pos === 4) return 20;
  if (pos === 20) return 4;
  return 0;
}

function isCorner(pos: number): boolean {
  return CORNERS.includes(pos as (typeof CORNERS)[number]);
}

function pickNonDiagonalCorner(senteFirst: number): number {
  const banned = new Set([senteFirst, diagonalCorner(senteFirst)]);
  for (const c of CORNERS) {
    if (!banned.has(c)) return c;
  }
  return 4;
}

export default function TutorialPage() {
  const steps: Step[] = useMemo(
    () => [
      {
        id: "rules",
        title: "1. ルールを確認する",
        description: "下のルールカードをすべて押して、基本ルールを確認してください。",
        init: () => ({ board: emptyBoard(), turn: "p1" }),
        allowed: [],
        isSuccess: () => true,
        successMessage: "OK！ ルールを確認しました。",
      },
      {
        id: "place",
        title: "2. まずは置いてみる",
        description: "中央のマス（三秋）をクリックして、先手の「2」を置いてください。",
        init: () => ({ board: emptyBoard(), turn: "p1" }),
        allowed: [12],
        isSuccess: res => res.ok,
        successMessage: "OK！ 石が置けました。",
      },
      {
        id: "ritual",
        title: "3. 公式採用: 儀式的な対角交換ルール",
        description: "初手で角を1つ置いてください。そこから公式の開始手順を体験します。",
        init: () => ({ board: emptyBoard(), turn: "p1" }),
        allowed: [],
        isSuccess: () => false,
        successMessage: "初め方は完璧です。",
      },
      {
        id: "capture",
        title: "4. 取り込み（挟み）",
        description: "左端の空きマスをクリックして、挟み取りを確認してください。",
        init: () => ({
          board: makeBoard({ 11: 1, 12: 1, 13: 1, 14: 2 }),
          turn: "p1",
        }),
        allowed: [10],
        isSuccess: res => res.ok && res.changed.length >= 2,
        successMessage: "OK！ 挟んだ石が取り込まれました。",
      },
      {
        id: "lock",
        title: "5. 5（ロック）は壁",
        description: "左端の空きマスをクリックしてください。相手の5が間にある方向は取り込みできません。",
        init: () => ({
          board: makeBoard({ 11: 5, 12: 1, 13: 2 }),
          turn: "p1",
        }),
        allowed: [10],
        isSuccess: res => res.ok && res.changed.length === 1,
        successMessage: "OK！ 5が壁として働きました。",
      },
      {
        id: "cornerBridge",
        title: "6. 隣接角の新ルール",
        description: "一春・一夏を取った側は、間が空の間はその間に置けません（ただし他に合法手がない終盤は例外）。上辺のどこか（四春 / 三春 / 二春）を押して確認してください。",
        init: () => ({
          board: makeBoard({ 0: 2, 4: 2 }),
          turn: "p1",
        }),
        allowed: [1, 2, 3],
        isSuccess: () => false,
        successMessage: "OK！ 隣接角ルールを確認しました。",
      },
      {
        id: "win",
        title: "7. 勝利条件",
        description: "四夏に置いてください。",
        init: () => ({
          // 対角交換ルール後でも成立する、現実的な勝ち筋
          board: makeBoard({ 0: 2, 4: 1, 5: 2, 7: 2, 8: 2, 9: 2, 20: 1, 24: 2 }),
          turn: "p1",
        }),
        allowed: [6], // 四夏
        isSuccess: res => res.ok && "winner" in res && res.winner === "p1",
        successMessage: "OK！ 四夏で1列が完成し、先手の勝ちです。",
      },
    ],
    []
  );

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const [board, setBoard] = useState(step.init().board);
  const [turn, setTurn] = useState<Player>(step.init().turn);
  const [msg, setMsg] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [completed, setCompleted] = useState(false);
  const [lastChanged, setLastChanged] = useState<Set<number>>(new Set());
  const [lastPlaced, setLastPlaced] = useState<number | undefined>(undefined);
  const [ruleClicks, setRuleClicks] = useState<Set<string>>(new Set());
  const [ritualPhase, setRitualPhase] = useState<"first" | "wait1" | "takeDiag" | "wait2" | "done">("first");
  const [ritualSenteFirst, setRitualSenteFirst] = useState<number | null>(null);
  const [ritualGoteFirst, setRitualGoteFirst] = useState<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const resetStepState = (nextStep: Step) => {
    const init = nextStep.init();
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
    setBoard(init.board);
    setTurn(init.turn);
    setMsg("");
    setDoneMsg("");
    setCompleted(false);
    setLastChanged(new Set());
    setLastPlaced(undefined);
    setRuleClicks(new Set());
    setRitualPhase("first");
    setRitualSenteFirst(null);
    setRitualGoteFirst(null);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

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
        setLastPlaced(undefined);
      }, idx * CAPTURE_INTERVAL_MS);
      timersRef.current.push(t);
    });
  };

  const runWinDemo = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
    const frames: Array<Record<number, number>> = [
      { 2: 1, 7: 1, 12: 3, 17: 1, 22: 5 },
      { 10: 2, 11: 2, 12: 4, 13: 2, 14: 2 },
      { 0: 1, 6: 3, 12: 1, 18: 5, 24: 1 },
    ];
    frames.forEach((frame, idx) => {
      const t = window.setTimeout(() => {
        setBoard(makeBoard(frame));
        setLastChanged(new Set(Object.keys(frame).map(k => Number(k))));
        setLastPlaced(undefined);
      }, idx * WIN_INTERVAL_MS);
      timersRef.current.push(t);
    });
    // ループ再生
    const loopTimer = window.setTimeout(() => {
      runWinDemo();
    }, frames.length * WIN_INTERVAL_MS);
    timersRef.current.push(loopTimer);
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
        setLastPlaced(undefined);
      } else {
        setBoard(emptyBoard());
        setLastChanged(new Set());
        setLastPlaced(undefined);
      }
      if (next.size === RULE_CARD_COUNT && step.id === "rules") {
        setCompleted(true);
        setDoneMsg("OK！ ルールを確認しました。");
      }
      return next;
    });
  };

  const handleRitualClick = (pos: number) => {
    if (ritualPhase === "wait1" || ritualPhase === "wait2") {
      setMsg("自動配置中です。少し待ってください。");
      return;
    }
    if (ritualPhase === "done") return;

    if (ritualPhase === "first") {
      if (!isCorner(pos)) {
        setMsg("初手は角に置いてください。");
        return;
      }
      const first = applyMove(board, pos, "p1");
      if (!first.ok) {
        setMsg(first.reason);
        return;
      }
      setBoard(first.newBoard);
      setLastChanged(new Set(first.changed.map(c => c.i)));
      setLastPlaced(pos);
      setRitualSenteFirst(pos);
      setRitualPhase("wait1");
      setMsg("後手が、対角ではない角に一を置きます。");

      const gotePos = pickNonDiagonalCorner(pos);
      const t = window.setTimeout(() => {
        setBoard(prev => {
          const next = prev.slice();
          next[gotePos] = 1;
          return next;
        });
        setLastChanged(new Set([gotePos]));
        setLastPlaced(gotePos);
        setRitualGoteFirst(gotePos);
        setRitualPhase("takeDiag");
        setMsg("次に、あなたの初手角の対角を取ってください。");
      }, RITUAL_DELAY_MS);
      timersRef.current.push(t);
      return;
    }

    if (ritualPhase === "takeDiag" && ritualSenteFirst !== null && ritualGoteFirst !== null) {
      const expected = diagonalCorner(ritualSenteFirst);
      if (pos !== expected) {
        setMsg("自分の初手角の対角を取ってください。");
        return;
      }
      const second = applyMove(board, pos, "p1");
      if (!second.ok) {
        setMsg(second.reason);
        return;
      }
      setBoard(second.newBoard);
      setLastChanged(new Set(second.changed.map(c => c.i)));
      setLastPlaced(pos);
      setRitualPhase("wait2");
      setMsg("後手が、初手角の対角に一を置きます。");

      const goteDiag = diagonalCorner(ritualGoteFirst);
      const t = window.setTimeout(() => {
        setBoard(prev => {
          const next = prev.slice();
          next[goteDiag] = 1;
          return next;
        });
        setLastChanged(new Set([goteDiag]));
        setLastPlaced(goteDiag);
        setRitualPhase("done");
        setCompleted(true);
        setDoneMsg("初め方は完璧です。");
      }, RITUAL_DELAY_MS);
      timersRef.current.push(t);
    }
  };

  const onClickCell = (pos: number) => {
    if (step.id === "rules") {
      setMsg("ルールボタンを使って確認してください。");
      return;
    }
    if (step.id === "ritual") {
      handleRitualClick(pos);
      return;
    }
    if (step.id === "cornerBridge") {
      if (!step.allowed.includes(pos)) {
        setMsg("上辺の3マス（四春 / 三春 / 二春）を押してください。");
        return;
      }
      const res = applyMove(board, pos, turn);
      if (!res.ok) {
        if (res.reason.includes("隣接角")) {
          setCompleted(true);
          setDoneMsg("OK！ 隣接角ルールを確認しました。");
          setMsg("この場面では、角を取った側は間が空の間その間に置けません（他に合法手がない終盤は例外）。");
          return;
        }
        setMsg(res.reason);
        return;
      }
      setMsg("この手は置けてしまいました。上辺の3マスを選んでください。");
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
    setLastPlaced(pos);
    if (step.isSuccess(res)) {
      setCompleted(true);
      setMsg(step.successMessage);
    } else {
      setMsg("もう一度お試しください。");
    }
  };

  const goNext = () => {
    if (stepIndex >= steps.length - 1) return;
    const nextIndex = stepIndex + 1;
    resetStepState(steps[nextIndex]);
    setStepIndex(nextIndex);
  };

  const goPrev = () => {
    if (stepIndex <= 0) return;
    const prevIndex = stepIndex - 1;
    resetStepState(steps[prevIndex]);
    setStepIndex(prevIndex);
  };

  const resetStep = () => {
    resetStepState(step);
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>一正（hisei）ルール体験</h1>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", justifyContent: "center" }}>
        <Link href="/?menu=learn" style={btnStyle}>学びへ戻る</Link>
      </div>
      <div style={{ width: "100%", maxWidth: 720, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{step.title}</div>
        <p style={{ margin: 0 }}>{step.description}</p>
      </div>

      {step.id === "rules" && (
        <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 720 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={() => onClickRule("sente", "先手は偶数画（2と4）です。", { 11: 2, 13: 4 })} style={btnStyle}>
                先手
              </button>
              <button onClick={() => onClickRule("gote", "後手は奇数画（1・3・5）です。", { 7: 1, 12: 3, 17: 5 })} style={btnStyle}>
                後手
              </button>
              <button onClick={() => onClickRule("place", "先手は毎手『2』を、後手は毎手『1』を空マスに置きます。", { 12: 2, 13: 1 })} style={btnStyle}>
                置く数字
              </button>
              <button onClick={() => onClickRule("capture", "挟むと1画加算されます（正になると追加できません）。", undefined, "capture")} style={btnStyle}>
                取り込み
              </button>
              <button onClick={() => onClickRule("lock", "5は固定され、挟みでは壁として扱われます。", { 11: 5, 12: 1, 13: 2 })} style={btnStyle}>
                5ロック
              </button>
              <button onClick={() => onClickRule("bridge", "新ルール: 同じ辺の両角を取って間が空の間は、その間3マスにその側は置けません（他に合法手がない終盤は例外）。", { 0: 2, 4: 2 })} style={btnStyle}>
                隣接角ルール
              </button>
              <button onClick={() => onClickRule("win", "縦・横・斜めの1列が偶数または奇数で揃うと勝利です。", undefined, "win")} style={btnStyle}>
                勝利条件
              </button>
            </div>
          <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>クリック済み: {ruleClicks.size}/{RULE_CARD_COUNT}</div>
        </div>
      )}

      <Board board={board} onClickCell={onClickCell} lastChanged={lastChanged} lastPlaced={lastPlaced} disabled={completed} />

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
        <button onClick={resetStep} style={btnStyle}>
          手順をやり直す
        </button>
        <button onClick={goPrev} disabled={stepIndex === 0} style={btnStyle}>
          前へ
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
              key={s.id}
              onClick={() => {
                if (i === stepIndex) return;
                resetStepState(steps[i]);
                setStepIndex(i);
              }}
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
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  fontWeight: 700,
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};
