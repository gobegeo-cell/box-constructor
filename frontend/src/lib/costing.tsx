/* =========================
   ТИПЫ ВХОДА/ВЫХОДА
   ========================= */
export type BoxType = "casket" | "lidBottom" | "drawer" | "hex";
type Lam = "none" | "matt" | "gloss";
type PrintMode = "logosOnly" | "fullWrap";

export type BaseBoard = "chip_1_5" | "chip_2_0";
export type WrapPaper = "designer_120" | "coated_150" | "offset_150";
export type InnerPaper = "none" | "offset_150" | "coated_150";

export type CostInputs = {
  widthMM: number;
  heightMM: number;
  depthMM: number;
  quantity: number;
  currency?: string;
  boxType: BoxType;

  // материалы
  baseBoard: BaseBoard;
  wrapPaper: WrapPaper;

  // ламинация
  lamination?: Lam;        // для всех типов, кроме шкатулки
  wrapLamination?: Lam;    // для шкатулки

  // внутренняя бумага
  innerPaper?: InnerPaper;

  // режимы внутренних слоёв
  innerMode?: "none" | "bottom"; // кашировка дна (lidBottom/casket/drawer)
  drawerSleeveInner?: boolean;   // кашировка чехла (drawer)
  // опционально: отдельная бумага для кашировки футляра (если будет нужна в будущем)
  drawerSleevePaper?: InnerPaper;

  // печать/отделка
  print: PrintMode;
  finishing?: {
    blindEmboss?: boolean;
    foilStamp?: boolean;
    spotUV?: boolean;
    magnetsPair?: boolean;
  };

  // логотипы
  logosMeta?: { side: string; wMM: number; hMM: number }[];

  // параметры крышки-дно
  lidHeightMM?: number;
  lidClearanceMM?: number;
};

/* =========================
   ФОРМАТЫ / ТАРИФЫ
   ========================= */
const SHEET = { W: 1000, H: 700 }; // мм

const SHEET_PRICE: Record<BaseBoard | WrapPaper | InnerPaper, number> = {
  chip_1_5: 115,
  chip_2_0: 140,
  designer_120: 135,
  coated_150: 128,
  offset_150: 118,
  none: 0,
};

const RATES = {
  lamination: { none: 0, matt: 18, gloss: 15 }, // руб/м²
  print: { logosOnly: 38, fullWrap: 125 },      // руб/м²
  spotUV: 48,                                   // руб/м²
  work: {
    guillotineCut: 5,
    bottomLamination: 10,
    diecut: 5,
    cornerGlue: 5,
    wrap: 60,
    lidGlue: 10,
    stamping: 10,
    pack: 5,
  },
  magnetsPairPerBox: 9.5,
  setup: 900,
  overheadPct: 0.18,
};

export const CLICHE_CM2_RATE = 59;

function tierDiscount(qty: number) {
  if (qty >= 5000) return 0.1;
  if (qty >= 3000) return 0.06;
  if (qty >= 1500) return 0.04;
  if (qty >= 500)  return 0.025;
  return 0;
}

/* =========================
   ХЕЛПЕРЫ
   ========================= */
export const fmt = (n: number, cur = "₽") =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.round(n)) + " " + cur;

const mm2ToM2 = (w: number, h: number) => (w * h) / 1e6;

function packOnSheet(rectW: number, rectH: number, qty: number, sheetW = SHEET.W, sheetH = SHEET.H) {
  const fit = (w: number, h: number) => Math.max(0, Math.floor(sheetW / w)) * Math.max(0, Math.floor(sheetH / h));
  const perSheet = Math.max(fit(rectW, rectH), fit(rectH, rectW));
  const sheets = perSheet > 0 ? Math.ceil(qty / perSheet) : qty;
  return { perSheet, sheets };
}
function sum<T>(a: T[], f: (x: T) => number) { return a.reduce((acc, x) => acc + f(x), 0); }

function logosAreaM2(logos: CostInputs["logosMeta"]) {
  if (!Array.isArray(logos) || !logos.length) return 0;
  const areaMM2 = sum(logos, (l) => Math.max(0, l.wMM) * Math.max(0, l.hMM));
  return areaMM2 / 1e6;
}

/* =========================
   КОНСТАНТЫ РАСКЛАДОК
   ========================= */
const GAP  = 4;
const TURN = 30;
const RESV = 4;

const DIECUT_ADD = 10; // по 10 мм с каждой стороны
const OUTER_ADD  = 30; // по 30 мм с каждой стороны
const INNER_SUB  = 5;  // внутренние детали -5 мм
const LID_CLEARANCE_MM_DEFAULT = 6;

/* =========================
   ШКАТУЛКА — раскладки
   ========================= */
function casketLayouts(W: number, H: number, D: number) {
  const boardW = W + 2 * H;
  const boardH = D + 2 * H;

  const lidBoardMasterW = W + 10;
  const lidBoardMasterH = H + (H + 2) + (D + 2) + (D + 5);

  const bottomStripW = W + 2 * D + 50;
  const bottomStripH = H + 40;

  const lidWrapW = (W + 10) + 30;
  const lidWrapH = lidBoardMasterH + (3 * GAP) + TURN + RESV;

  const innerLidW = W + 5;
  const innerLidH = D + H + 40;

  const innerBottomW = (W + 2 * H) + 5;
  const innerBottomH = (D + 2 * H) + 5;

  return {
    boardSize: { w: boardW, h: boardH },
    lidBoardMaster: { w: lidBoardMasterW, h: lidBoardMasterH },
    bottomStripSize: { w: bottomStripW, h: bottomStripH },
    lidWrapSize:     { w: lidWrapW,     h: lidWrapH     },
    innerLidSize:    { w: innerLidW,    h: innerLidH    },
    innerBottomSize: { w: innerBottomW, h: innerBottomH },
  };
}
function sheetsForCasketByLayouts(W: number, H: number, D: number, qty: number) {
  const L = casketLayouts(W, H, D);
  const boardBottom = packOnSheet(L.boardSize.w,      L.boardSize.h,      qty);
  const boardLid    = packOnSheet(L.lidBoardMaster.w, L.lidBoardMaster.h, qty);
  const bottomStrip = packOnSheet(L.bottomStripSize.w, L.bottomStripSize.h, qty);
  const lidWrap     = packOnSheet(L.lidWrapSize.w,     L.lidWrapSize.h,     qty);
  const innerLid    = packOnSheet(L.innerLidSize.w,    L.innerLidSize.h,    qty);
  const innerBottom = packOnSheet(L.innerBottomSize.w, L.innerBottomSize.h, qty);
  return {
    boardSheets: boardBottom.sheets + boardLid.sheets,
    wrapSheets:  bottomStrip.sheets + lidWrap.sheets,
    innerLidSheets:    innerLid.sheets,
    innerBottomSheets: innerBottom.sheets,
    layouts: L,
  };
}

/* =========================
   КРЫШКА-ДНО — раскладки
   ========================= */
function lidBottomLayoutsPrecise(W:number, H:number, D:number, lidH:number, clearance:number){
  const baseCoreW = W + 2*H;
  const baseCoreH = D + 2*H;
  const baseDieW  = baseCoreW + DIECUT_ADD;
  const baseDieH  = baseCoreH + DIECUT_ADD;
  const baseInnerW = baseDieW - INNER_SUB;
  const baseInnerH = baseDieH - INNER_SUB;
  const baseWrapW  = baseCoreW + OUTER_ADD;
  const baseWrapH  = baseCoreH + OUTER_ADD;

  const WL = W + clearance;
  const DL = D + clearance;

  const lidCoreW = WL + 2*lidH;
  const lidCoreH = DL + 2*lidH;
  const lidDieW  = lidCoreW + DIECUT_ADD;
  const lidDieH  = lidCoreH + DIECUT_ADD;
  const lidWrapW = lidCoreW + OUTER_ADD;
  const lidWrapH = lidCoreH + OUTER_ADD;

  const lidInnerW = lidDieW;
  const lidInnerH = lidDieH;

  return {
    base: { board: { w: baseDieW, h: baseDieH }, wrap: { w: baseWrapW, h: baseWrapH }, inner: { w: baseInnerW, h: baseInnerH } },
    lid:  { board: { w: lidDieW,  h: lidDieH  }, wrap: { w: lidWrapW,  h: lidWrapH  }, inner: { w: lidInnerW,  h: lidInnerH  } }
  };
}
function sheetsForLidBottomPrecise(W:number,H:number,D:number,qty:number, lidH:number, clearance:number){
  const L = lidBottomLayoutsPrecise(W,H,D,lidH,clearance);
  const baseBoard = packOnSheet(L.base.board.w, L.base.board.h, qty);
  const baseWrap  = packOnSheet(L.base.wrap.w,  L.base.wrap.h,  qty);
  const baseInner = packOnSheet(L.base.inner.w, L.base.inner.h, qty);
  const lidBoard  = packOnSheet(L.lid.board.w,  L.lid.board.h,  qty);
  const lidWrap   = packOnSheet(L.lid.wrap.w,   L.lid.wrap.h,   qty);
  const lidInner  = packOnSheet(L.lid.inner.w,  L.lid.inner.h,  qty);
  return {
    baseBoardSheets: baseBoard.sheets,
    baseWrapSheets:  baseWrap.sheets,
    baseInnerSheets: baseInner.sheets,
    lidBoardSheets:  lidBoard.sheets,
    lidWrapSheets:   lidWrap.sheets,
    lidInnerSheets:  lidInner.sheets,
    layouts: L,
  };
}

/* =========================
   ПЕНАЛ (drawer)
   ========================= */
function drawerLayoutsPrecise(W:number, H:number, D:number, clearance:number) {
  const WL = W + clearance;
  const DL = D + clearance;
  const HL = H + clearance;

  // Лоток (tray) как дно
  const trayCoreW = W + 2*H;
  const trayCoreH = D + 2*H;
  const trayDieW  = trayCoreW + DIECUT_ADD;
  const trayDieH  = trayCoreH + DIECUT_ADD;
  const trayWrapW = trayCoreW + OUTER_ADD;
  const trayWrapH = trayCoreH + OUTER_ADD;
  const trayInnerW = trayDieW;   // как в lidBottom для крышки
  const trayInnerH = trayDieH;

  // Чехол (sleeve)
  const sleeveCoreW = 2*WL + HL;
  const sleeveCoreH = DL + 2*HL;
  const sleeveDieW  = sleeveCoreW + 20;
  const sleeveDieH  = sleeveCoreH + 20;
  const sleeveWrapW = sleeveCoreW + 80;
  const sleeveWrapH = sleeveCoreH + 80;
  const sleeveInnerW = sleeveCoreW + 10;
  const sleeveInnerH = sleeveCoreH + 10;

  return {
    tray:   { board:{w:trayDieW,h:trayDieH}, wrap:{w:trayWrapW,h:trayWrapH}, inner:{w:trayInnerW,h:trayInnerH} },
    sleeve: { board:{w:sleeveDieW,h:sleeveDieH}, wrap:{w:sleeveWrapW,h:sleeveWrapH}, inner:{w:sleeveInnerW,h:sleeveInnerH} }
  };
}
function sheetsForDrawerPrecise(W:number,H:number,D:number,qty:number, clearance:number) {
  const L = drawerLayoutsPrecise(W,H,D,clearance);
  const trayBoard   = packOnSheet(L.tray.board.w,   L.tray.board.h,   qty);
  const trayWrap    = packOnSheet(L.tray.wrap.w,    L.tray.wrap.h,    qty);
  const trayInner   = packOnSheet(L.tray.inner.w,   L.tray.inner.h,   qty);
  const sleeveBoard = packOnSheet(L.sleeve.board.w, L.sleeve.board.h, qty);
  const sleeveWrap  = packOnSheet(L.sleeve.wrap.w,  L.sleeve.wrap.h,  qty);
  const sleeveInner = packOnSheet(L.sleeve.inner.w, L.sleeve.inner.h, qty);
  return {
    trayBoardSheets:   trayBoard.sheets,
    trayWrapSheets:    trayWrap.sheets,
    trayInnerSheets:   trayInner.sheets,
    sleeveBoardSheets: sleeveBoard.sheets,
    sleeveWrapSheets:  sleeveWrap.sheets,
    sleeveInnerSheets: sleeveInner.sheets,
    layouts: L,
  };
}

/* =========================
   ФОЛЛБЭК
   ========================= */
function surfaceAreaM2(W: number, H: number, D: number) {
  const sMM2 = 2 * (W * H + W * D + H * D);
  return sMM2 / 1e6;
}

/* =========================
   ОСНОВНОЙ РАСЧЁТ
   ========================= */
export function estimateCost(i: CostInputs) {
  const qty = Math.max(1, Math.floor(i.quantity || 1));
  const cur = i.currency || "₽";
  const W = Math.max(1, +i.widthMM || 1);
  const H = Math.max(1, +i.heightMM || 1);
  const D = Math.max(1, +i.depthMM || 1);

  const sheets = { board: 0, wrap: 0, inner: 0 };
  let materialCost = 0;

  let areaPrintM2 = 0;
  let areaLogosM2 = 0;
  let areaLamM2   = 0;

  // для UI раздельно (по умолчанию нули)
  const sheetsBreakdown = {
    trayInnerSheets: 0,
    sleeveInnerSheets: 0,
  };

  if (i.boxType === "casket") {
    const { boardSheets, wrapSheets: wrapSheetsOuter, innerLidSheets, innerBottomSheets, layouts } =
      sheetsForCasketByLayouts(W, H, D, qty);

    const addBottom = (i.innerMode ?? "none") === "bottom";
    const innerPriceKey: keyof typeof SHEET_PRICE =
      (i.innerPaper && i.innerPaper !== "none") ? i.innerPaper : (i.wrapPaper ?? "designer_120");

    sheets.board = boardSheets;
    sheets.wrap  = wrapSheetsOuter + innerLidSheets;
    sheets.inner = addBottom ? innerBottomSheets : 0;

    const boardPrice = SHEET_PRICE[i.baseBoard ?? "chip_1_5"];
    const wrapPrice  = SHEET_PRICE[i.wrapPaper ?? "designer_120"];
    const innerPrice = SHEET_PRICE[innerPriceKey];

    materialCost =
      boardSheets       * boardPrice +
      wrapSheetsOuter   * wrapPrice +
      innerLidSheets    * innerPrice +
      (addBottom ? innerBottomSheets * innerPrice : 0);

    const perUnitOuterM2 =
      mm2ToM2(layouts.bottomStripSize.w, layouts.bottomStripSize.h) +
      mm2ToM2(layouts.lidWrapSize.w,     layouts.lidWrapSize.h);

    areaPrintM2 = (i.print === "fullWrap" ? perUnitOuterM2 : 0) * qty;
    areaLamM2   = perUnitOuterM2 * qty;
    areaLogosM2 = (i.print === "logosOnly" ? logosAreaM2(i.logosMeta) : 0);

  } else if (i.boxType === "lidBottom") {
    const lidH = Math.max(1, Number(i.lidHeightMM ?? ((i as any).lidLong ? H : 40)));
    const clearance = Math.max(0, Number(i.lidClearanceMM ?? LID_CLEARANCE_MM_DEFAULT));
    const S = sheetsForLidBottomPrecise(W, H, D, qty, lidH, clearance);

    const addBottomInner = (i.innerMode ?? "none") === "bottom";

    sheets.board = S.baseBoardSheets + S.lidBoardSheets;
    sheets.wrap  = S.baseWrapSheets  + S.lidWrapSheets + S.lidInnerSheets;
    sheets.inner = addBottomInner ? S.baseInnerSheets : 0;

    const boardPrice = SHEET_PRICE[i.baseBoard ?? "chip_1_5"];
    const wrapPrice  = SHEET_PRICE[i.wrapPaper ?? "designer_120"];
    const innerPriceKey: keyof typeof SHEET_PRICE =
      (i.innerPaper && i.innerPaper !== "none") ? i.innerPaper : (i.wrapPaper ?? "designer_120");
    const innerPrice = SHEET_PRICE[innerPriceKey];

    materialCost =
        (S.baseBoardSheets + S.lidBoardSheets) * boardPrice
      + (S.baseWrapSheets  + S.lidWrapSheets)  * wrapPrice
      +  S.lidInnerSheets * innerPrice
      + (addBottomInner ? S.baseInnerSheets * innerPrice : 0);

    const perUnitWrapAreaM2 =
      mm2ToM2(S.layouts.base.wrap.w, S.layouts.base.wrap.h) +
      mm2ToM2(S.layouts.lid.wrap.w,  S.layouts.lid.wrap.h);

    areaPrintM2 = (i.print === "fullWrap" ? perUnitWrapAreaM2 : 0) * qty;
    areaLamM2   = perUnitWrapAreaM2 * qty;
    areaLogosM2 = (i.print === "logosOnly" ? logosAreaM2(i.logosMeta) : 0);

  } else if (i.boxType === "drawer") {
    const clearance = Math.max(0, Number(i.lidClearanceMM ?? LID_CLEARANCE_MM_DEFAULT));
    const S = sheetsForDrawerPrecise(W, H, D, qty, clearance);

    const addTrayInner   = (i.innerMode ?? "none") === "bottom";
    const addSleeveInner = !!i.drawerSleeveInner;

    sheets.board = S.trayBoardSheets + S.sleeveBoardSheets;
    sheets.wrap  = S.trayWrapSheets  + S.sleeveWrapSheets;

    // раздельные числа для UI
    sheetsBreakdown.trayInnerSheets   = addTrayInner   ? S.trayInnerSheets   : 0;
    sheetsBreakdown.sleeveInnerSheets = addSleeveInner ? S.sleeveInnerSheets : 0;

    // в сумме это «Кашировка» (если где-то потребуется общее число)
    sheets.inner = sheetsBreakdown.trayInnerSheets + sheetsBreakdown.sleeveInnerSheets;

    // цены: лоток может быть на innerPaper, футляр — своей бумагой (если задана)
    const boardPrice = SHEET_PRICE[i.baseBoard ?? "chip_1_5"];
    const wrapPrice  = SHEET_PRICE[i.wrapPaper ?? "designer_120"];

    const trayInnerPriceKey: keyof typeof SHEET_PRICE =
      (i.innerPaper && i.innerPaper !== "none") ? i.innerPaper : (i.wrapPaper ?? "designer_120");
    const sleeveInnerPriceKey: keyof typeof SHEET_PRICE =
      (i.drawerSleevePaper && i.drawerSleevePaper !== "none")
        ? i.drawerSleevePaper
        : (i.wrapPaper ?? "designer_120");

    const trayInnerPrice   = SHEET_PRICE[trayInnerPriceKey];
    const sleeveInnerPrice = SHEET_PRICE[sleeveInnerPriceKey];

    materialCost =
        (S.trayBoardSheets   + S.sleeveBoardSheets) * boardPrice
      + (S.trayWrapSheets    + S.sleeveWrapSheets)  * wrapPrice
      + sheetsBreakdown.trayInnerSheets   * trayInnerPrice
      + sheetsBreakdown.sleeveInnerSheets * sleeveInnerPrice;

    const perUnitWrapAreaM2 =
      mm2ToM2(S.layouts.tray.wrap.w,   S.layouts.tray.wrap.h) +
      mm2ToM2(S.layouts.sleeve.wrap.w, S.layouts.sleeve.wrap.h);

    areaPrintM2 = (i.print === "fullWrap" ? perUnitWrapAreaM2 : 0) * qty;
    areaLamM2   = perUnitWrapAreaM2 * qty;
    areaLogosM2 = (i.print === "logosOnly" ? logosAreaM2(i.logosMeta) : 0);

  } else {
    // Прочие (фоллбэк)
    const sM2 = surfaceAreaM2(W, H, D);
    const perUnitWrapAreaM2 = sM2 * 0.5;
    const boardSheets = Math.ceil((sM2 * qty) / mm2ToM2(SHEET.W, SHEET.H));
    const wrapSheets  = Math.ceil((perUnitWrapAreaM2 * qty) / mm2ToM2(SHEET.W, SHEET.H));
    sheets.board = boardSheets; sheets.wrap = wrapSheets; sheets.inner = 0;
    const boardPrice = SHEET_PRICE[i.baseBoard ?? "chip_1_5"];
    const wrapPrice  = SHEET_PRICE[i.wrapPaper ?? "designer_120"];
    materialCost = boardSheets * boardPrice + wrapSheets * wrapPrice;
    areaPrintM2 = (i.print === "fullWrap" ? perUnitWrapAreaM2 : 0) * qty;
    areaLamM2   = perUnitWrapAreaM2 * qty;
    areaLogosM2 = (i.print === "logosOnly" ? logosAreaM2(i.logosMeta) : 0);
  }

  /* ---------- ЛАМИНАЦИЯ ---------- */
  let laminationCost = 0;
  if (i.wrapPaper !== "designer_120") {
    let lam: Lam = (i.boxType === "casket") ? (i.wrapLamination ?? "none") : (i.lamination ?? "none");
    if (lam === "none") lam = "matt"; // обязательна при 150 г/м²
    laminationCost = RATES.lamination[lam] * areaLamM2;
  }

  /* ---------- ПЕЧАТЬ ---------- */
  const printCost = (i.print === "fullWrap" ? RATES.print.fullWrap * areaPrintM2 : RATES.print.logosOnly * areaLogosM2);

  /* ---------- КЛИШЕ ---------- */
  const clicheRows: { index:number; side:string; wMM:number; hMM:number; areaCm2:number; processes:number; cost:number; }[] = [];
  const procs = (i.finishing?.blindEmboss ? 1 : 0) + (i.finishing?.foilStamp ? 1 : 0);
  let idx = 1;
  if (procs && i.logosMeta) {
    for (const l of i.logosMeta) {
      const areaCm2 = (Math.max(0, l.wMM) * Math.max(0, l.hMM)) / 100;
      const cost = areaCm2 * CLICHE_CM2_RATE * procs;
      clicheRows.push({ index: idx++, side: l.side, wMM: Math.round(l.wMM), hMM: Math.round(l.hMM), areaCm2: Math.round(areaCm2*10)/10, processes: procs, cost: Math.round(cost) });
    }
  }
  const clicheTotalAreaCm2 = Math.round(sum(clicheRows, r => r.areaCm2));
  const clicheCost = Math.round(sum(clicheRows, r => r.cost));

  /* ---------- ОТДЕЛКА / РАБОТЫ ---------- */
  let finishingCost = 0;
  if (i.finishing?.spotUV) {
    const areaForUV = (i.print === "logosOnly" && logosAreaM2(i.logosMeta) > 0)
      ? logosAreaM2(i.logosMeta)
      : (areaLamM2 / Math.max(1, i.quantity)); // приблизительно
    finishingCost += RATES.spotUV * areaForUV * i.quantity;
  }
  if (i.finishing?.magnetsPair) finishingCost += RATES.magnetsPairPerBox * qty;

  let workCost = 0;
  workCost += RATES.work.guillotineCut    * qty;
  workCost += RATES.work.bottomLamination * qty;
  workCost += RATES.work.diecut           * qty;
  workCost += RATES.work.cornerGlue       * qty;
  workCost += RATES.work.wrap             * qty;
  workCost += RATES.work.lidGlue          * qty;
  const stampingProcs = (i.finishing?.blindEmboss ? 1 : 0) + (i.finishing?.foilStamp ? 1 : 0);
  if (stampingProcs > 0) workCost += RATES.work.stamping * qty * stampingProcs;
  workCost += RATES.work.pack * qty;
  workCost += RATES.setup;

  const subtotal = materialCost + laminationCost + printCost + finishingCost + workCost;
  const overhead = subtotal * RATES.overheadPct;
  const discount = subtotal * tierDiscount(qty);
  const total = subtotal + overhead - discount;
  const perUnit = total / qty;

  return {
    currency: cur,
    sheets,
    sheetsBreakdown, // <— добавлено для UI
    materialCost,
    laminationCost,
    printCost,
    finishingCost,
    workCost,
    overhead,
    discount,
    total,
    perUnit,
    areaM2: (sheets.wrap + sheets.inner + sheets.board) * mm2ToM2(SHEET.W, SHEET.H) / Math.max(1, qty),
    cliche: { totalAreaCm2: clicheTotalAreaCm2, processes: procs },
    clicheCost,
    clicheBreakdown: clicheRows,
  };
}

/* ===== алиас для совместимости с импортами estimatePrice ===== */
export { estimateCost as estimatePrice };
