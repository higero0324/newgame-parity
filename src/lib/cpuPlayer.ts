import { applyMove, checkWinner, type Player, ownerOf, SIZE, idx } from "./gameLogic";

export type CpuLevel = "easy" | "medium" | "hard" | "extreme";

export function findCpuMove(board: number[], player: Player, level: CpuLevel = "hard"): number {
  if (level === "easy") return findEasyMove(board, player);
  if (level === "medium") return findMediumMove(board, player);
  if (level === "extreme") return findExtremeMove(board, player);
  return findHardMove(board, player);
}

export function findShogoCpuMove(board: number[], player: Player): number {
  const legalMoves = board
    .map((v, i) => (v === 0 ? i : -1))
    .filter(i => i >= 0)
    .map(pos => ({ pos, res: applyMove(board, pos, player) }))
    .filter(x => x.res.ok) as Array<{ pos: number; res: Extract<ReturnType<typeof applyMove>, { ok: true }> }>;

  if (legalMoves.length === 0) return -1;
  const opponent: Player = player === "p1" ? "p2" : "p1";

  // 1) 局勝利は最優先。勝ち手が複数ある場合は得点が高い手を選ぶ。
  const winningMoves = legalMoves.filter(x => x.res.winner === player);
  if (winningMoves.length > 0) {
    let best = winningMoves[0];
    let bestGain = calcShogoRoundGain(best.res.newBoard, player);
    let bestEval = evaluateBoard(best.res.newBoard, player);
    for (let i = 1; i < winningMoves.length; i += 1) {
      const gain = calcShogoRoundGain(winningMoves[i].res.newBoard, player);
      const evalScore = evaluateBoard(winningMoves[i].res.newBoard, player);
      if (gain > bestGain || (gain === bestGain && evalScore > bestEval)) {
        best = winningMoves[i];
        bestGain = gain;
        bestEval = evalScore;
      }
    }
    return best.pos;
  }

  // 2) 相手の即勝ちがある局面では、その受けを最優先。
  const opponentImmediateWins = board
    .map((v, i) => (v === 0 ? i : -1))
    .filter(i => i >= 0)
    .filter(pos => {
      const res = applyMove(board, pos, opponent);
      return res.ok && res.winner === opponent;
    });
  if (opponentImmediateWins.length > 0) {
    const blockers = legalMoves.filter(x => opponentImmediateWins.includes(x.pos));
    if (blockers.length > 0) {
      let best = blockers[0];
      let bestScore = evaluateShogoPosition(blockers[0].res.newBoard, player);
      for (let i = 1; i < blockers.length; i += 1) {
        const score = evaluateShogoPosition(blockers[i].res.newBoard, player);
        if (score > bestScore) {
          best = blockers[i];
          bestScore = score;
        }
      }
      return best.pos;
    }
  }

  // 3) 通常時は「高得点取り」を意識した評価で選択。
  let best = legalMoves[0];
  let bestScore = evaluateShogoPosition(legalMoves[0].res.newBoard, player);
  for (let i = 1; i < legalMoves.length; i += 1) {
    const score = evaluateShogoPosition(legalMoves[i].res.newBoard, player);
    if (score > bestScore) {
      best = legalMoves[i];
      bestScore = score;
    }
  }

  return best.pos;
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
  let scoredAtLastDepth: Array<{ pos: number; score: number }> = [];
  for (let depth = 2; depth <= maxDepth; depth++) {
    const moves = orderMoves(board, emptyPositions, player);
    const scored: Array<{ pos: number; score: number }> = [];

    for (const pos of moves) {
      const res = applyMove(board, pos, player);
      if (!res.ok) continue;

      const score = minimax(res.newBoard, depth - 1, -Infinity, Infinity, false, player);
      scored.push({ pos, score });
    }

    if (scored.length > 0) scoredAtLastDepth = scored;
  }

  if (scoredAtLastDepth.length === 0) return emptyPositions[0];

  // 危険手（相手の即勝ちを許す手）を除外しつつ、上位候補をランダムに選ぶ
  const safeMoves = scoredAtLastDepth.filter(x => !isDangerousMove(board, x.pos, player));
  const source = safeMoves.length > 0 ? safeMoves : scoredAtLastDepth;
  const bestScore = Math.max(...source.map(x => x.score));

  // 同程度の強さの手はランダム化して、中央固定になりにくくする
  const scoreMargin = 25;
  const nearBest = source.filter(x => bestScore - x.score <= scoreMargin);
  const pool = nearBest.length > 0 ? nearBest : source;
  return pool[Math.floor(Math.random() * pool.length)]?.pos ?? source[0].pos;
}

// 極級：上級 + 角優先（対角角最優先）
function findExtremeMove(board: number[], player: Player): number {
  const emptyPositions = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  if (emptyPositions.length === 0) return -1;

  // 即勝ち手があれば最優先
  for (const pos of emptyPositions) {
    const res = applyMove(board, pos, player);
    if (res.ok && res.winner === player) return pos;
  }

  // 角優先（対角角を最優先）
  const preferredCorner = findPreferredCornerMove(board, player);
  if (preferredCorner !== null) return preferredCorner;

  return findHardMove(board, player);
}

const CORNERS = [idx(0, 0), idx(0, 4), idx(4, 0), idx(4, 4)] as const;

function oppositeCorner(pos: number): number | null {
  if (pos === idx(0, 0)) return idx(4, 4);
  if (pos === idx(4, 4)) return idx(0, 0);
  if (pos === idx(0, 4)) return idx(4, 0);
  if (pos === idx(4, 0)) return idx(0, 4);
  return null;
}

function findPreferredCornerMove(board: number[], player: Player): number | null {
  const emptyCorners = CORNERS.filter(pos => board[pos] === 0);
  if (emptyCorners.length === 0) return null;

  // 既に取っている角があれば、その対角角を最優先
  const myCorners = CORNERS.filter(pos => ownerOf(board[pos]) === player);
  for (const myCorner of myCorners) {
    const diag = oppositeCorner(myCorner);
    if (diag !== null && emptyCorners.includes(diag)) return diag;
  }

  // 角同士では評価の高い手を採用
  return orderMoves(board, [...emptyCorners], player)[0] ?? null;
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

  return score;
}

function isDangerousMove(board: number[], pos: number, player: Player): boolean {
  const moved = applyMove(board, pos, player);
  if (!moved.ok) return true;
  const opponent: Player = player === "p1" ? "p2" : "p1";
  const emptyPositions = moved.newBoard.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  for (const nextPos of emptyPositions) {
    const res = applyMove(moved.newBoard, nextPos, opponent);
    if (res.ok && res.winner === opponent) return true;
  }
  return false;
}

function lineIndices(): number[][] {
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
  return lines;
}

function countCompleteLinesForPlayer(board: number[], player: Player): number {
  let count = 0;
  const lines = lineIndices();
  for (const line of lines) {
    if (line.every(i => ownerOf(board[i]) === player)) count += 1;
  }
  return count;
}

function calcShogoRoundGain(board: number[], winner: Player): number {
  const linePoints = countCompleteLinesForPlayer(board, winner);
  const boardFilled = board.every(v => v !== 0);
  let evenCount = 0;
  let oddCount = 0;
  for (const v of board) {
    if (v % 2 === 0) evenCount += 1;
    else oddCount += 1;
  }
  const countWinner: Player = evenCount > oddCount ? "p1" : "p2";
  const countWinBonus = boardFilled && countWinner === winner ? 1 : 0;
  return Math.min(3, linePoints + countWinBonus);
}

function potentialLineScore(board: number[], player: Player): number {
  const opponent: Player = player === "p1" ? "p2" : "p1";
  let score = 0;
  const lines = lineIndices();
  for (const line of lines) {
    let myCount = 0;
    let oppCount = 0;
    for (const i of line) {
      const o = ownerOf(board[i]);
      if (o === player) myCount += 1;
      else if (o === opponent) oppCount += 1;
    }
    if (oppCount === 0 && myCount > 0) {
      score += myCount * myCount;
    }
  }
  return score;
}

function evaluateShogoPosition(board: number[], player: Player): number {
  const opponent: Player = player === "p1" ? "p2" : "p1";
  const base = evaluateBoard(board, player);
  const myPotential = potentialLineScore(board, player);
  const oppPotential = potentialLineScore(board, opponent);
  return base * 2 + myPotential * 85 - oppPotential * 75;
}
