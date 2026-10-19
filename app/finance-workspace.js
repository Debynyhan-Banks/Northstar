import { calculateFinance, numberInput, FINANCE_LABELS } from './finance-model.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const input = (key, label, hint = '') => ({ key, label, type: 'number', min: 0, step: '0.01', hint: `${hint}${hint ? ' ' : ''}Leave unknown values blank; enter 0 only when confirmed.` });
const notes = { key: 'notes', label: 'Assumptions, source and remaining questions', type: 'textarea' };
const scenario = { key: 'scenario', label: 'Scenario', type: 'select', options: [{ value: 'base', label: 'Base case' }, { value: 'downside', label: 'Downside case' }], required: true };
const title = { key: 'title', label: 'Name / description', type: 'text', required: true };
const periods = (count) => Array.from({ length: count }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
const readRecords = (context, type) => typeof context.records === 'function' ? context.records(type) : (context.records || []).filter((row) => row.type === type).map((row) => ({ ...row.body, id: row.id }));

export function getFinanceData(context = {}) {
  return { settings: readRecords(context, 'finance-settings').find((row) => row.id === 'settings') || {}, jobs: readRecords(context, 'job-model'), startupCosts: readRecords(context, 'startup-cost'), cashWeeks: readRecords(context, 'cash-week'), operatingMonths: readRecords(context, 'operating-month') };
}
export function financialSummary(context = {}) {
  const data = getFinanceData(context);
  return { base: calculateFinance(data, 'base'), downside: calculateFinance(data, 'downside') };
}
export function getFinanceForm(type, row = {}, context = {}) {
  let fields;
  let formTitle;
  if (type === 'finance-settings') {
    formTitle = 'Financial assumptions — base and downside';
    fields = [{ key: 'forecastStartDate', label: 'Forecast opening date', type: 'date', hint: 'Opening cash is measured on this date. Weekly forecast covers the next 91 days; monthly forecast starts with the remaining part of this calendar month.' }];
    for (const item of [{ key: 'base', name: 'Base case' }, { key: 'downside', name: 'Downside case' }]) {
      fields.push(
        input(`${item.key}OpeningCash`, `${item.name}: opening cash`, 'Available business cash on the forecast opening date.'),
        input(`${item.key}MonthlyOverhead`, `${item.name}: monthly cash overhead`, 'Recurring costs excluding job costs, partner compensation, marketing, and startup purchases.'),
        input(`${item.key}MonthlyCompensation`, `${item.name}: monthly fixed cash compensation`, 'Fixed partner/staff pay and related employer costs. Exclude labor already costed per job.'),
        input(`${item.key}MonthlyMarketing`, `${item.name}: monthly fixed marketing`, 'Marketing spending not already allocated to individual job acquisition.'),
        input(`${item.key}MonthlyUnpaidOwnerHours`, `${item.name}: monthly unpaid business-management hours`, 'Exclude unpaid technical hours already valued in job models.'),
        input(`${item.key}UnpaidOwnerHourlyValue`, `${item.name}: value per unpaid management hour`, 'Used only for economic profit; this is not a cash payment.'),
        { key: `${item.key}StartupCostsReviewed`, label: `${item.name}: is the startup-cost list complete?`, type: 'select', options: [{ value: '', label: 'Not yet reviewed / unknown' }, { value: 'yes', label: 'Yes — all planned startup spending is recorded, or no spending is needed' }], hint: 'Unscheduled or incomplete startup costs keep cash estimates incomplete. Revisit this confirmation when plans change.' },
      );
    }
    fields.push(notes);
  } else if (type === 'job-model') {
    formTitle = 'Service / job economics';
    fields = [title, scenario,
      input('salePrice', 'Selling price per job', 'Exclude sales tax collected for remittance.'),
      input('paidLabor', 'Paid labor per job', 'Include employment costs attributable to this job.'),
      input('materials', 'Materials and equipment per job'),
      input('subcontractors', 'Subcontractor cost per job', 'Do not repeat amounts included in paid labor.'),
      input('travel', 'Travel and vehicle cost per job'),
      input('paymentFees', 'Payment processing fees per job'),
      input('callbackAllowance', 'Expected callback cost per job'),
      input('allocatedAcquisition', 'Customer-acquisition cost allocated per job', 'Include only spending excluded from fixed monthly marketing.'),
      input('unpaidOwnerHours', 'Unpaid owner technical hours per job', 'Exclude these hours from paid labor and fixed unpaid management time.'),
      input('unpaidOwnerHourlyValue', 'Value per unpaid technical hour', 'Noncash economic cost; not counted as a payment.'),
      input('mixWeight', 'Expected service-mix weight', 'Use relative proportions such as percentages or planned counts. Weights are normalized; 0 excludes this model from break-even.'), notes];
  } else if (type === 'startup-cost') {
    formTitle = 'Startup spending';
    fields = [title, scenario, input('amount', 'Cash amount'), { key: 'paymentDate', label: 'Expected payment date', type: 'date', hint: 'Added automatically to the matching weekly/monthly cash forecast. Do not include this payment again in any other forecast category.' }, notes];
  } else if (type === 'cash-week') {
    formTitle = 'Weekly cash forecast';
    fields = [scenario, { key: 'week', label: 'Week number', type: 'select', options: periods(13), required: true },
      input('customerReceipts', 'Customer payments expected this week', 'Cash receipts may relate to jobs earned in another period.'),
      input('otherInflows', 'Other cash coming in', 'Include funding or other receipts; not earned sales revenue.'),
      input('jobPayments', 'Direct job payments due', 'Include paid job costs and job-allocated acquisition spending; exclude startup purchases.'),
      input('overheadPayments', 'Overhead payments due', 'Exclude job costs, compensation, marketing, startup purchases and other payments.'),
      input('compensationPayments', 'Fixed compensation payments due', 'Exclude compensation already included in job payments.'),
      input('marketingPayments', 'Fixed marketing payments due', 'Exclude acquisition spending already included in job payments.'),
      input('otherPayments', 'Other cash payments due', 'Identify debt, tax or other obligations in the notes; exclude startup purchases and all categories above.'), notes];
  } else if (type === 'operating-month') {
    formTitle = 'Monthly service and collection forecast';
    const jobs = context.jobs || readRecords(context, 'job-model');
    fields = [title, scenario, { key: 'month', label: 'Month number', type: 'select', options: periods(12), required: true },
      { key: 'jobModelId', label: 'Service / job model', type: 'select', options: [{ value: '', label: 'No jobs planned (units must be 0)' }, ...jobs.map((job) => ({ value: job.id, label: `${job.title || 'Untitled service'} — ${job.scenario || 'scenario unknown'}` }))], hint: 'Use a model from the same scenario. Add separate rows for different services in the same month. Fixed costs are applied once per month.' },
      input('units', 'Jobs planned in this month', 'Forecast sales and job costs are calculated from the selected model.'),
      input('customerCollections', 'Customer cash expected for this line', 'Enter expected actual receipts, including collections from prior-period work where applicable.'),
      input('jobPayments', 'Job-related cash payments expected for this line', 'Include all direct payments and allocated acquisition spending due in this month. Payment timing may differ from when jobs are earned.'),
      input('otherInflows', 'Other cash inflows for this line', 'Record each funding receipt once across this month’s rows.'),
      input('otherPayments', 'Other cash outflows for this line', 'Exclude fixed overhead, compensation and fixed marketing (added once from settings), startup spending (added by date), and job payments.'), notes];
  } else return null;
  return { type, id: type === 'finance-settings' ? 'settings' : row.id, title: formTitle, fields, initial: { ...row } };
}

export function renderFinance(context = {}) {
  const data = getFinanceData(context);
  const reports = { base: calculateFinance(data, 'base'), downside: calculateFinance(data, 'downside') };
  const currency = (value) => value === null || value === undefined ? '<span class="unanswered">Unknown</span>' : esc(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value));
  const quantity = (value) => value === null || value === undefined ? '<span class="unanswered">Unknown</span>' : esc(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value));
  const edit = (type, id, label = 'Edit') => `<button class="btn btn-sm" data-plan-edit="${esc(type)}" data-plan-id="${esc(id)}">${esc(label)}</button>`;
  const add = (type, label) => `<button class="btn btn-sm" data-plan-new="${esc(type)}">${esc(label)}</button>`;
  const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}"><span class="unanswered">Nothing recorded yet.</span></td></tr>`}</tbody></table></div>`;
  const metric = (label, value) => `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div></div>`;
  const missing = (items) => items.length ? `<details><summary>${items.length} input${items.length === 1 ? '' : 's'} to resolve</summary><ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></details>` : '<span class="tag">Inputs entered</span>';
  const records = (type, key) => readRecords(context, type).filter((row) => row.scenario === key);
  const renderScenario = (key) => {
    const report = reports[key];
    const caseName = key === 'base' ? 'Base case' : 'Downside case';
    const jobRows = report.jobs.map((job) => [esc(job.title), currency(job.salePrice), currency(job.grossProfit), currency(job.cashContribution), currency(job.ownerTimeValue), currency(job.economicContribution), quantity(job.mixWeight), `${job.missing.length ? `<details><summary>${job.missing.length} missing inputs</summary><ul>${job.missing.map((field) => `<li>${esc(FINANCE_LABELS[field] || field)}</li>`).join('')}</ul></details>` : ''}${edit('job-model', job.id)}`]);
    const startupRows = records('startup-cost', key).map((row) => [esc(row.title), currency(numberInput(row.amount)), esc(row.paymentDate || 'Unscheduled'), edit('startup-cost', row.id)]);
    const cashRows = report.cash.periods.map((row) => [String(row.week), esc(row.startDate ? `${row.startDate} – ${row.endDate}` : 'Set opening date'), currency(row.openingCash), currency(row.inflows), currency(row.outflows), currency(row.startup), currency(row.closingCash), row.id ? edit('cash-week', row.id) : '<span class="unanswered">Add week</span>']);
    const cashMissing = [...new Set(report.cash.periods.flatMap((row) => row.missing))];
    const cashRecords = records('cash-week', key).map((row) => [esc(row.week), edit('cash-week', row.id)]);
    const monthRows = report.operating.periods.map((row) => [String(row.month), esc(row.startDate || 'Set opening date'), currency(row.revenue), currency(row.grossProfit), currency(row.operatingProfit), currency(row.economicProfit), currency(row.collections), currency(row.cashOutflows), currency(row.startup), currency(row.closingCash)]);
    const monthlyLines = records('operating-month', key).map((row) => [esc(row.title), esc(row.month), esc(data.jobs.find((job) => job.id === row.jobModelId)?.title || 'No model selected'), esc(row.units === '' || row.units == null ? 'Unknown' : row.units), edit('operating-month', row.id)]);
    const monthMissing = [...new Set(report.operating.periods.flatMap((row) => row.missing))];
    return `<details class="panel pad" ${key === 'base' ? 'open' : ''}><summary><strong>${caseName} — editable estimates</strong></summary>
      <p class="caption">Each scenario has its own entered assumptions, services, startup spending and forecasts. No automatic percentage reductions or hidden forecasts are applied.</p>
      <div class="stat-grid">${metric('Startup budget', currency(report.startupBudget))}${metric('Monthly fixed cash costs', currency(report.jobSummary.fixedCashCosts))}${metric('Cash break-even jobs / month', quantity(report.breakEven.jobs))}${metric('Economic break-even jobs / month', quantity(report.economicBreakEven.jobs))}</div>
      ${missing(report.issues)}
      <p><strong>Cash break-even:</strong> ${esc(report.breakEven.message)} <strong>Economic break-even:</strong> ${esc(report.economicBreakEven.message)}</p>
      <h3>Services and job economics</h3><p class="caption">Gross profit excludes acquisition spending. Cash contribution subtracts every direct job cost and allocated acquisition; economic contribution also values unpaid technical time.</p>
      ${table(['Service', 'Price', 'Gross profit', 'Cash contribution', 'Unpaid time value', 'Economic contribution', 'Mix weight', 'Action'], jobRows)}${add('job-model', 'Add service / job model')}
      <h3>Startup spending</h3><p class="caption">Payments are automatically added once by date to cash forecasts. Startup spending is shown separately from operating profit. An incomplete list or missing payment date keeps the cash forecast incomplete.</p>
      ${table(['Item', 'Cash amount', 'Payment date', 'Action'], startupRows)}${add('startup-cost', 'Add startup cost')}
      <h3>Rolling 13-week cash forecast</h3><p class="caption">Manually enter expected receipts and payments for each week. Monthly overhead is not automatically inserted here: record its actual weekly payment timing. Startup payments are added by date. Weekly and monthly cash forecasts are separate estimates to reconcile; they are never added together.</p>
      ${table(['Week', 'Dates', 'Opening cash', 'Cash in', 'Cash out', 'Startup included in cash out', 'Closing cash', 'Action'], cashRows)}${add('cash-week', 'Add weekly cash record')}
      <p>Forecast closing cash: <strong>${currency(report.cash.closingCash)}</strong>. Minimum forecast cash: <strong>${currency(report.cash.minimumCash)}</strong>. Status: ${report.cash.complete ? 'All required inputs entered; assumptions still require review.' : 'Incomplete — unknown inputs prevent a reliable full forecast.'}</p>${missing(cashMissing)}<details><summary>All saved weekly cash records</summary>${table(['Week', 'Action'], cashRecords)}</details>
      <h3>Twelve-month operating and cash forecast</h3><p class="caption">Each month uses service-model units for earned revenue and direct cost. Collections and direct cash payments are entered separately. Fixed overhead, compensation and fixed marketing are added once monthly from settings. The first month covers the opening date through month-end; enter a full monthly fixed-cost allowance unless you deliberately adjust the assumptions.</p>
      ${table(['Month', 'Start', 'Earned revenue', 'Gross profit', 'Operating profit', 'Economic profit', 'Cash collected', 'Cash paid', 'Startup included in cash paid', 'Closing cash'], monthRows)}
      <p>12-month earned revenue: <strong>${currency(report.operating.revenue)}</strong>; operating profit: <strong>${currency(report.operating.operatingProfit)}</strong>; economic profit: <strong>${currency(report.operating.economicProfit)}</strong>; cash collected: <strong>${currency(report.operating.collections)}</strong>. ${report.operating.complete ? 'Required inputs entered.' : 'Incomplete forecast.'}</p>${missing(monthMissing)}
      <h4>Editable monthly service lines</h4>${table(['Description', 'Month', 'Service model', 'Planned jobs', 'Action'], monthlyLines)}${add('operating-month', 'Add monthly forecast line')}
      </details>`;
  };
  return `<div class="page"><div class="heading-line"><div><div class="eyebrow">Our financial plan</div><h1>Can we fund and sustain the plan?</h1><p>Use verified costs and explicit assumptions to compare revenue, profit and cash before committing.</p></div>${edit('finance-settings', 'settings', 'Edit financial assumptions')}</div>
    <div class="panel pad"><h2>Build the numbers in order</h2><p>Set an opening date and separate base/downside assumptions. Cost the services, record startup purchases, then enter collection and payment timing. Blank means unknown; 0 means you have deliberately entered none.</p><p><strong>Prevent double-counting:</strong> put each cash cost in one category. Job-level marketing belongs only in allocated acquisition; fixed marketing excludes it. Fixed compensation excludes labor already costed per job. Unpaid time is an economic cost only, never a cash payment.</p>
    <details><summary>Formulas, scope and limitations</summary><ul><li>Gross profit per job = selling price − paid labor − materials − subcontractors − travel − payment fees − callback allowance.</li><li>Cash contribution per job = gross profit − job-allocated acquisition cost. Economic contribution = cash contribution − unpaid technical hours × hourly value.</li><li>Monthly fixed cash cost = overhead + fixed compensation + fixed marketing. Break-even jobs = round up(fixed cash cost ÷ weighted cash contribution). Weights are normalized from your entered mix. Economic break-even includes unpaid management time and unpaid job time.</li><li>Earned monthly revenue = service-model price × planned jobs, summed across service lines. Operating profit = earned revenue − direct job costs including acquisition − monthly fixed cash costs. Economic profit subtracts valued unpaid time.</li><li>Closing cash = opening cash + cash received − cash paid. Collections can differ from earned revenue; principal funding is cash, not revenue. Startup purchases are cash spending and are not automatically treated as operating expenses.</li><li>These are planning estimates before income tax, depreciation, financing interest or other unmodeled adjustments. Explicitly enter relevant cash obligations in other payments and explain them. This is not a ledger or a tax return.</li><li>A fixed monthly cost allowance applies to every forecast month. If seasonality or contract changes materially alter costs, revise the scenario assumptions and document their limits. Weekly forecasts allow actual payment timing.</li></ul></details></div>
    ${renderScenario('base')}${renderScenario('downside')}</div>`;
}
