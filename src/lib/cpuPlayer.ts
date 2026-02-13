import { applyMove, checkWinner, type Player, ownerOf, SIZE, idx } from "./gameLogic";

export type CpuLevel = "easy" | "medium" | "hard" | "extreme";

export function findCpuMove(board: number[], player: Player, level: CpuLevel = "hard"): number {
  if (level === "easy") return findEasyMove(board, player);
  if (level === "medium") return findMediumMove(board, player);
  if (level === "extreme") return findExtremeMove(board, player);
  return findHardMove(board, player);
}

// 初級：ランダム + 即勝ち手のみ
function findEasyMove(board: number[], player: Player): number {
  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (emptyPositions.length === 0) return -1;

  // 勝てる手があれば打つ
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, player);
    if (res.ok && res.winner === player) return pos;
  }

  // ランダムに選ぶ
  return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
}

// 中級：即勝ち + 防御 + 簡易評価
function findMediumMove(board: number[], player: Player): number {
  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (emptyPositions.length === 0) return -1;

  // 勝てる手があれば打つ
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, player);
    if (res.ok && res.winner === player) return pos;
  }

  // 相手が次に勝つ手を防ぐ
  const opponent: Player = player === "p1" ? "p2" : "p1";
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, opponent);
    if (res.ok && res.winner === opponent) return pos;
  }

  // 評価関数で選ぶ
  let bestPos = emptyPositions[0];
  let bestScore = -Infinity;

  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, player);
    if (!res.ok) continue;

    const score = evaluateBoard(res.newBoard, player);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }

  return bestPos;
}

// 上級：改良版ミニマックス法（置換表 + 反復深化 + 手の並び替え）
const transpositionTable = new Map<string, { score: number; depth: number }>();

function findHardMove(board: number[], player: Player): number {
  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (emptyPositions.length === 0) return -1;

  // 即勝ち手があれば打つ
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, player);
    if (res.ok && res.winner === player) return pos;
  }

  transpositionTable.clear();

  // 動的な探索深度（序盤は浅く、終盤は深く）
  const emptyCount = emptyPositions.length;
  const maxDepth = emptyCount > 15 ? 4 : emptyCount > 10 ? 5 : 6;

  // 反復深化探索
  let bestPos = emptyPositions[0];
  for (let depth = 2; depth <= maxDepth; depth++) {
    const moves = orderMoves(board, emptyPositions, player);
    let bestScore = -Infinity;

    for (const pos of moves) {
      const res = applyMove(board, pos, player);
      if (!res.ok) continue;

      const score = minimax(res.newBoard, depth - 1, -Infinity, Infinity, false, player);
      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }
  }

  return bestPos;
}

// 極級：上級 + 角優先（悪手回避）+ 対角角優先
function findExtremeMove(board: number[], player: Player): number {
  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (emptyPositions.length === 0) return -1;

  // 即勝ち手があれば最優先
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, player);
    if (res.ok && res.winner === player) return pos;
  }

  // 端3連取以上の危険局面は最優先で受ける
  const emergencyEdgeMove = findEmergencyEdgeBreakMove(board, player);
  if (emergencyEdgeMove !== null) return emergencyEdgeMove;

  // 端からの押し込み（横角定石含む）を優先して崩す
  const antiEdgeMove = findAntiEdgeSweepMove(board, player);
  if (antiEdgeMove !== null) return antiEdgeMove;

  const preferredCorner = findPreferredCornerMove(board, player);
  if (preferredCorner !== null) return preferredCorner;

  return findHardMove(board, player);
}

const CORNERS = [idx(0, 0), idx(0, 4), idx(4, 0), idx(4, 4)] as const;
const EDGE_LINES: number[][] = [
  [idx(0, 0), idx(0, 1), idx(0, 2), idx(0, 3), idx(0, 4)],
  [idx(4, 0), idx(4, 1), idx(4, 2), idx(4, 3), idx(4, 4)],
  [idx(0, 0), idx(1, 0), idx(2, 0), idx(3, 0), idx(4, 0)],
  [idx(0, 4), idx(1, 4), idx(2, 4), idx(3, 4), idx(4, 4)],
];

function oppositeCorner(pos: number): number | null {
  if (pos === idx(0, 0)) return idx(4, 4);
  if (pos === idx(4, 4)) return idx(0, 0);
  if (pos === idx(0, 4)) return idx(4, 0);
  if (pos === idx(4, 0)) return idx(0, 4);
  return null;
}

function findPreferredCornerMove(board: number[], player: Player): number | null {
  const opponent: Player = player === "p1" ? "p2" : "p1";
  const emptyCorners = CORNERS.filter(pos => board[pos] === 0);
  if (emptyCorners.length === 0) return null;

  // 角が開いている時、1手で大崩れしない角を優先
  const safeCorners = emptyCorners.filter(pos => {
    const res = applyMove(board, pos, player);
    if (!res.ok) return false;
    return !opponentHasImmediateWinningMove(res.newBoard, opponent);
  });

  if (safeCorners.length === 0) return null;

  // 既に取っている角があれば、その対角角を優先
  const myCorners = CORNERS.filter(pos => ownerOf(board[pos]) === player);
  for (const myCorner of myCorners) {
    const diag = oppositeCorner(myCorner);
    if (diag !== null && safeCorners.includes(diag)) return diag;
  }

  // 角同士では評価の高い手を採用
  return orderMoves(board, [...safeCorners], player)[0] ?? null;
}

function findAntiEdgeSweepMove(board: number[], player: Player): number | null {
  const opponent: Player = player === "p1" ? "p2" : "p1";
  const edgePressureByCell = new Map<number, number>();

  for (const line of EDGE_LINES) {
    const oppOwned = line.filter(i => ownerOf(board[i]) === opponent).length;
    const myOwned = line.filter(i => ownerOf(board[i]) === player).length;
    const empty = line.filter(i => board[i] === 0);
    if (empty.length === 0) continue;

    const pressure = oppOwned - myOwned;
    if (pressure <= 0) continue;

    for (const cell of empty) {
      let score = pressure * 24;
      if (oppOwned >= 3) score += 36;
      if (CORNERS.includes(line[0] as (typeof CORNERS)[number]) && ownerOf(board[line[0]]) === opponent) score += 14;
      if (CORNERS.includes(line[4] as (typeof CORNERS)[number]) && ownerOf(board[line[4]]) === opponent) score += 14;
      edgePressureByCell.set(cell, (edgePressureByCell.get(cell) ?? 0) + score);
    }

    // 角から連続で押してくる形を特に警戒（例: 角,隣を相手が所持し、その先が空き）
    if (ownerOf(board[line[0]]) === opponent && ownerOf(board[line[1]]) === opponent && board[line[2]] === 0) {
      edgePressureByCell.set(line[2], (edgePressureByCell.get(line[2]) ?? 0) + 48);
    }
    if (ownerOf(board[line[4]]) === opponent && ownerOf(board[line[3]]) === opponent && board[line[2]] === 0) {
      edgePressureByCell.set(line[2], (edgePressureByCell.get(line[2]) ?? 0) + 48);
    }
  }

  const candidates = [...edgePressureByCell.entries()]
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([pos]) => pos);
  if (candidates.length === 0) return null;

  let bestPos: number | null = null;
  let bestScore = -Infinity;
  for (const pos of candidates) {
    const res = applyMove(board, pos, player);
    if (!res.ok) continue;
    if (opponentHasImmediateWinningMove(res.newBoard, opponent)) continue;
    const score = (edgePressureByCell.get(pos) ?? 0) + evaluateBoard(res.newBoard, player);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  return bestPos;
}

function findEmergencyEdgeBreakMove(board: number[], player: Player): number | null {
  const opponent: Player = player === "p1" ? "p2" : "p1";
  const urgentCells = new Set<number>();

  for (const line of EDGE_LINES) {
    const oppOwned = line.filter(i => ownerOf(board[i]) === opponent).length;
    const myOwned = line.filter(i => ownerOf(board[i]) === player).length;
    const empty = line.filter(i => board[i] === 0);
    if (empty.length === 0) continue;

    // 相手が端を3つ以上支配している時点で緊急防衛対象
    if (oppOwned >= 3 && oppOwned > myOwned) {
      for (const cell of empty) urgentCells.add(cell);
    }
  }

  const candidates = [...urgentCells];
  if (candidates.length === 0) return null;

  transpositionTable.clear();
  let bestPos: number | null = null;
  let bestScore = -Infinity;
  for (const pos of candidates) {
    const res = applyMove(board, pos, player);
    if (!res.ok) continue;
    if (opponentHasImmediateWinningMove(res.newBoard, opponent)) continue;

    // 緊急局面では通常より少し深く読む
    const score = minimax(res.newBoard, 4, -Infinity, Infinity, false, player) + evaluateBoard(res.newBoard, player);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  return bestPos;
}

function opponentHasImmediateWinningMove(board: number[], opponent: Player): boolean {
  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, opponent);
    if (res.ok && res.winner === opponent) return true;
  }
  return false;
}

// 手の並び替え（中央優先 + 評価値順）
function orderMoves(board: number[], positions: number[], player: Player): number[] {
  const center = idx(2, 2);
  return positions.sort((a, b) => {
    // 中央を優先
    if (a === center) return -1;
    if (b === center) return 1;

    // 中央からの距離
    const distA = Math.abs(Math.floor(a / SIZE) - 2) + Math.abs((a % SIZE) - 2);
    const distB = Math.abs(Math.floor(b / SIZE) - 2) + Math.abs((b % SIZE) - 2);
    if (distA !== distB) return distA - distB;

    // 簡易評価
    const resA = applyMove(board, a, player);
    const resB = applyMove(board, b, player);
    if (!resA.ok) return 1;
    if (!resB.ok) return -1;

    const scoreA = evaluateBoard(resA.newBoard, player);
    const scoreB = evaluateBoard(resB.newBoard, player);
    return scoreB - scoreA;
  });
}

function minimax(
  board: number[],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  cpuPlayer: Player
): number {
  const winner = checkWinner(board);
  if (winner === cpuPlayer) return 10000 + depth;
  if (winner !== null) return -10000 - depth;
  if (depth === 0) return evaluateBoard(board, cpuPlayer);

  // 置換表チェック
  const boardKey = board.join(",");
  const cached = transpositionTable.get(boardKey);
  if (cached && cached.depth >= depth) return cached.score;

  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (emptyPositions.length === 0) return 0;

  const currentPlayer: Player = isMaximizing ? cpuPlayer : (cpuPlayer === "p1" ? "p2" : "p1");
  const orderedMoves = orderMoves(board, emptyPositions, currentPlayer);

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const pos of orderedMoves) {
      const res = applyMove(board, pos, currentPlayer);
      if (!res.ok) continue;
      const score = minimax(res.newBoard, depth - 1, alpha, beta, false, cpuPlayer);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    transpositionTable.set(boardKey, { score: maxScore, depth });
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const pos of orderedMoves) {
      const res = applyMove(board, pos, currentPlayer);
      if (!res.ok) continue;
      const score = minimax(res.newBoard, depth - 1, alpha, beta, true, cpuPlayer);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    transpositionTable.set(boardKey, { score: minScore, depth });
    return minScore;
  }
}

function evaluateBoard(board: number[], player: Player): number {
  let score = 0;
  const opponent: Player = player === "p1" ? "p2" : "p1";

  const lines: number[][] = [];
  for (let r = 0; r < SIZE; r++) {
    const line: number[] = [];
    for (let c = 0; c < SIZE; c++) line.push(idx(r, c));
    lines.push(line);
  }
  for (let c = 0; c < SIZE; c++) {
    const line: number[] = [];
    for (let r = 0; r < SIZE; r++) line.push(idx(r, c));
    lines.push(line);
  }
  lines.push([idx(0, 0), idx(1, 1), idx(2, 2), idx(3, 3), idx(4, 4)]);
  lines.push([idx(0, 4), idx(1, 3), idx(2, 2), idx(3, 1), idx(4, 0)]);

  for (const line of lines) {
    let myCount = 0;
    let oppCount = 0;

    for (const i of line) {
      const owner = ownerOf(board[i]);
      if (owner === player) myCount++;
      else if (owner === opponent) oppCount++;
    }

    if (oppCount === 0 && myCount > 0) {
      score += myCount * myCount * 20;
    }
    if (myCount === 0 && oppCount > 0) {
      score -= oppCount * oppCount * 20;
    }
  }

  const center = idx(2, 2);
  if (ownerOf(board[center]) === player) score += 30;

  // 端の圧力評価（角定石以外の端押しを軽視しない）
  for (const line of EDGE_LINES) {
    let myEdge = 0;
    let oppEdge = 0;
    for (const i of line) {
      const o = ownerOf(board[i]);
      if (o === player) myEdge++;
      else if (o === opponent) oppEdge++;
    }
    score += myEdge * 10;
    score -= oppEdge * 10;
  }

  // 角そのものは強く評価
  for (const c of CORNERS) {
    const o = ownerOf(board[c]);
    if (o === player) score += 22;
    else if (o === opponent) score -= 22;
  }

  return score;
}
