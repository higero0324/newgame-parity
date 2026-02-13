export type Player = "p1" | "p2";
export type Owner = "p1" | "p2" | "none";

export const SIZE = 5;
export const BOARD_LEN = SIZE * SIZE;

export function ownerOf(v: number): Owner {
  if (v === 0) return "none";
  if (v === 2 || v === 4) return "p1";
  // 1,3,5 は後手。5 はロックのため増えない
  return "p2";
}

export function isLocked(v: number): boolean {
  return v === 5;
}

export function idx(r: number, c: number) {
  return r * SIZE + c;
}

export function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

const DIRS: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export type ApplyMoveResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      newBoard: number[];
      changed: Array<{ i: number; from: number; to: number }>;
      winner: Player | null;
    };

export function applyMove(board: number[], pos: number, player: Player): ApplyMoveResult {
  if (pos < 0 || pos >= BOARD_LEN) return { ok: false, reason: "範囲外です" };
  if (board[pos] !== 0) return { ok: false, reason: "空マス(0)にしか置けません" };

  const placeValue = player === "p1" ? 2 : 1;

  const newBoard = board.slice();
  const changed: Array<{ i: number; from: number; to: number }> = [];

  // 自分の石を置く
  newBoard[pos] = placeValue;
  changed.push({ i: pos, from: 0, to: placeValue });

  const startR = Math.floor(pos / SIZE);
  const startC = pos % SIZE;

  // 8方向で相手石を挟んだら取り込み（+1, 最大5）
  for (const [dr, dc] of DIRS) {
    let r = startR + dr;
    let c = startC + dc;

    const captured: number[] = [];

    while (inBounds(r, c)) {
      const i = idx(r, c);
      const v = newBoard[i];
      const o = ownerOf(v);

      // 空マスで終了
      if (o === "none") {
        captured.length = 0;
        break;
      }

      // 自分の石で挟めた（5でもOK）
      if (o === player) {
        // 1つ以上挟んでいれば取り込み
        if (captured.length > 0) {
          for (const capIdx of captured) {
            const before = newBoard[capIdx];
            if (isLocked(before)) continue; // 5 はロック
            const after = Math.min(5, before + 1);
            if (after !== before) {
              newBoard[capIdx] = after;
              changed.push({ i: capIdx, from: before, to: after });
            }
          }
        }
        break;
      }

      // 相手のロック(5)は壁扱い
      if (isLocked(v)) {
        captured.length = 0;
        break;
      }

      // 相手石を記録
      captured.push(i);

      r += dr;
      c += dc;
    }
  }

  const winner = checkWinner(newBoard);
  return { ok: true, newBoard, changed, winner };
}

export function checkWinner(board: number[]): Player | null {
  const lines: number[][] = [];

  // rows
  for (let r = 0; r < SIZE; r++) {
    const line: number[] = [];
    for (let c = 0; c < SIZE; c++) line.push(idx(r, c));
    lines.push(line);
  }

  // cols
  for (let c = 0; c < SIZE; c++) {
    const line: number[] = [];
    for (let r = 0; r < SIZE; r++) line.push(idx(r, c));
    lines.push(line);
  }

  // diagonals
  lines.push([idx(0, 0), idx(1, 1), idx(2, 2), idx(3, 3), idx(4, 4)]);
  lines.push([idx(0, 4), idx(1, 3), idx(2, 2), idx(3, 1), idx(4, 0)]);

  const p1Set = new Set([2, 4]);
  const p2Set = new Set([1, 3, 5]);

  for (const line of lines) {
    const vals = line.map(i => board[i]);
    if (vals.every(v => p1Set.has(v))) return "p1";
    if (vals.every(v => p2Set.has(v))) return "p2";
  }

  // 盤面が埋まったら偶数/奇数で判定
  if (board.every(v => v !== 0)) {
    let evenCount = 0;
    let oddCount = 0;
    for (const v of board) {
      if (v % 2 === 0) evenCount++;
      else oddCount++;
    }
    return evenCount > oddCount ? "p1" : "p2";
  }

  return null;
}

export function getWinningLine(board: number[]): number[] | null {
  const lines: number[][] = [];

  // rows
  for (let r = 0; r < SIZE; r++) {
    const line: number[] = [];
    for (let c = 0; c < SIZE; c++) line.push(idx(r, c));
    lines.push(line);
  }

  // cols
  for (let c = 0; c < SIZE; c++) {
    const line: number[] = [];
    for (let r = 0; r < SIZE; r++) line.push(idx(r, c));
    lines.push(line);
  }

  // diagonals
  lines.push([idx(0, 0), idx(1, 1), idx(2, 2), idx(3, 3), idx(4, 4)]);
  lines.push([idx(0, 4), idx(1, 3), idx(2, 2), idx(3, 1), idx(4, 0)]);

  const p1Set = new Set([2, 4]);
  const p2Set = new Set([1, 3, 5]);

  for (const line of lines) {
    const vals = line.map(i => board[i]);
    if (vals.every(v => p1Set.has(v)) || vals.every(v => p2Set.has(v))) {
      return line;
    }
  }

  return null;
}

export function getAllWinningLines(board: number[]): number[] {
  const lines: number[][] = [];

  // rows
  for (let r = 0; r < SIZE; r++) {
    const line: number[] = [];
    for (let c = 0; c < SIZE; c++) line.push(idx(r, c));
    lines.push(line);
  }

  // cols
  for (let c = 0; c < SIZE; c++) {
    const line: number[] = [];
    for (let r = 0; r < SIZE; r++) line.push(idx(r, c));
    lines.push(line);
  }

  // diagonals
  lines.push([idx(0, 0), idx(1, 1), idx(2, 2), idx(3, 3), idx(4, 4)]);
  lines.push([idx(0, 4), idx(1, 3), idx(2, 2), idx(3, 1), idx(4, 0)]);

  const p1Set = new Set([2, 4]);
  const p2Set = new Set([1, 3, 5]);
  const allWinningCells: number[] = [];

  for (const line of lines) {
    const vals = line.map(i => board[i]);
    if (vals.every(v => p1Set.has(v)) || vals.every(v => p2Set.has(v))) {
      allWinningCells.push(...line);
    }
  }

  return allWinningCells;
}

export function emptyBoard(): number[] {
  return Array.from({ length: BOARD_LEN }, () => 0);
}
