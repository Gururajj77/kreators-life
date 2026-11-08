#!/usr/bin/env node
/**
 * Every inbox note opens a real place (2026-11-07, the founder: "ensure the notifications open the right page and sections too"). Run by
 * scripts/scan.sh; prints one line per bad link on stdout and exits 1 when there is any.
 *
 * It reads every call of `noteStmt` (apps/api/src/notes.ts), `notify` and `notifyMany` (db.ts) in apps/api/src with the TypeScript
 * parser and works out the links each can store: string and template literals, either side of `? :`, `??` and `||`, a const or a
 * function in the same file, and a parameter of a wrapper by the arguments its callers pass (any file). A part it cannot know (an id)
 * stands for one segment. Then each link must:
 * - be a path inside the app (it starts with one `/`), on a route in apps/web/src/App.tsx that is not a redirect (`Navigate`, `OldPath`);
 * - carry a hash only when that hash is an id the web app draws (`id="..."`, a template id such as `reply-${r.id}`, a default
 *   `id = '...'`, or a word in a `data-land` list), so lib/useLandOnHash.ts has something to land on.
 * A link it cannot work out (a column read from SQL, a property of a row) needs a comment on the call or the three lines above it,
 * `note-link: /party/:id, /circles/:id`, naming every link it can be (`:x` is one segment; `none` for no link); those are checked
 * the same way. The table of moved links in apps/web/src/screens/Inbox.tsx (`MOVED`, old notes opened in the new place) is checked too.
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const require = createRequire(join(ROOT, 'apps/api/package.json'));
const ts = require('typescript');

const PH = '\u0001'; // one segment the code fills in at run time
const NONE = '\u0000none';
const WRITERS = new Set(['noteStmt', 'notify', 'notifyMany']);
const LINK_ARG = { notify: 5, notifyMany: 5 };

function walk(dir, ext, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.some((e) => p.endsWith(e)) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// ---- what the web app has: routes and ids ----
const appSrc = readFileSync(join(ROOT, 'apps/web/src/App.tsx'), 'utf8');
const routes = [];
for (const line of appSrc.split('\n')) {
  const m = /\{\s*path:\s*'([^']+)'/.exec(line);
  if (!m || m[1] === '*') continue;
  if (/\b(Navigate|OldPath)\b/.test(line)) continue;
  const re = new RegExp(`^${m[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+').replace(/\*/g, '.*')}$`);
  routes.push({ path: m[1], re });
}
const ids = new Set();
const idPatterns = [];
for (const file of walk(join(ROOT, 'apps/web/src'), ['.tsx', '.ts'])) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bid=(?:"([^"{}]+)"|'([^'{}]+)'|\{\s*['"]([^'"]+)['"]\s*\})/g)) ids.add(m[1] ?? m[2] ?? m[3]);
  for (const m of src.matchAll(/\bid\s*=\s*'([\w-]+)'/g)) ids.add(m[1]);
  for (const m of src.matchAll(/data-land="([^"]+)"/g)) for (const w of m[1].split(/\s+/)) ids.add(w);
  for (const m of src.matchAll(/\bid=\{\s*`([^`]+)`\s*\}/g)) {
    const literal = m[1].replace(/\$\{[^}]*\}/g, '');
    if (!literal.replace(/[-_]/g, '')) continue; // a bare `${id}` says nothing
    idPatterns.push(new RegExp(`^${m[1].split(/\$\{[^}]*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`));
  }
}
const hasId = (h) => ids.has(h) || idPatterns.some((re) => re.test(h));

/** Why a link would not land, or null when it is fine. */
function problem(link) {
  if (link === NONE) return null;
  if (!link.startsWith('/') || link.startsWith('//')) return 'not a path inside the app';
  const hashAt = link.indexOf('#');
  const beforeHash = hashAt === -1 ? link : link.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : link.slice(hashAt + 1);
  const path = beforeHash.split('?')[0].replaceAll(PH, 'x1');
  if (!routes.some((r) => r.re.test(path))) return `no route for ${path} in App.tsx`;
  if (hashAt !== -1) {
    const h = hash.replaceAll(PH, 'x1');
    if (!h) return 'an empty hash';
    if (!hasId(h)) return `no element with id "${hash.replaceAll(PH, ':id')}" in apps/web/src`;
  }
  return null;
}

// ---- the notes the API writes ----
const apiFiles = walk(join(ROOT, 'apps/api/src'), ['.ts']);
const sources = apiFiles.map((f) => ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true));
const calledName = (n) => (ts.isIdentifier(n.expression) ? n.expression.text : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : '');
const callsByName = new Map();
for (const sf of sources) {
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const name = calledName(n);
      if (name) (callsByName.get(name) ?? callsByName.set(name, []).get(name)).push(n);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const PASS = Symbol('pass'); // the parameter of notify or notifyMany themselves: checked at their callers
const strip = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression?.(n))) n = n.expression;
  return n;
};
const fnName = (fn) => (fn.name && ts.isIdentifier(fn.name) ? fn.name.text : ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) ? fn.parent.name.text : null);

function lookup(id) {
  const name = id.text;
  for (let p = id.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p) && p.parameters) {
      const i = p.parameters.findIndex((pr) => ts.isIdentifier(pr.name) && pr.name.text === name);
      if (i >= 0) return { param: p, index: i };
    }
    const stmts = p.statements;
    if (stmts) {
      for (const st of stmts) {
        if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) return { decl: d };
        if (ts.isFunctionDeclaration(st) && st.name?.text === name) return { fn: st };
      }
    }
  }
  return null;
}

function returned(fn) {
  if (!fn.body) return null;
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out = [];
  const visit = (n) => {
    if (ts.isFunctionLike(n) && n !== fn) return;
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return out.length ? out : null;
}

/** The links an expression can be: strings holding PH for a part only known at run time, null when it cannot be told. */
function resolve(node, bound, depth = 0) {
  const n = strip(node);
  if (!n || depth > 10) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return [n.text];
  if (n.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(n) && n.text === 'undefined')) return [NONE];
  if (ts.isTemplateExpression(n)) {
    let outs = [n.head.text];
    for (const span of n.templateSpans) {
      const r = resolve(span.expression, bound, depth + 1);
      const parts = r && r.length <= 8 && !r.includes(PASS) ? r.map((x) => (x === NONE ? '' : x)) : [PH];
      outs = outs.flatMap((o) => parts.map((p) => o + p + span.literal.text)).slice(0, 64);
    }
    return outs;
  }
  if (ts.isConditionalExpression(n)) return both(resolve(n.whenTrue, bound, depth + 1), resolve(n.whenFalse, bound, depth + 1));
  if (ts.isBinaryExpression(n) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(n.operatorToken.kind)) {
    return both(resolve(n.left, bound, depth + 1), resolve(n.right, bound, depth + 1));
  }
  if (ts.isIdentifier(n)) {
    const found = lookup(n);
    if (!found) return null;
    if (found.decl) return found.decl.initializer ? resolve(found.decl.initializer, bound, depth + 1) : null;
    if (found.param) {
      if (bound.has(found.param)) return [PH];
      const name = fnName(found.param);
      if (name === 'notify' || name === 'notifyMany') return [PASS];
      if (!name) return null;
      const callers = callsByName.get(name) ?? [];
      if (callers.length === 0) return null;
      let out = [];
      for (const call of callers) {
        const arg = call.arguments[found.index] ?? found.param.parameters[found.index].initializer;
        const r = arg ? resolve(arg, bound, depth + 1) : [NONE];
        if (!r) return null;
        out = out.concat(r);
      }
      return out;
    }
    return null;
  }
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
    const found = lookup(n.expression);
    const fn = found?.fn ?? (found?.decl?.initializer && (ts.isArrowFunction(found.decl.initializer) || ts.isFunctionExpression(found.decl.initializer)) ? found.decl.initializer : null);
    const rets = fn ? returned(fn) : null;
    if (!rets) return null;
    const inner = new Set(bound).add(fn);
    let out = [];
    for (const r of rets) {
      const x = resolve(r, inner, depth + 1);
      if (!x) return null;
      out = out.concat(x);
    }
    return out;
  }
  return null;
}
const both = (a, b) => (a && b ? [...a, ...b] : null);

function linkExpr(call) {
  const name = calledName(call);
  if (name === 'noteStmt') {
    const obj = strip(call.arguments[1]);
    if (!obj || !ts.isObjectLiteralExpression(obj)) return { unknown: true };
    const prop = obj.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'link');
    if (!prop) return obj.properties.some((p) => ts.isSpreadAssignment(p)) ? { unknown: true } : { none: true };
    if (ts.isShorthandPropertyAssignment(prop)) return { expr: prop.name };
    if (ts.isPropertyAssignment(prop)) return { expr: prop.initializer };
    return { unknown: true };
  }
  const arg = call.arguments[LINK_ARG[name]];
  return arg ? { expr: arg } : { none: true };
}

function annotation(sf, call) {
  let st = call;
  while (st.parent && !ts.isSourceFile(st.parent) && !ts.isBlock(st.parent)) st = st.parent;
  const lines = sf.text.split('\n');
  const from = sf.getLineAndCharacterOfPosition(st.getFullStart()).line;
  const to = sf.getLineAndCharacterOfPosition(call.getEnd()).line;
  for (let i = Math.max(0, from - 3); i <= to; i++) {
    const m = /note-link:\s*(.+?)\s*(?:\*\/)?$/.exec(lines[i] ?? '');
    if (m) return m[1].split(',').map((x) => x.trim()).filter(Boolean).map((x) => (x === 'none' ? NONE : x.replace(/:[A-Za-z]+/g, PH)));
  }
  return null;
}

const out = [];
let calls = 0;
let links = 0;
for (const sf of sources) {
  const visit = (n) => {
    if (ts.isCallExpression(n) && WRITERS.has(calledName(n)) && !ts.isImportSpecifier(n.parent)) {
      const where = `${relative(ROOT, sf.fileName)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
      // The definitions of notify and notifyMany only pass their `link` on; their callers are the ones checked.
      const e = linkExpr(n);
      let list = annotation(sf, n);
      if (!list) list = e.none ? [NONE] : e.unknown ? null : resolve(e.expr, new Set());
      if (list && list.includes(PASS)) {
        ts.forEachChild(n, visit);
        return;
      }
      calls += 1;
      if (!list) out.push(`${where}: cannot tell where this note's link goes; add a comment "note-link: /path/:id#section" naming every link it can be`);
      else
        for (const link of new Set(list)) {
          links += 1;
          const why = problem(link);
          if (why) out.push(`${where}: ${link === NONE ? 'none' : link.replaceAll(PH, ':id')}: ${why}`);
        }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// Old notes keep the link they were stored with; Inbox.tsx's MOVED table opens them in the new place, and its targets must land too.
const inbox = readFileSync(join(ROOT, 'apps/web/src/screens/Inbox.tsx'), 'utf8');
const moved = /const MOVED\b[\s\S]*?\n\];/.exec(inbox);
if (moved) {
  for (const m of moved[0].matchAll(/\bto:\s*'([^']*)'/g)) {
    links += 1;
    const why = problem(m[1]);
    if (why) out.push(`apps/web/src/screens/Inbox.tsx (MOVED): ${m[1]}: ${why}`);
  }
}

for (const line of out) console.log(line);
console.error(`note links: ${calls} note writers, ${links} links checked against ${routes.length} routes and ${ids.size + idPatterns.length} ids, ${out.length} problem(s)`);
process.exit(out.length ? 1 : 0);
