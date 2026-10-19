const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const TEXT_SIZES = ['standard', 'large', 'extra-large'];
export const TOOL_GROUPS = [
  ['Plan our direction', ['guide', 'charter', 'segments', 'launch', 'website', 'plan', 'overview']],
  ['Check the facts and money', ['evidence', 'research', 'capacity', 'finance', 'performance']],
  ['Follow through', ['marketing', 'opportunities', 'tasks', 'roadmap', 'updates']],
  ['Workspace help', ['about', 'settings']],
];
const LABELS = { guide: 'Build our strategy', charter: 'Our working arrangement', segments: 'Customers and offers', launch: 'Compare launch options', website: 'Plan the customer website', plan: 'Our business plan', overview: 'Detailed dashboard', evidence: 'Facts and open questions', research: 'Customer research', capacity: 'People and available time', finance: 'Costs and cash planning', performance: 'Compare plans and results', marketing: 'Marketing tests', opportunities: 'Customer and bid pipeline', tasks: 'Tasks and responsibilities', roadmap: '13-week work plan', updates: 'Weekly updates', about: 'About this workspace', settings: 'Workspace settings' };

export function renderWorkspaceNavigation({ nav, view, seat, idPrefix = 'desktop' }) {
  const partner = seat === 'christian' ? 'Debynyhan' : 'Christian';
  const primary = [['overview', 'Home'], ['discovery', 'My answers'], ['alignment', `Read ${partner}’s answers`], ['decisions', 'Decisions together']];
  const button = (key, label) => `<button type="button" class="nav-item ${view === key ? 'active' : ''}" data-view="${esc(key)}" ${view === key ? 'aria-current="page"' : ''}>${esc(label)}</button>`;
  return `<nav class="workspace-navigation" aria-label="Workspace"><div class="primary-navigation">${primary.map(([key, label]) => button(key, label)).join('')}</div><details class="all-tools" data-detail-id="${esc(idPrefix)}-all-tools"><summary>All tools</summary>${TOOL_GROUPS.map(([title, keys]) => `<section class="tool-group"><h2>${esc(title)}</h2>${keys.filter(key => nav.some(item => item[0] === key)).map(key => button(key === 'overview' ? 'dashboard' : key, LABELS[key] || nav.find(item => item[0] === key)[2])).join('')}</section>`).join('')}</details></nav>`;
}

export function renderSimpleHome({ seat, ownProgress = {}, otherProgress = {}, introduction = '', unfinishedWork = '', nextAction = null }) {
  const partner = seat === 'christian' ? 'Debynyhan Banks' : 'Christian Okoh';
  const firstName = seat === 'christian' ? 'Christian' : 'Debynyhan';
  const ownCount = Number(ownProgress.answered) || 0;
  const ownTotal = Number(ownProgress.total) || 0;
  const otherCount = Number(otherProgress.answered) || 0;
  return `<section class="simple-home" aria-labelledby="home-title"><header class="home-heading"><span class="eyebrow">Our private planning workspace</span><h1 id="home-title" tabindex="-1">Welcome, ${firstName}.</h1><p>We can build our plan one step at a time. Choose where you would like to begin.</p></header><div class="home-actions"><button type="button" class="home-action" data-view="discovery"><span class="home-action-number" aria-hidden="true">1</span><span><strong>Continue my answers</strong><span>${ownCount} of ${ownTotal} questions answered. Short answers are welcome.</span></span><span aria-hidden="true">→</span></button><button type="button" class="home-action" data-home-review="${seat === 'christian' ? 'growth' : 'christian'}"><span class="home-action-number" aria-hidden="true">2</span><span><strong>Read ${esc(partner)}’s answers</strong><span>${otherCount ? `${otherCount} ${otherCount === 1 ? 'answer' : 'answers'} recorded.` : 'See the answers as your partner adds them.'} Reading an answer does not approve a proposal.</span></span><span aria-hidden="true">→</span></button><button type="button" class="home-action" data-view="decisions"><span class="home-action-number" aria-hidden="true">3</span><span><strong>Review decisions together</strong><span>Read proposals and record your own preferences or confirmation.</span></span><span aria-hidden="true">→</span></button></div><div class="home-next-links"><button type="button" class="btn" data-view="tasks">My next actions</button><button type="button" class="btn" data-view="about">About this workspace</button></div>${nextAction ? `<details class="home-next-step"><summary>Our next planning step</summary><h2>${esc(nextAction.title)}</h2><p>${esc(nextAction.detail)}</p><button type="button" class="btn" data-view="guide">Open the strategy builder</button></details>` : ''}${unfinishedWork}${introduction}</section>`;
}

function sizeKey({ userId, workspaceId, seat }) {
  return `cf-readable-text-v1:${JSON.stringify([userId || 'preview', workspaceId || 'local', seat || 'christian'])}`;
}
export function readTextSizePreference({ storage = globalThis.localStorage, ...scope } = {}) {
  try { const value = storage?.getItem(sizeKey(scope)); return TEXT_SIZES.includes(value) ? value : 'large'; } catch { return 'large'; }
}
export function writeTextSizePreference({ storage = globalThis.localStorage, value, ...scope } = {}) {
  if (!TEXT_SIZES.includes(value)) return false;
  try { storage?.setItem(sizeKey(scope), value); return Boolean(storage); } catch { return false; }
}
export function applyTextSizePreference(value, documentRoot = globalThis.document?.documentElement) {
  documentRoot?.setAttribute('data-text-size', TEXT_SIZES.includes(value) ? value : 'large');
}
export function renderTextSizeControl(value = 'large') {
  return `<div class="text-size-control"><label for="workspace-text-size">Text size</label><select id="workspace-text-size" class="select">${[['standard', 'Standard'], ['large', 'Large'], ['extra-large', 'Extra large']].map(([key, label]) => `<option value="${key}" ${value === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`;
}

// Preserve real tables and headers while providing a vertical reading order on phones.
export function prepareReadableTables(root = globalThis.document) {
  for (const table of root?.querySelectorAll('table') || []) {
    const headers = [...table.querySelectorAll('thead th')];
    const rows = [...table.querySelectorAll('tbody tr')];
    if (headers.length < 2 || headers.length > 7 || !rows.length) continue;
    if (/comparison input/i.test(headers[0].textContent)) continue;
    if (rows.some(row => row.cells.length !== headers.length || [...row.cells].some(cell => cell.colSpan > 1 || cell.rowSpan > 1))) continue;
    table.classList.add('readable-card-table');
    table.setAttribute('role', 'table');
    table.querySelector('thead')?.setAttribute('role', 'rowgroup');
    table.querySelector('tbody')?.setAttribute('role', 'rowgroup');
    table.querySelector('thead tr')?.setAttribute('role', 'row');
    headers.forEach(header => header.setAttribute('role', 'columnheader'));
    rows.forEach(row => {
      row.setAttribute('role', 'row');
      [...row.cells].forEach((cell, index) => {
        cell.setAttribute('role', 'cell');
        if (cell.querySelector('.mobile-cell-label')) return;
        const label = table.ownerDocument.createElement('span');
        label.className = 'mobile-cell-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = headers[index].textContent.trim();
        cell.prepend(label);
      });
    });
  }
}
