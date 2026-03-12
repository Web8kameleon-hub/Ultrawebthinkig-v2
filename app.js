const API_BASE_URL = window.location.origin;

const state = {
  articles: [],
  categories: [],
  selectedCategory: 'all',
  query: ''
};

const serviceCatalog = [
  { name: 'Dr. Albana', port: '8040', kind: 'Medical Engine' },
  { name: 'Blerina', port: '8035', kind: 'Content Engine' },
  { name: 'Blog Publisher', port: '8041', kind: 'Publishing' },
  { name: 'Content Factory', port: '8006', kind: 'Orchestration' },
  { name: 'Blog API', port: '8050', kind: 'Industrial UI' }
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function renderServices() {
  const root = document.getElementById('servicesList');
  root.innerHTML = serviceCatalog.map(service => `
    <div class="d-flex justify-content-between align-items-center border rounded p-2">
      <div>
        <div class="fw-semibold">${escapeHtml(service.name)}</div>
        <small class="text-muted">${escapeHtml(service.kind)}</small>
      </div>
      <span class="badge text-bg-light service-pill">:${escapeHtml(service.port)}</span>
    </div>
  `).join('');
}

function buildQuery() {
  const params = new URLSearchParams({ limit: '60' });
  if (state.selectedCategory && state.selectedCategory !== 'all') {
    params.set('category', state.selectedCategory);
  }
  if (state.query.trim()) {
    params.set('q', state.query.trim());
  }
  return params.toString();
}

async function loadCategories() {
  const payload = await fetchJson(`${API_BASE_URL}/api/v1/articles/categories`);
  state.categories = payload.categories || [];

  const select = document.getElementById('categorySelect');
  const options = ['<option value="all">Të gjitha kategoritë</option>'];
  for (const cat of state.categories) {
    options.push(`<option value="${escapeHtml(cat.key)}">${titleCase(cat.key)} (${cat.count})</option>`);
  }
  select.innerHTML = options.join('');

  renderCategoriesBoard();
}

function createDocCard(article) {
  return `
    <div class="col-md-6">
      <div class="card card-soft doc-card h-100" data-id="${escapeHtml(article.id)}">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <span class="badge text-bg-primary badge-category">${escapeHtml(titleCase(article.category))}</span>
            <small class="text-muted">${escapeHtml(article.read_time)} min</small>
          </div>
          <h6 class="fw-bold">${escapeHtml(article.title)}</h6>
          <p class="preview mb-3">${escapeHtml(article.preview)}</p>
          <div class="mt-auto d-flex justify-content-between align-items-center">
            <small class="text-muted">${escapeHtml(article.author)}</small>
            <button class="btn btn-sm btn-outline-primary" data-open-id="${escapeHtml(article.id)}">Hap</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindArticleOpenEvents() {
  document.querySelectorAll('[data-open-id]').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const id = btn.getAttribute('data-open-id');
      const article = state.articles.find(a => a.id === id);
      if (article) {
        openDocumentModal(article);
      }
    });
  });
}

function openDocumentModal(article) {
  document.getElementById('docModalTitle').textContent = article.title;
  document.getElementById('docModalBody').innerHTML = `
    <div class="mb-3">
      <span class="badge text-bg-primary me-2">${escapeHtml(titleCase(article.category))}</span>
      <span class="text-muted small">${escapeHtml(article.author)}</span>
    </div>
    <div class="alert alert-info mb-3">
      Ky është preview i klasifikuar. Për lexim të plotë përdor endpoint-in e pagesës/aksesit.
    </div>
    <article>${escapeHtml(article.preview)}</article>
  `;
  const modal = new bootstrap.Modal(document.getElementById('docModal'));
  modal.show();
}

function renderArticles() {
  const grid = document.getElementById('documentsGrid');
  grid.innerHTML = state.articles.map(createDocCard).join('');
  document.getElementById('resultCount').textContent = `${state.articles.length} rezultate`;
  bindArticleOpenEvents();
}

function renderAdvancedResults() {
  const root = document.getElementById('advancedSearchResults');
  if (!state.query.trim()) {
    root.innerHTML = '<div class="col-12 text-muted">Shkruaj një kërkim për të parë rezultatet.</div>';
    return;
  }
  if (!state.articles.length) {
    root.innerHTML = '<div class="col-12"><div class="alert alert-warning mb-0">Nuk u gjet asnjë dokument për këtë kërkim.</div></div>';
    return;
  }
  root.innerHTML = state.articles.map(createDocCard).join('');
  bindArticleOpenEvents();
}

function renderCategoriesBoard() {
  const root = document.getElementById('categoriesBoard');
  if (!state.categories.length) {
    root.innerHTML = '<div class="col-12 text-muted">Nuk ka kategori të disponueshme.</div>';
    return;
  }
  root.innerHTML = state.categories.map(c => `
    <div class="col-md-4">
      <div class="card card-soft h-100">
        <div class="card-body">
          <h6 class="fw-bold mb-1">${escapeHtml(titleCase(c.key))}</h6>
          <p class="text-muted mb-2">Dokumente sipas natyrës funksionale.</p>
          <span class="badge text-bg-light">${escapeHtml(c.count)} dokumente</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadArticles() {
  const query = buildQuery();
  state.articles = await fetchJson(`${API_BASE_URL}/api/v1/articles?${query}`);
  renderArticles();
  renderAdvancedResults();
}

async function handleSearch() {
  state.query = document.getElementById('searchInput').value || '';
  await loadArticles();
}

async function handleAdvancedSearch() {
  state.query = document.getElementById('advancedSearchInput').value || '';
  document.getElementById('searchInput').value = state.query;
  await loadArticles();
}

function bindEvents() {
  document.getElementById('searchBtn').addEventListener('click', handleSearch);
  document.getElementById('advancedSearchBtn').addEventListener('click', handleAdvancedSearch);
  document.getElementById('searchInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await handleSearch();
    }
  });
  document.getElementById('advancedSearchInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await handleAdvancedSearch();
    }
  });
  document.getElementById('categorySelect').addEventListener('change', async (e) => {
    state.selectedCategory = e.target.value;
    await loadArticles();
  });
}

async function bootstrap() {
  renderServices();
  bindEvents();
  await loadCategories();
  await loadArticles();
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error(err);
    const grid = document.getElementById('documentsGrid');
    if (grid) {
      grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Gabim në ngarkimin e UI/API.</div></div>';
    }
  });
});
