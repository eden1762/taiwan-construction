const LK = "tcmap.lang";
const ACTIVE_DATA = "./data/active_construction_projects.geojson?v=20260830-candidates";

const CANDIDATE_FILES = [
  "data/active_project_candidates_20260627_run2.geojson",
  "data/active_project_candidates_20260627_run2_b.geojson",
  "data/candidates_to_verify.geojson",
  "data/candidate/20260703-rail-candidates-02.json",
  "data/candidate_batches/20260702-run16-roads-rail-review.json",
  "data/candidate_batches/20260702-run16-transport-road-candidates.json",
  "data/candidate_batches/20260703-port-airport-01.json",
  "data/candidate_batches/20260703-road-publicworks-01.json",
  "data/candidates/2026-06-30-run-13-candidate-leads.json",
  "data/candidates/2026-06-30-run-14-candidate-verification-queue.json",
  "data/candidates/2026-06-30-run-15-candidate-evidence-notes.json",
  "data/candidates/2026-06-30-run-16-candidate-active-reconciliation.json",
  "data/candidates/2026-07-02-run16-public-works-candidates.json",
  "data/candidates/2026-07-03-railway-land-and-station-candidates.geojson",
  "data/candidates/2026-07-03-run-16-road-highway-candidates.json",
  "data/candidates/2026-07-04-railway-bureau-candidates.json",
  "data/candidates/20260702-1602-rail-planning-candidates.json",
  "data/candidates/20260702-1759-roads-official-review.json",
  "data/candidates/20260702-transit-planning-candidates.json",
  "data/candidates/20260702-transport-source-review-candidates.json",
  "data/candidates/20260702_metro_south_batch.json",
  "data/candidates/20260703-0456-official-candidates.json",
  "data/candidates/20260703-2101-railway-planning-candidates.json",
  "data/candidates/20260703-run16-road-candidates.json",
  "data/candidates/20260703-xidong-metro-official-candidates.json",
  "data/candidates/20260703T1404_transport_water_candidates.json",
  "data/candidates/20260703T1700_transport_airport_candidates.json",
  "data/candidates/candidate_projects_20260702_1954_public_transport_energy.json",
  "data/candidates/candidates-20260703-0355.json",
  "data/candidates/test-20260702.json",
  "data/research/2026-07-03-1800-rail-project-candidates.json",
  "data/import_batches/2026-07-01-run-30-candidate-import.json",
  "data/import_batches/2026-07-01-run-32-candidate-source-rotation.json",
  "data/import_batches/2026-07-01-run-33-road-candidate-rotation.json",
  "data/import_batches/2026-07-01-run-37-railway-candidates.json",
  "data/import_batches/2026-07-01-run-38-water-public-works-candidates.json",
  "data/import_batches/2026-07-01-run-39-metro-transport-candidates.json",
  "data/import_batches/2026-07-02-run-41-port-airport-road-candidates.json",
  "data/import_batches/2026-07-02-run-42-rail-planning-candidates.json",
  "data/import_batches/2026-07-03-run-43-buildings-airport-candidates.json",
  "data/import_batches/2026-07-03-run-44-park-and-public-building-candidates.json",
  "data/import_batches/2026-07-03-run-45-water-resilience-candidates.json",
  "data/import_batches/2026-07-03-run-47-transport-airport-candidates.json"
];

const MENU = [
  ["全國工程概況", "National Overview", "./index.html"],
  ["公共工程", "Public Works", "./category.html?sector=public-works"],
  ["道路/管線", "Roads & Utilities", "./category.html?sector=roads-utilities"],
  ["捷運/交通", "Metro & Transport", "./category.html?sector=transit"],
  ["建築/園區", "Buildings & Parks", "./category.html?sector=buildings-parks"],
  ["規劃/環評", "Planning & Environmental Review", "./category.html?sector=planning-eia"],
  ["候選工程", "Candidate Projects", "./candidates.html"],
  ["資料入口", "Data Sources", "./sources.html"]
];

const CATEGORY_EN = {
  "公共工程": "Public Works",
  "道路/管線": "Roads & Utilities",
  "捷運/交通": "Metro & Transport",
  "建築/園區": "Buildings & Parks",
  "規劃/環評": "Planning & Environmental Review"
};

const MISSING_EN = {
  "甲方/主管機關": "Owner / agency",
  "可回查官方來源": "Traceable official source",
  "最新工程狀態": "Current project status",
  "精確位置": "Precise location",
  "精確 Geometry": "Precise geometry",
  "工程期程": "Schedule",
  "去重確認": "Deduplication check",
  "承攬廠商": "Contractor",
  "預算/決標金額": "Budget / award amount",
  "工程範圍/標案切分": "Scope / contract split",
  "候選查核未完成": "Candidate verification incomplete"
};

let lang = localStorage.getItem(LK) === "en" ? "en" : "zh";
let allRows = [];
let loadedFileCount = 0;
let mappedMatchCount = 0;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const valid = v => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
const pick = (o, keys) => keys.map(k => o?.[k]).find(valid);
const arr = v => Array.isArray(v) ? v : valid(v) ? [v] : [];
const basename = p => String(p || "").split("/").pop() || p;

function normalizeName(v) {
  return String(v || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　·・,，.。:：;；()（）\[\]【】「」『』\-_/]/g, "")
    .replace(/臺/g, "台")
    .replace(/計劃/g, "計畫");
}

function isPlaceholder(v) {
  if (!valid(v)) return true;
  return /待|未定|未知|unknown|to be verified|n\/a|查核|補齊|確認/i.test(String(v));
}

function cleanUrl(v) {
  if (!valid(v)) return "";
  try {
    const u = new URL(String(v), location.href);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

function fileMeta(data) {
  return {
    batchId: pick(data, ["batch_id", "run_id", "id"]),
    createdAt: pick(data, ["created_at", "fetched_at", "updated_at", "date"]),
    parentReason: pick(data, [
      "excluded_from_active_reason",
      "why_no_active_promotion_zh",
      "candidate_policy_zh",
      "public_visibility_note",
      "public_visibility",
      "purpose_zh"
    ])
  };
}

function looksLikeProject(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const name = pick(o, ["normalized_name", "name_zh", "name", "raw_candidate_name", "project_name_zh", "project_name"]);
  if (!valid(name)) return false;
  return Boolean(
    pick(o, ["candidate_id", "lead_id", "project_id", "dedupe_key", "category", "sector", "owner", "address", "location_hint_zh", "source_url", "candidate_status", "geometry_status"]) ||
    o.active_map_allowed === false ||
    Array.isArray(o.must_confirm_fields)
  );
}

function toRecord(o, geometry, meta, path) {
  const name = pick(o, ["normalized_name", "name_zh", "name", "raw_candidate_name", "project_name_zh", "project_name"]);
  return {
    name: String(name || "").trim(),
    nameEn: pick(o, ["name_en", "project_name_en"]),
    category: pick(o, ["category", "sector", "category_zh", "project_category"]),
    status: pick(o, ["preliminary_status", "initial_status", "status", "status_hint_zh", "project_status", "current_status"]),
    location: pick(o, ["address", "location_hint_zh", "location", "location_zh", "site", "area"]),
    owner: pick(o, ["owner", "owner_agency", "agency", "client", "authority"]),
    contractor: pick(o, ["contractor", "award_vendor", "vendor", "builder"]),
    budget: pick(o, ["budget_ntd", "budget", "amount_ntd", "award_amount_ntd", "contract_amount_ntd"]),
    start: pick(o, ["start_date", "construction_start", "started_at", "start"]),
    end: pick(o, ["planned_end_date", "end_date", "planned_end", "completion_date", "end"]),
    sourceName: pick(o, ["source_name", "official_source_name", "discovery_source_name", "source"]),
    sourceUrl: pick(o, ["source_url", "official_source_url", "url"]),
    secondarySourceUrl: pick(o, ["secondary_source_url", "source_url_2"]),
    dedupeKey: pick(o, ["dedupe_key", "dedup_key", "canonical_key"]),
    geometry: geometry || pick(o, ["geometry", "rough_geometry"]),
    geometryStatus: pick(o, ["geometry_status", "map_geometry_status"]),
    mustConfirm: arr(pick(o, ["must_confirm_fields", "missing_fields", "required_fields", "verification_missing"])),
    notes: arr(pick(o, ["verification_note", "review_note", "decision_note", "missing_data_note", "reason", "note"])),
    officialNeeded: pick(o, ["official_source_needed_zh", "official_source_needed"]),
    activeAllowed: o.active_map_allowed,
    candidateStatus: pick(o, ["candidate_status", "current_decision", "decision"]),
    createdAt: pick(o, ["created_at", "fetched_at", "source_retrieved_at", "updated_at"]) || meta.createdAt,
    parentReason: meta.parentReason,
    paths: [path],
    rawIds: arr(pick(o, ["candidate_id", "lead_id", "project_id"]))
  };
}

function extractRecords(data, path) {
  const out = [];
  const meta = fileMeta(data || {});

  function walk(node, inheritedMeta = meta) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(x => walk(x, inheritedMeta));
      return;
    }
    if (typeof node !== "object") return;

    if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
      node.features.forEach(f => {
        if (f?.type === "Feature" && looksLikeProject(f.properties || {})) {
          out.push(toRecord(f.properties || {}, f.geometry, inheritedMeta, path));
        }
      });
      return;
    }

    if (node.type === "Feature" && looksLikeProject(node.properties || {})) {
      out.push(toRecord(node.properties || {}, node.geometry, inheritedMeta, path));
      return;
    }

    if (looksLikeProject(node)) out.push(toRecord(node, null, inheritedMeta, path));

    const nextMeta = {
      batchId: pick(node, ["batch_id", "run_id", "id"]) || inheritedMeta.batchId,
      createdAt: pick(node, ["created_at", "fetched_at", "updated_at", "date"]) || inheritedMeta.createdAt,
      parentReason: pick(node, ["excluded_from_active_reason", "why_no_active_promotion_zh", "candidate_policy_zh", "public_visibility_note", "public_visibility", "purpose_zh"]) || inheritedMeta.parentReason
    };

    Object.entries(node).forEach(([key, value]) => {
      if (["geometry", "rough_geometry", "coordinates", "dedupe_focus", "verification_rules", "source_rotation", "official_sources_to_check", "dedupe_keys_to_compare", "must_confirm_fields"].includes(key)) return;
      if (value && typeof value === "object") walk(value, nextMeta);
    });
  }

  walk(data, meta);
  return out;
}

function activeKeys(data) {
  const names = new Set();
  const dedupe = new Set();
  const features = data?.type === "FeatureCollection" ? data.features || [] : [];
  features.forEach(f => {
    const p = f?.properties || {};
    ["normalized_name", "name_zh", "name", "project_name_zh", "project_name"].forEach(k => {
      const n = normalizeName(p[k]);
      if (n) names.add(n);
    });
    const d = normalizeName(p.dedupe_key || p.dedup_key || p.canonical_key);
    if (d) dedupe.add(d);
  });
  return { names, dedupe };
}

function mergeRecords(records) {
  const rows = [];
  const byName = new Map();
  const byDedupe = new Map();

  function choose(base, key, incoming) {
    if (!valid(incoming)) return;
    if (!valid(base[key]) || (isPlaceholder(base[key]) && !isPlaceholder(incoming))) base[key] = incoming;
  }

  records.forEach(r => {
    const nk = normalizeName(r.name);
    const dk = normalizeName(r.dedupeKey);
    let base = (dk && byDedupe.get(dk)) || (nk && byName.get(nk));
    if (!base) {
      base = { ...r, mustConfirm: [...r.mustConfirm], notes: [...r.notes], paths: [...r.paths], rawIds: [...r.rawIds] };
      rows.push(base);
    } else {
      ["nameEn", "category", "status", "location", "owner", "contractor", "budget", "start", "end", "sourceName", "sourceUrl", "secondarySourceUrl", "dedupeKey", "geometry", "geometryStatus", "officialNeeded", "candidateStatus", "createdAt", "parentReason"].forEach(k => choose(base, k, r[k]));
      base.mustConfirm = [...new Set([...base.mustConfirm, ...r.mustConfirm].filter(valid))];
      base.notes = [...new Set([...base.notes, ...r.notes].filter(valid))];
      base.paths = [...new Set([...base.paths, ...r.paths])];
      base.rawIds = [...new Set([...base.rawIds, ...r.rawIds])];
      if (r.activeAllowed === false) base.activeAllowed = false;
    }
    if (nk) byName.set(nk, base);
    if (dk) byDedupe.set(dk, base);
    const mergedName = normalizeName(base.name);
    const mergedDedupe = normalizeName(base.dedupeKey);
    if (mergedName) byName.set(mergedName, base);
    if (mergedDedupe) byDedupe.set(mergedDedupe, base);
  });

  return rows;
}

function mapMustConfirm(text) {
  const s = String(text || "");
  if (/geometry|點位|路廊|座標|位置範圍/.test(s)) return "精確 Geometry";
  if (/位置|地點/.test(s)) return "精確位置";
  if (/來源|主管機關|發包單位|可回查/.test(s)) return "可回查官方來源";
  if (/狀態|active|施工中|規劃|環評|招標階段/.test(s)) return "最新工程狀態";
  if (/期程|日期|完工|通車|啟用|開工/.test(s)) return "工程期程";
  if (/承攬|廠商|得標/.test(s)) return "承攬廠商";
  if (/預算|金額|決標/.test(s)) return "預算/決標金額";
  if (/範圍|分筆|分標|標案|契約|路線區間|站點/.test(s)) return "工程範圍/標案切分";
  if (/去重|dedupe/.test(s)) return "去重確認";
  return "";
}

function missingInfo(r) {
  const tags = new Set();
  r.mustConfirm.forEach(x => {
    const tag = mapMustConfirm(x);
    if (tag) tags.add(tag);
  });

  if (isPlaceholder(r.owner)) tags.add("甲方/主管機關");
  if (!cleanUrl(r.sourceUrl)) tags.add("可回查官方來源");
  if (isPlaceholder(r.status) || /線索/.test(String(r.status || ""))) tags.add("最新工程狀態");
  if (isPlaceholder(r.location)) tags.add("精確位置");
  if (!r.geometry || /candidate|needed|approx|rough|待|verify/i.test(String(r.geometryStatus || ""))) tags.add("精確 Geometry");
  if (!valid(r.start) && !valid(r.end)) tags.add("工程期程");
  if (!valid(r.dedupeKey)) tags.add("去重確認");
  if (isPlaceholder(r.contractor)) tags.add("承攬廠商");
  if (!valid(r.budget) || Number(r.budget) === 0) tags.add("預算/決標金額");
  if (tags.size === 0) tags.add("候選查核未完成");

  const reason = [r.notes[0], r.parentReason, r.officialNeeded].find(valid) || "尚未完成候選工程的正式來源、位置、狀態與去重查核，因此未進入正式地圖資料集。";
  return { tags: [...tags], reason: String(reason) };
}

function isAlreadyMapped(r, keys) {
  const nk = normalizeName(r.name);
  const dk = normalizeName(r.dedupeKey);
  if (nk && keys.names.has(nk)) return true;
  if (dk && keys.dedupe.has(dk)) return true;
  return false;
}

function formatBudget(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 100000000) return `NT$ ${(n / 100000000).toFixed(n >= 1000000000 ? 1 : 2)} 億`;
  if (n >= 10000) return `NT$ ${Math.round(n / 10000).toLocaleString()} 萬`;
  return `NT$ ${n.toLocaleString()}`;
}

function displayCategory(c) {
  if (!valid(c)) return "—";
  return lang === "en" ? (CATEGORY_EN[c] || c) : c;
}

function displayMissing(tag) {
  return lang === "en" ? (MISSING_EN[tag] || tag) : tag;
}

function searchText(r) {
  return [r.name, r.nameEn, r.category, r.status, r.location, r.owner, r.contractor, r.sourceName, r.dedupeKey, r.missing.tags.join(" "), r.missing.reason, ...r.paths].join(" ").toLowerCase();
}

function renderNav() {
  const nav = $("#mainNav");
  if (!nav) return;
  nav.innerHTML = MENU.map(([zh, en, href]) => `<a href="${href}" ${href.includes("candidates.html") ? 'aria-current="page"' : ""}>${esc(lang === "en" ? en : zh)}</a>`).join("");
}

function applyLanguage() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  $$(".zh-only").forEach(el => el.hidden = lang === "en");
  $$(".en-only").forEach(el => el.hidden = lang !== "en");
  const btn = $("#lang");
  if (btn) {
    btn.textContent = lang === "en" ? "中" : "EN";
    btn.setAttribute("aria-label", lang === "en" ? "切換為中文" : "Switch to English");
  }
  const q = $("#candidateQ");
  if (q) q.placeholder = lang === "en" ? "Try Taoyuan MRT, railway, airport" : "例：桃園捷運、鐵路、機場";
  document.title = lang === "en" ? "Candidate Projects | Taiwan Construction Map" : "候選工程｜台灣工程地圖 Taiwan Construction Map";
  renderNav();
  populateFilters(false);
  renderRows();
}

function populateFilters(preserve = true) {
  const cat = $("#candidateCategory");
  const miss = $("#candidateMissing");
  if (!cat || !miss) return;
  const cv = preserve ? cat.value : "";
  const mv = preserve ? miss.value : "";
  const cats = [...new Set(allRows.map(r => r.category).filter(valid))].sort((a,b) => String(a).localeCompare(String(b), "zh-Hant"));
  const misses = [...new Set(allRows.flatMap(r => r.missing.tags))];
  const freq = Object.fromEntries(misses.map(x => [x, allRows.filter(r => r.missing.tags.includes(x)).length]));
  misses.sort((a,b) => (freq[b] - freq[a]) || a.localeCompare(b, "zh-Hant"));
  cat.innerHTML = `<option value="">${lang === "en" ? "All categories" : "全部類別"}</option>` + cats.map(c => `<option value="${esc(c)}">${esc(displayCategory(c))}</option>`).join("");
  miss.innerHTML = `<option value="">${lang === "en" ? "All missing items" : "全部缺項"}</option>` + misses.map(m => `<option value="${esc(m)}">${esc(displayMissing(m))} (${freq[m]})</option>`).join("");
  if (cats.includes(cv)) cat.value = cv;
  if (misses.includes(mv)) miss.value = mv;
}

function renderRows() {
  const body = $("#candidateRows");
  if (!body) return;
  const q = String($("#candidateQ")?.value || "").trim().toLowerCase();
  const category = $("#candidateCategory")?.value || "";
  const missing = $("#candidateMissing")?.value || "";

  const rows = allRows.filter(r => {
    if (q && !searchText(r).includes(q)) return false;
    if (category && r.category !== category) return false;
    if (missing && !r.missing.tags.includes(missing)) return false;
    return true;
  });

  body.innerHTML = rows.map(r => {
    const sourceUrl = cleanUrl(r.sourceUrl);
    const secondUrl = cleanUrl(r.secondarySourceUrl);
    const sourceHtml = sourceUrl
      ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceName || (lang === "en" ? "Official source" : "公開來源"))}</a>${secondUrl ? `<br><a class="muted" href="${esc(secondUrl)}" target="_blank" rel="noopener noreferrer">${lang === "en" ? "Secondary source" : "第二來源"}</a>` : ""}`
      : `<span class="muted">${esc(r.sourceName || (lang === "en" ? "Source URL missing" : "缺來源連結"))}</span>`;
    const files = r.paths.slice(0, 3).map(p => `<a href="./${esc(p)}" target="_blank" rel="noopener noreferrer">${esc(basename(p))}</a>`).join("");
    const more = r.paths.length > 3 ? `<span class="muted">+${r.paths.length - 3} ${lang === "en" ? "files" : "個檔案"}</span>` : "";
    const period = [r.start, r.end].filter(valid).join(" → ") || "—";
    const parties = `${esc(r.owner || "—")}<br><span class="muted">${esc(r.contractor || "—")}</span>`;
    const tags = r.missing.tags.map(t => `<span class="missingTag">${esc(displayMissing(t))}</span>`).join("");
    const reason = r.missing.reason.length > 220 ? `${r.missing.reason.slice(0, 220)}…` : r.missing.reason;
    return `<tr>
      <td><div class="candidateName"><strong>${esc(lang === "en" && r.nameEn ? r.nameEn : r.name)}</strong>${lang === "en" && r.nameEn ? `<small>${esc(r.name)}</small>` : ""}<small>${esc(r.createdAt || "")}</small></div></td>
      <td><span class="candidateTag">${esc(displayCategory(r.category || "—"))}</span></td>
      <td>${esc(r.location || "—")}</td>
      <td>${esc(r.status || "—")}</td>
      <td>${parties}</td>
      <td>${esc(formatBudget(r.budget))}<br><span class="muted">${esc(period)}</span></td>
      <td class="sourceCell">${sourceHtml}</td>
      <td class="missingCol">${tags}<div class="missingReason">${esc(reason)}</div></td>
      <td><div class="fileLinks">${files}${more}</div></td>
    </tr>`;
  }).join("");

  const empty = $("#candidateEmpty");
  if (empty) empty.hidden = rows.length !== 0;
}

async function fetchJson(path) {
  const res = await fetch(`./${path}?v=20260830-candidates`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function loadCandidateFiles() {
  const records = [];
  let failures = 0;
  const batchSize = 8;
  for (let i = 0; i < CANDIDATE_FILES.length; i += batchSize) {
    const slice = CANDIDATE_FILES.slice(i, i + batchSize);
    const results = await Promise.allSettled(slice.map(path => fetchJson(path)));
    results.forEach((result, idx) => {
      const path = slice[idx];
      if (result.status === "fulfilled") {
        loadedFileCount += 1;
        records.push(...extractRecords(result.value, path));
      } else {
        failures += 1;
        console.warn("Candidate file unavailable", path, result.reason);
      }
    });
  }
  return { records, failures };
}

function updateSummary(failures) {
  $("#candidateCount").textContent = allRows.length.toLocaleString();
  $("#sourceFileCount").textContent = loadedFileCount.toLocaleString();
  const counts = {};
  allRows.flatMap(r => r.missing.tags).forEach(t => counts[t] = (counts[t] || 0) + 1);
  const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
  $("#missingTop").textContent = top ? displayMissing(top[0]) : "—";
  const state = $("#loadState");
  if (state) {
    const text = lang === "en"
      ? `Loaded ${loadedFileCount} candidate files and consolidated them into ${allRows.length} unmapped projects. ${mappedMatchCount} records matching the active map were excluded.${failures ? ` ${failures} source files could not be loaded.` : ""}`
      : `已載入 ${loadedFileCount} 個候選來源檔，整併去重後共有 ${allRows.length} 筆未上圖候選工程；另排除 ${mappedMatchCount} 筆已和正式地圖比對成功的案件。${failures ? ` 有 ${failures} 個候選來源檔讀取失敗。` : ""}`;
    state.textContent = text;
    state.classList.toggle("candidateLoadError", failures > 0);
  }
}

async function boot() {
  renderNav();
  applyLanguage();

  const langBtn = $("#lang");
  if (langBtn) langBtn.addEventListener("click", () => {
    lang = lang === "en" ? "zh" : "en";
    localStorage.setItem(LK, lang);
    applyLanguage();
    updateSummary(0);
  });

  ["#candidateQ", "#candidateCategory", "#candidateMissing"].forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderRows);
  });

  try {
    const [activeData, candidateResult] = await Promise.all([
      fetch(ACTIVE_DATA, { cache: "no-store" }).then(r => {
        if (!r.ok) throw new Error(`Active data ${r.status}`);
        return r.json();
      }),
      loadCandidateFiles()
    ]);

    const keys = activeKeys(activeData);
    const merged = mergeRecords(candidateResult.records);
    mappedMatchCount = merged.filter(r => isAlreadyMapped(r, keys)).length;
    allRows = merged
      .filter(r => !isAlreadyMapped(r, keys))
      .map(r => ({ ...r, missing: missingInfo(r) }))
      .sort((a,b) => (b.missing.tags.length - a.missing.tags.length) || String(a.name).localeCompare(String(b.name), "zh-Hant"));

    populateFilters(false);
    renderRows();
    updateSummary(candidateResult.failures);
  } catch (err) {
    console.error(err);
    const state = $("#loadState");
    if (state) {
      state.textContent = lang === "en" ? "Candidate data could not be loaded. Please try again later." : "候選工程資料目前無法載入，請稍後再試。";
      state.classList.add("candidateLoadError");
    }
  }
}

boot();
