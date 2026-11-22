(() => {
  'use strict';

  const CONFIG = {
    username: 'xiaohaiwang-web',
    websiteRepo: 'xiaohaiwang-web.github.io',
    projectsToShow: 9,
    cacheKey: 'xiaohaiwang_arcade_github_cache_v1',
    cacheTtlMs: 30 * 60 * 1000
  };

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    connection: $('#connection-status'),
    sync: $('#sync-indicator'),
    projectGrid: $('#project-grid'),
    projectCount: $('#project-count-label'),
    refresh: $('#refresh-projects'),
    menu: $('#main-nav'),
    menuToggle: $('#menu-toggle'),
    statRepos: $('#stat-repos'),
    statStars: $('#stat-stars'),
    statLanguages: $('#stat-languages'),
    score: $('#score-value'),
    languageList: $('#language-list')
  };

  const safeExternalUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : `https://github.com/${CONFIG.username}`;
    } catch {
      return `https://github.com/${CONFIG.username}`;
    }
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const setStatus = (message, state = '') => {
    elements.sync.textContent = `● ${message}`;
    elements.sync.className = `sync-indicator ${state}`;
    elements.connection.textContent = state === 'ok' ? 'GITHUB CONNECTED' : state === 'error' ? 'OFFLINE MODE' : 'SYNCING DATA';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'UNKNOWN';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'UNKNOWN';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit' }).format(date);
  };

  const metric = (label, value) => {
    const span = create('span', '', `${label} ${Number(value || 0).toLocaleString('en-US')}`);
    return span;
  };

  function makeProjectCard(repo, index) {
    const card = create('article', 'project-card');
    const top = create('div', 'project-topline');
    top.append(create('span', 'project-folder', '▰'));
    top.append(create('span', 'project-number', `FILE / ${String(index + 1).padStart(2, '0')}`));

    const title = create('h3', '', repo.name.replace(/[-_]/g, ' '));
    const description = create('p', '', repo.description || '一个持续迭代中的开源项目。点击查看源代码与更多说明。');

    const tags = create('div', 'project-tags');
    if (repo.language) tags.append(create('span', 'project-tag', repo.language));
    if (repo.archived) tags.append(create('span', 'project-tag', 'ARCHIVED'));
    if (repo.topics && Array.isArray(repo.topics)) {
      repo.topics.slice(0, 2).forEach((topic) => tags.append(create('span', 'project-tag', topic)));
    }
    if (!tags.childElementCount) tags.append(create('span', 'project-tag', 'OPEN SOURCE'));

    const footer = create('div', 'project-footer');
    const metrics = create('div', 'project-metrics');
    metrics.append(metric('★', repo.stargazers_count));
    metrics.append(metric('⑂', repo.forks_count));
    footer.append(metrics);
    footer.append(create('span', '', `UPDATED ${formatDate(repo.updated_at)}`));

    const link = create('a', 'project-open', 'VIEW ↗');
    link.href = safeExternalUrl(repo.html_url);
    link.target = '_blank';
    link.rel = 'noreferrer';
    footer.append(link);

    card.append(top, title, description, tags, footer);
    return card;
  }

  function renderProjects(repositories, sourceLabel) {
    const grid = elements.projectGrid;
    grid.replaceChildren();
    const visible = repositories
      .filter((repo) => repo && repo.name && repo.name !== CONFIG.websiteRepo && !repo.fork)
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, CONFIG.projectsToShow);

    if (!visible.length) {
      const empty = create('div', 'empty-card');
      empty.append(create('strong', '', 'NO PROJECTS FOUND'), create('span', '', '暂时没有可展示的公开项目，前往 GitHub 查看完整仓库。'));
      grid.append(empty);
      elements.projectCount.textContent = '0 PROJECTS FOUND';
      return;
    }

    visible.forEach((repo, index) => grid.append(makeProjectCard(repo, index)));
    elements.projectCount.textContent = `${visible.length} PROJECT${visible.length === 1 ? '' : 'S'} DISPLAYED · ${sourceLabel}`;

    const totalStars = repositories.reduce((sum, repo) => sum + (Number(repo.stargazers_count) || 0), 0);
    const languages = new Map();
    repositories.forEach((repo) => {
      if (repo.language) languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
    });
    const sortedLanguages = [...languages.entries()].sort((a, b) => b[1] - a[1]);

    elements.statRepos.textContent = String(repositories.length).padStart(2, '0');
    elements.statStars.textContent = totalStars.toLocaleString('en-US');
    elements.statLanguages.textContent = String(languages.size).padStart(2, '0');
    elements.score.textContent = String(totalStars).padStart(6, '0').slice(-6);

    elements.languageList.replaceChildren();
    if (!sortedLanguages.length) {
      elements.languageList.append(create('span', 'language-placeholder', 'NO LANGUAGE DATA YET'));
    } else {
      sortedLanguages.slice(0, 8).forEach(([language, count]) => {
        const chip = create('span', 'language-chip');
        chip.append(create('span', '', language), create('b', '', `${count} ${count === 1 ? 'PROJECT' : 'PROJECTS'}`));
        elements.languageList.append(chip);
      });
    }
  }

  function renderFailure(message) {
    elements.projectGrid.replaceChildren();
    const empty = create('div', 'empty-card');
    empty.append(create('strong', '', 'GITHUB CONNECTION INTERRUPTED'), create('span', '', message || '暂时无法获取项目数据，请稍后重试。'));
    const retry = create('button', 'refresh-button', '↻ TRY AGAIN');
    retry.type = 'button';
    retry.addEventListener('click', loadRepositories);
    empty.append(retry);
    elements.projectGrid.append(empty);
    elements.projectCount.textContent = 'WAITING FOR GITHUB';
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CONFIG.cacheKey) || 'null');
      return cached && Array.isArray(cached.repositories) ? cached : null;
    } catch {
      return null;
    }
  }

  function writeCache(repositories) {
    try {
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ savedAt: Date.now(), repositories }));
    } catch {
      // Storage may be unavailable in private browsing; the live result still renders.
    }
  }

  async function fetchRepositories() {
    const endpoint = `https://api.github.com/users/${encodeURIComponent(CONFIG.username)}/repos?type=owner&sort=updated&direction=desc&per_page=100`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub API 请求次数暂时达到上限，稍后会自动恢复。');
      if (response.status === 404) throw new Error('没有找到对应的 GitHub 用户，请检查账号配置。');
      throw new Error(`GitHub API 暂时不可用（${response.status}）。`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('GitHub 返回的数据格式不正确。');
    return data.filter((repo) => repo && repo.name && !repo.fork && repo.name !== CONFIG.websiteRepo);
  }

  async function loadRepositories(force = false) {
    if (elements.refresh) elements.refresh.disabled = true;
    const cached = readCache();
    const cacheFresh = cached && (Date.now() - cached.savedAt < CONFIG.cacheTtlMs);

    if (!force && cacheFresh) {
      renderProjects(cached.repositories, 'LOCAL CACHE');
      setStatus('CACHE READY', 'ok');
      if (elements.refresh) elements.refresh.disabled = false;
      return;
    }

    if (cached && cached.repositories.length) renderProjects(cached.repositories, 'CACHED DATA');
    setStatus('CONNECTING');

    try {
      const repositories = await fetchRepositories();
      writeCache(repositories);
      renderProjects(repositories, 'LIVE GITHUB DATA');
      setStatus('LIVE DATA UPDATED', 'ok');
    } catch (error) {
      if (cached && cached.repositories.length) {
        renderProjects(cached.repositories, 'OFFLINE CACHE');
        setStatus('USING OFFLINE CACHE', 'error');
        elements.projectCount.textContent += ` · ${error.message}`;
      } else {
        renderFailure(error.message);
        setStatus('CONNECTION FAILED', 'error');
      }
    } finally {
      if (elements.refresh) elements.refresh.disabled = false;
    }
  }

  async function loadProfile() {
    try {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(CONFIG.username)}`, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) return;
      const profile = await response.json();
      const name = profile.name || CONFIG.username.toUpperCase();
      $('#hero-name').textContent = name;
      $('#profile-display-name').textContent = name.toUpperCase();
      $('#profile-avatar').textContent = (name.trim()[0] || 'H').toUpperCase();
      document.title = `${name} — PLAYER 01`;
      const bio = profile.bio && profile.bio.trim();
      if (bio) $('.profile-bio').textContent = bio;
    } catch {
      // The hand-written profile fallback remains visible if profile lookup fails.
    }
  }

  function setupNavigation() {
    elements.menuToggle.addEventListener('click', () => {
      const isOpen = elements.menu.classList.toggle('open');
      elements.menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    elements.menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      elements.menu.classList.remove('open');
      elements.menuToggle.setAttribute('aria-expanded', 'false');
    }));
    elements.refresh.addEventListener('click', () => loadRepositories(true));
  }

  function init() {
    $('#current-year').textContent = String(new Date().getFullYear());
    setupNavigation();
    loadProfile();
    loadRepositories();
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
