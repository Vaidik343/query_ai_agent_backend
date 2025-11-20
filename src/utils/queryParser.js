// src/utils/queryParser.js
// Rule-based natural language -> SQL parser for FoodReports table
// Returns: { success, sql, replacements, summary } or { success: false, error }

const DAY_SECONDS = 86400;

// whitelist columns (exact DB names / allowed to use)
const ALLOWED_COLUMNS = {
  lab_id: 'lab_id',
  protein: 'protein',
  fat: 'fat',
  weight: 'weight',
  expiry: 'expiry',
  created_at: 'created_at'
};

const AGG_FUNCS = ['avg', 'sum', 'min', 'max', 'count'];

/**
 * parsePrompt(text)
 * returns internal object representing user intent
 */
function parsePrompt(text) {
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'empty prompt' };
  }

  const raw = text.trim();
  const lowercase = raw.toLowerCase();

  // default response object
  const intent = {
    type: 'select', // 'aggregate' or 'select'
    agg: null,
    aggColumn: null,
    columns: ['lab_id','protein','fat','weight','expiry'], // default columns to return for select
    filters: [], // {col, op, val}
    orderBy: null,
    order: 'DESC',
    limit: 100,
    dateRange: null // {column, fromSQL, desc}
  };

  // 1) detect aggregate
  for (const f of AGG_FUNCS) {
    // patterns: avg of protein, average protein, sum of fat
    const reAgg = new RegExp(`\\b(${f}|average|avg|sum|min|max|count)\\b.*\\b(${Object.keys(ALLOWED_COLUMNS).join('|')})\\b`);
    if (reAgg.test(lowercase)) {
      // map aliases
      let func = f;
      if (/average|avg/.test(lowercase) && (f === 'avg')) func = 'avg';
      if (/count/.test(lowercase) && f === 'count') func = 'count';
      intent.type = 'aggregate';
      intent.agg = f;
      // find which column was referenced
      const colMatch = lowercase.match(new RegExp(`\\b(${Object.keys(ALLOWED_COLUMNS).join('|')})\\b`));
      if (colMatch) intent.aggColumn = ALLOWED_COLUMNS[colMatch[1]];
      break;
    }
  }

  // 2) detect comparisons like "protein greater than 10" / "protein > 10"
  // support multiple filters
  const comparisonPatterns = [
    {re: /(\b(?:protein|fat|weight|expiry)\b)\s*(?:>=|greater than or equal to)\s*([0-9]+(?:\.[0-9]+)?)/i, op: '>='},
    {re: /(\b(?:protein|fat|weight|expiry)\b)\s*(?:<=|less than or equal to)\s*([0-9]+(?:\.[0-9]+)?)/i, op: '<='},
    {re: /(\b(?:protein|fat|weight|expiry)\b)\s*(?:>|greater than|higher than)\s*([0-9]+(?:\.[0-9]+)?)/i, op: '>'},
    {re: /(\b(?:protein|fat|weight|expiry)\b)\s*(?:<|less than|lower than)\s*([0-9]+(?:\.[0-9]+)?)/i, op: '<'},
    {re: /(\b(?:protein|fat|weight|expiry)\b)\s*(?:=|is|equals?)\s*([0-9]+(?:\.[0-9]+)?)/i, op: '='},
    // between pattern: "protein between 5 and 10"
    {re: /(\b(?:protein|fat|weight|expiry)\b)\s*between\s*([0-9]+(?:\.[0-9]+)?)\s*and\s*([0-9]+(?:\.[0-9]+)?)/i, op: 'BETWEEN'}
  ];

  for (const p of comparisonPatterns) {
    let m;
    const searchStart = 0;
    const loopText = lowercase;
    while ((m = p.re.exec(loopText)) !== null) {
      const col = ALLOWED_COLUMNS[m[1]];
      if (!col) break;
      if (p.op === 'BETWEEN') {
        intent.filters.push({ col, op: 'BETWEEN', val1: Number(m[2]), val2: Number(m[3]) });
      } else {
        intent.filters.push({ col, op: p.op, val: Number(m[2]) });
      }
      // replace matched text so we don't infinite loop; safe since we use same loop
      break; // only take first match per pattern (fine for simple queries)
    }
  }

  // 3) detect "top" / "highest" / "lowest" ordering
  if (/\b(top|highest|largest|highest protein|highest fat|top )\b/.test(lowercase) || /order by .*desc/.test(lowercase)) {
    // find column for order
    const colMatch = lowercase.match(new RegExp(`\\b(?:protein|fat|weight|expiry)\\b`));
    if (colMatch) {
      intent.orderBy = ALLOWED_COLUMNS[colMatch[0]];
      intent.order = 'DESC';
    }
  }
  if (/\b(lowest|smallest|least|min|min )\b/.test(lowercase) || /order by .*asc/.test(lowercase)) {
    const colMatch = lowercase.match(new RegExp(`\\b(?:protein|fat|weight|expiry)\\b`));
    if (colMatch) {
      intent.orderBy = ALLOWED_COLUMNS[colMatch[0]];
      intent.order = 'ASC';
    }
  }

  // 4) detect limit: "give me 10000" or "top 100"
  const limMatch = lowercase.match(/(?:limit|top|first|give me)\s*(\d{1,6})/i) || lowercase.match(/\b(\d{2,6})\s*(results|rows|items|entries)\b/i);
  if (limMatch) {
    const l = Number(limMatch[1]);
    intent.limit = Math.min(l, 100000); // hard cap
  }

  // 5) detect "last N days" => created_at filter
  const lastDays = lowercase.match(/last\s+(\d{1,4})\s+days?/i);
  if (lastDays) {
    const days = Number(lastDays[1]);
    // We'll build SQL using now() - interval 'N days'
    intent.dateRange = { column: 'created_at', days };
    // also when dateRange used, restrict default order maybe by created_at desc
    intent.orderBy = intent.orderBy || 'created_at';
    intent.order = intent.order || 'DESC';
  }

  // 6) "nearest expiry" or "expiring soon" -> order by expiry asc
  if (/\b(expir|expir?ing soon|nearest expiry|nearest expiring)\b/.test(lowercase)) {
    intent.orderBy = 'expiry';
    intent.order = 'ASC';
  }

  // 7) if aggregate but no aggColumn, maybe user asked "count" or "how many"
  if (intent.type === 'aggregate' && !intent.aggColumn) {
    if (/\bcount\b|\bhow many\b/.test(lowercase)) {
      intent.agg = 'count';
      intent.aggColumn = '*';
    }
  }

  // if not aggregate, set default orderBy if none
  if (intent.type === 'select' && !intent.orderBy) {
    intent.orderBy = 'protein';
    intent.order = 'DESC';
  }

  return { success: true, intent };
}

/**
 * buildSQL(labId, intent)
 * returns { success, sql, replacements, summary }
 */
function buildSQL(labId, intentObj) {
  if (!intentObj || !intentObj.intent) {
    // allow passing intent directly
    if (!intentObj) return { success: false, error: 'missing intent' };
  }

  const intent = intentObj.intent || intentObj;

  // validate labId numeric
  const labIdNum = Number(labId);
  if (Number.isNaN(labIdNum)) {
    return { success: false, error: 'invalid labId' };
  }

  const replacements = { labId: labIdNum };
  let whereClauses = [`lab_id = :labId`];

  // handle filters
  let idx = 0;
  for (const f of intent.filters || []) {
    idx++;
    if (!ALLOWED_COLUMNS[f.col]) {
      // disallow unknown columns
      return { success: false, error: `disallowed column ${f.col}` };
    }

    if (f.op === 'BETWEEN') {
      replacements[`v${idx}_1`] = f.val1;
      replacements[`v${idx}_2`] = f.val2;
      whereClauses.push(`(${f.col} BETWEEN :v${idx}_1 AND :v${idx}_2)`);
    } else {
      // numeric comparison
      replacements[`v${idx}`] = f.val;
      whereClauses.push(`(${f.col} ${f.op} :v${idx})`);
    }
  }

  // dateRange
  if (intent.dateRange && intent.dateRange.days) {
    // use Postgres interval expression; no direct replacement for interval so embed integer
    const days = Number(intent.dateRange.days);
    whereClauses.push(`${intent.dateRange.column} >= (now() - interval '${days} days')`);
  }

  // build SQL
  let sql = '';
  let summary = '';

  if (intent.type === 'aggregate' && intent.agg) {
    const agg = intent.agg.toLowerCase();
    const col = intent.aggColumn === '*' ? '*' : ALLOWED_COLUMNS[intent.aggColumn] || intent.aggColumn;
    if (!col && intent.aggColumn !== '*') return { success: false, error: 'invalid aggregate column' };

    const aggExpr = agg === 'count' ? `COUNT(${col === '*' ? '*' : col})` : `${agg.toUpperCase()}(${col})`;
    sql = `SELECT ${aggExpr} AS value FROM "FoodReports" WHERE ${whereClauses.join(' AND ')}`;
    if (intent.orderBy) {
      sql += ` ORDER BY "${intent.orderBy}" ${intent.order}`;
    }
    sql += `;`;

    summary = `${agg.toUpperCase()} of ${intent.aggColumn} for lab ${labIdNum}`;

  } else {
    // SELECT list: use specified columns
    const cols = (intent.columns || ['lab_id','protein','fat','weight','expiry']).map(c => {
      if (ALLOWED_COLUMNS[c]) return `"${ALLOWED_COLUMNS[c]}"`;
      return `"${c}"`;
    }).join(', ');

    sql = `SELECT ${cols} FROM "FoodReports" WHERE ${whereClauses.join(' AND ')}`;

    if (intent.orderBy) {
      const ob = ALLOWED_COLUMNS[intent.orderBy] ? `"${ALLOWED_COLUMNS[intent.orderBy]}"` : `"${intent.orderBy}"`;
      sql += ` ORDER BY ${ob} ${intent.order || 'DESC'}`;
    }

    if (intent.limit) {
      sql += ` LIMIT ${Number(intent.limit)}`;
    }
    sql += `;`;

    summary = `Selected rows for lab ${labIdNum}`;
  }

  return { success: true, sql, replacements, summary };
}

// convenience: top-level function to parse+build
function parseAndBuild(labId, text, options = {}) {
  const parsed = parsePrompt(text);
  if (!parsed.success) return parsed;

  const built = buildSQL(labId, parsed);

  // --- NEW: embed values for logging/cache if requested ---
  if (options.embedValues && built.success && built.replacements) {
  let sqlWithValues = built.sql;
  for (const [key, val] of Object.entries(built.replacements)) {
    const safeVal = typeof val === "string" ? `'${val}'` : val;
    // replace exact placeholder with actual value
    sqlWithValues = sqlWithValues.replace(new RegExp(`:${key}\\b`, "g"), safeVal);
  }
  built.sqlEmbedded = sqlWithValues; // for logging/cache
}


  return built;
}


module.exports = { parsePrompt, buildSQL, parseAndBuild };
