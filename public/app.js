const state = {
  promptSets: [],
  selected: null,
};

const api = {
  async getPromptSets() {
    const res = await fetch('/api/prompt-sets');
    return res.json();
  },
  async getPromptSet(id) {
    const res = await fetch(`/api/prompt-sets/${id}`);
    return res.json();
  },
  async createPromptSet(payload) {
    const res = await fetch('/api/prompt-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async updatePromptSet(id, payload) {
    const res = await fetch(`/api/prompt-sets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async publishPromptSet(id, payload) {
    const res = await fetch(`/api/prompt-sets/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return res.json();
  },
  async rollbackPromptSet(id, payload) {
    const res = await fetch(`/api/prompt-sets/${id}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return res.json();
  },
  async renderSection(id, sectionId) {
    const res = await fetch(`/api/prompt-sets/${id}/sections/${sectionId}/rendered`);
    return res.json();
  },
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function lineDiff(oldText, newText) {
  const a = oldText.split(/\r?\n/);
  const b = newText.split(/\r?\n/);
  const m = a.length;
  const n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) lcs[i][j] = lcs[i + 1][j + 1] + 1;
      else lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push({ type: 'context', value: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: 'remove', value: a[i] });
      i += 1;
    } else {
      lines.push({ type: 'add', value: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    lines.push({ type: 'remove', value: a[i] });
    i += 1;
  }
  while (j < n) {
    lines.push({ type: 'add', value: b[j] });
    j += 1;
  }

  return lines;
}

function renderDiff(promptSet) {
  const diffOutput = document.getElementById('diff-output');
  const lastPublished = [...(promptSet.history || [])]
    .reverse()
    .find((entry) => entry.action === 'published');
  if (!lastPublished) {
    diffOutput.innerHTML = '<span class="muted">No published version to diff against.</span>';
    return;
  }
  const currentText = promptSet.sections
    .map((s) => `# ${s.name}\n${s.basePrompt}\n--override--\n${s.overrides?.write || ''}\npolicy:${s.evidencePolicy}`)
    .join('\n---\n');
  const publishedText = lastPublished.state.sections
    .map((s) => `# ${s.name}\n${s.basePrompt}\n--override--\n${s.overrides?.write || ''}\npolicy:${s.evidencePolicy}`)
    .join('\n---\n');

  const diff = lineDiff(publishedText, currentText);
  diffOutput.innerHTML = diff
    .map((line) => {
      const safe = escapeHtml(line.value);
      if (line.type === 'add') return `<div class="diff-line diff-add">+ ${safe}</div>`;
      if (line.type === 'remove') return `<div class="diff-line diff-remove">- ${safe}</div>`;
      return `<div class="diff-line diff-context">  ${safe}</div>`;
    })
    .join('');
}

function renderHistory(promptSet) {
  const historyEl = document.getElementById('history');
  const rollbackSelect = document.getElementById('rollback-version');
  rollbackSelect.innerHTML = '';
  historyEl.innerHTML = '';
  (promptSet.history || []).forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'history-entry';
    div.innerHTML = `<strong>v${entry.version}</strong> · ${entry.action} · <span class="muted">${entry.timestamp}</span><br>${escapeHtml(entry.note || '')}`;
    historyEl.appendChild(div);

    const opt = document.createElement('option');
    opt.value = entry.version;
    opt.textContent = `v${entry.version} - ${entry.action}`;
    rollbackSelect.appendChild(opt);
  });
}

function renderSections(promptSet) {
  const sectionsEl = document.getElementById('sections');
  sectionsEl.innerHTML = '';
  const template = document.getElementById('section-template');

  promptSet.sections.forEach((section) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.section-card');
    card.dataset.sectionId = section.id;
    node.querySelector('.section-name').value = section.name;
    node.querySelector('.base-prompt').value = section.basePrompt || '';
    node.querySelector('.override-write').value = section.overrides?.write || '';
    node.querySelector('.guardrails').value = (section.guardrails || []).join('\n');
    node.querySelector('.evidence-policy').value = section.evidencePolicy || 'vector-only';
    sectionsEl.appendChild(node);
  });

  updatePreviewSelect(promptSet);
}

function updatePreviewSelect(promptSet) {
  const select = document.getElementById('preview-section');
  select.innerHTML = '';
  promptSet.sections.forEach((section) => {
    const opt = document.createElement('option');
    opt.value = section.id;
    opt.textContent = section.name;
    select.appendChild(opt);
  });
}

function renderPromptSetList() {
  const listEl = document.getElementById('prompt-set-list');
  listEl.innerHTML = '';
  state.promptSets.forEach((set) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<strong>${escapeHtml(set.name)}</strong><br><span class="muted">v${set.version} · ${set.state}</span>`;
    card.onclick = async () => {
      const full = await api.getPromptSet(set.id);
      state.selected = full;
      renderDetails();
    };
    listEl.appendChild(card);
  });
}

function renderDetails() {
  const detail = document.getElementById('details');
  if (!state.selected) {
    detail.classList.add('hidden');
    return;
  }
  detail.classList.remove('hidden');
  const set = state.selected;
  document.getElementById('detail-title').textContent = set.name;
  document.getElementById('detail-meta').textContent = `State: ${set.state} · Version ${set.version}`;
  document.getElementById('detail-name').value = set.name;
  document.getElementById('detail-version').value = set.version;
  document.getElementById('detail-status').value = set.state;
  renderSections(set);
  renderDiff(set);
  renderHistory(set);
  const selectionState = document.getElementById('selection-state');
  selectionState.textContent = `${set.name} (v${set.version})`;
  selectionState.classList.remove('muted');
}

async function refresh() {
  const data = await api.getPromptSets();
  state.promptSets = data.promptSets || [];
  renderPromptSetList();
  if (state.selected) {
    const updated = await api.getPromptSet(state.selected.id);
    state.selected = updated;
    renderDetails();
  }
}

function collectSectionData() {
  const sections = [];
  document.querySelectorAll('.section-card').forEach((card) => {
    const sectionId = card.dataset.sectionId;
    const name = card.querySelector('.section-name').value.trim() || 'Untitled section';
    const basePrompt = card.querySelector('.base-prompt').value;
    const overrideWrite = card.querySelector('.override-write').value;
    const guardrailsRaw = card.querySelector('.guardrails').value;
    const evidencePolicy = card.querySelector('.evidence-policy').value;
    sections.push({
      id: sectionId,
      name,
      basePrompt,
      overrides: { write: overrideWrite },
      guardrails: guardrailsRaw
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      evidencePolicy,
    });
  });
  return sections;
}

async function saveDraft() {
  if (!state.selected) return;
  const payload = {
    name: document.getElementById('detail-name').value || state.selected.name,
    sections: collectSectionData(),
    note: 'Edited via UI',
  };
  const updated = await api.updatePromptSet(state.selected.id, payload);
  state.selected = updated;
  await refresh();
}

async function publish() {
  if (!state.selected) return;
  await saveDraft();
  const published = await api.publishPromptSet(state.selected.id, { note: 'Published from UI' });
  state.selected = published;
  await refresh();
}

async function rollback() {
  if (!state.selected) return;
  const version = document.getElementById('rollback-version').value;
  if (!version) return;
  const rolled = await api.rollbackPromptSet(state.selected.id, { version, note: 'Rolled back via UI' });
  state.selected = rolled;
  await refresh();
}

async function preview() {
  if (!state.selected) return;
  const sectionId = document.getElementById('preview-section').value;
  const rendered = await api.renderSection(state.selected.id, sectionId);
  document.getElementById('preview-output').textContent = rendered.prompt || 'No prompt available';
}

function addSection() {
  if (!state.selected) return;
  const newSection = {
    id: crypto.randomUUID(),
    name: 'New Section',
    basePrompt: '',
    overrides: {},
    guardrails: [],
    evidencePolicy: 'vector-only',
  };
  state.selected.sections.push(newSection);
  renderSections(state.selected);
}

function setupEventListeners() {
  document.getElementById('refresh').onclick = refresh;
  document.getElementById('create').onclick = async () => {
    const name = document.getElementById('new-name').value.trim();
    const sectionName = document.getElementById('new-section-name').value.trim() || 'New Section';
    const created = await api.createPromptSet({
      name: name || 'Untitled Prompt Set',
      sections: [
        {
          id: crypto.randomUUID(),
          name: sectionName,
          basePrompt: '',
          overrides: {},
          guardrails: [],
          evidencePolicy: 'vector-only',
        },
      ],
    });
    state.promptSets.push(created);
    state.selected = created;
    renderPromptSetList();
    renderDetails();
  };
  document.getElementById('save-draft').onclick = saveDraft;
  document.getElementById('publish').onclick = publish;
  document.getElementById('rollback-btn').onclick = rollback;
  document.getElementById('preview-btn').onclick = preview;
  document.getElementById('add-section').onclick = addSection;
}

setupEventListeners();
refresh();
