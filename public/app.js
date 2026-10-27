'use strict';

(function () {
  const form = document.getElementById('plan-form');
  const results = document.getElementById('results');
  const errorsBox = document.getElementById('form-errors');
  const submitBtn = document.getElementById('submit-btn');

  const inr = (n) => 'INR ' + Number(n || 0).toLocaleString('en-IN');

  /** Create an element with text content only (never innerHTML), preventing XSS. */
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function list(items) {
    const ul = el('ul');
    (items || []).filter(Boolean).forEach((item) => ul.appendChild(el('li', item)));
    return ul;
  }

  function card(title, id) {
    const section = el('section', null, 'card');
    section.setAttribute('aria-labelledby', id);
    const h = el('h3', title);
    h.id = id;
    section.appendChild(h);
    return section;
  }

  function validate(data) {
    const errs = [];
    if (!data.eventType) errs.push({ field: 'eventType', msg: 'Please choose an event type.' });
    const g = Number(data.guests);
    if (!(g >= 1 && g <= 5000)) errs.push({ field: 'guests', msg: 'Guests must be between 1 and 5000.' });
    const b = Number(data.budget);
    if (!(b >= 1000)) errs.push({ field: 'budget', msg: 'Budget must be at least INR 1,000.' });
    return errs;
  }

  function showErrors(errs) {
    errorsBox.replaceChildren();
    form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
    if (!errs.length) return;
    errorsBox.appendChild(list(errs.map((e) => e.msg)));
    errs.forEach((e) => {
      const f = document.getElementById(e.field);
      if (f) f.setAttribute('aria-invalid', 'true');
    });
    const first = document.getElementById(errs[0].field);
    if (first) first.focus();
  }

  function renderPlan(p) {
    results.replaceChildren();

    const summary = card('Your plan', 'r-summary');
    summary.appendChild(el('p', p.summary));
    summary.appendChild(el('p', 'Total budget: ' + inr(p.totalEstimate), 'total'));
    if (p.source === 'fallback') {
      summary.appendChild(el('p', 'Our AI assistant is taking a short break, so this is a standard plan. Try again shortly for fully personalised ideas.', 'notice'));
    }
    results.appendChild(summary);

    const budget = card('Budget breakdown', 'r-budget');
    const table = el('table');
    const caption = el('caption', 'Budget split by category in Indian Rupees', 'sr-only');
    table.appendChild(caption);
    const head = el('thead');
    const hr = el('tr');
    ['Category', 'Amount', 'Notes'].forEach((t) => {
      const th = el('th', t);
      th.scope = 'col';
      hr.appendChild(th);
    });
    head.appendChild(hr);
    table.appendChild(head);
    const body = el('tbody');
    const max = Math.max(1, ...(p.budget || []).map((b) => b.amount));
    (p.budget || []).forEach((b) => {
      const tr = el('tr');
      const th = el('th', b.category);
      th.scope = 'row';
      tr.appendChild(th);
      const amt = el('td');
      amt.appendChild(el('span', inr(b.amount)));
      const bar = el('span', null, 'bar');
      bar.style.width = Math.round((b.amount / max) * 100) + '%';
      bar.setAttribute('aria-hidden', 'true');
      amt.appendChild(bar);
      tr.appendChild(amt);
      tr.appendChild(el('td', b.notes));
      body.appendChild(tr);
    });
    table.appendChild(body);
    budget.appendChild(table);
    results.appendChild(budget);

    const timeline = card('Timeline', 'r-timeline');
    const ol = el('ol', null, 'timeline');
    (p.timeline || []).forEach((t) => {
      const li = el('li');
      li.appendChild(el('strong', t.when + ': '));
      li.appendChild(document.createTextNode(t.task));
      ol.appendChild(li);
    });
    timeline.appendChild(ol);
    results.appendChild(timeline);

    const vendors = card('Vendor checklist', 'r-vendors');
    (p.vendors || []).forEach((v, i) => {
      const wrap = el('div', null, 'vendor');
      const id = 'vendor-' + i;
      const cb = el('input');
      cb.type = 'checkbox';
      cb.id = id;
      const label = el('label', v.vendor);
      label.htmlFor = id;
      wrap.appendChild(cb);
      wrap.appendChild(label);
      if (v.why) wrap.appendChild(el('p', v.why, 'muted'));
      if (v.questionsToAsk && v.questionsToAsk.length) wrap.appendChild(list(v.questionsToAsk));
      vendors.appendChild(wrap);
    });
    results.appendChild(vendors);

    const i = p.ideas || {};
    const ideas = card('Personalised ideas', 'r-ideas');
    if (i.theme) ideas.appendChild(el('p', 'Theme: ' + i.theme, 'theme'));
    if (i.colors && i.colors.length) {
      const chips = el('ul', null, 'chips');
      chips.setAttribute('aria-label', 'Colour palette');
      i.colors.forEach((c) => chips.appendChild(el('li', c, 'chip')));
      ideas.appendChild(chips);
    }
    [['Decor', i.decor], ['Food', i.food], ['Activities', i.activities], ['Personal touches', i.personalTouches]].forEach(([title, items]) => {
      if (items && items.length) {
        ideas.appendChild(el('h4', title));
        ideas.appendChild(list(items));
      }
    });
    results.appendChild(ideas);

    if (p.tips && p.tips.length) {
      const tips = card('Tips', 'r-tips');
      tips.appendChild(list(p.tips));
      results.appendChild(tips);
    }

    const actions = el('div', null, 'actions');
    const printBtn = el('button', 'Print or save as PDF', 'btn btn-secondary');
    printBtn.type = 'button';
    printBtn.addEventListener('click', () => window.print());
    actions.appendChild(printBtn);
    results.appendChild(actions);

    results.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errs = validate(data);
    showErrors(errs);
    if (errs.length) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Planning...';
    results.setAttribute('aria-busy', 'true');
    results.replaceChildren(el('p', 'Creating your personalised plan. This takes about 10 seconds.', 'card'));

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await res.json();
      if (!res.ok) {
        const msg = res.status === 429 ? 'Too many requests. Please wait a minute and try again.' : (payload.details || [payload.error]).join(' ');
        throw new Error(msg);
      }
      renderPlan(payload);
    } catch (err) {
      results.replaceChildren(el('p', err.message || 'Something went wrong. Please try again.', 'card errors'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Plan my event with AI';
      results.setAttribute('aria-busy', 'false');
    }
  });
})();
