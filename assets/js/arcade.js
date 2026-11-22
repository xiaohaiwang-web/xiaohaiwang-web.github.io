(() => {
  'use strict';

  const CONFIG = {
    username: 'xiaohaiwang-web',
    websiteRepo: 'xiaohaiwang-web.github.io',
    projectsToShow: 24,
    cacheKey: 'xiaohaiwang_arcade_github_cache_v3',
    // Fresh cache is reused briefly to avoid exhausting GitHub's unauthenticated API quota.
    cacheTtlMs: 5 * 60 * 1000,
    requestTimeoutMs: 12000
  };

  const $ = (selector, root = document) => root.querySelector(selector);
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
    languageList: $('#language-list'),
    avatar: $('#profile-avatar'),
    profileName: $('#profile-display-name'),
    heroName: $('#hero-name')
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const safeExternalUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'github.com'
        ? url.href
        : `https://github.com/${CONFIG.username}`;
    } catch {
      return `https://github.com/${CONFIG.username}`;
    }
  };

  const setStatus = (message, state = '') => {
    if (elements.sync) {
      elements.sync.textContent = `● ${message}`;
      elements.sync.className = `sync-indicator ${state}`;
    }
    if (elements.connection) {
      elements.connection.textContent = state === 'ok'
        ? 'GITHUB CONNECTED'
        : state === 'error' ? 'OFFLINE MODE' : 'SYNCING DATA';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'UNKNOWN';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'UNKNOWN';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit' }).format(date);
  };

  const metric = (label, value) => create(
    'span', '', `${label} ${Number(value || 0).toLocaleString('en-US')}`
  );

  function makeProjectCard(repo, index) {
    const card = create('article', 'project-card');
    const top = create('div', 'project-topline');
    top.append(create('span', 'project-folder', '▰'));
    top.append(create('span', 'project-number', `FILE / ${String(index + 1).padStart(2, '0')}`));

    const title = create('h3', '', String(repo.name || 'Untitled').replace(/[-_]/g, ' '));
    const description = create(
      'p', '', repo.description || '一个持续迭代中的项目。点击查看源代码与更多说明。'
    );

    const tags = create('div', 'project-tags');
    if (repo.language) tags.append(create('span', 'project-tag', repo.language));
    if (repo.fork) tags.append(create('span', 'project-tag project-tag-fork', 'FORK'));
    if (repo.archived) tags.append(create('span', 'project-tag', 'ARCHIVED'));
    if (Array.isArray(repo.topics)) {
      repo.topics.slice(0, 2).forEach((topic) => tags.append(create('span', 'project-tag', topic)));
    }
    if (!tags.childElementCount) tags.append(create('span', 'project-tag', 'OPEN SOURCE'));

    const footer = create('div', 'project-footer');
    const metrics = create('div', 'project-metrics');
    metrics.append(metric('★', repo.stargazers_count));
    metrics.append(metric('⑂', repo.forks_count));
    footer.append(metrics);
    footer.append(create('span', 'project-updated', `UPDATED ${formatDate(repo.pushed_at || repo.updated_at)}`));

    const link = create('a', 'project-open', 'VIEW ↗');
    link.href = safeExternalUrl(repo.html_url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    footer.append(link);

    card.append(top, title, description, tags, footer);
    return card;
  }

  function renderStats(repositories) {
    const totalStars = repositories.reduce((sum, repo) => sum + (Number(repo.stargazers_count) || 0), 0);
    const languages = new Map();
    repositories.forEach((repo) => {
      if (repo.language) languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
    });
    const sortedLanguages = [...languages.entries()].sort((a, b) => b[1] - a[1]);

    if (elements.statRepos) elements.statRepos.textContent = String(repositories.length).padStart(2, '0');
    if (elements.statStars) elements.statStars.textContent = totalStars.toLocaleString('en-US');
    if (elements.statLanguages) elements.statLanguages.textContent = String(languages.size).padStart(2, '0');
    if (elements.score) elements.score.textContent = String(totalStars).padStart(6, '0').slice(-6);

    if (elements.languageList) {
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
  }

  function getDisplayRepositories(repositories) {
    return repositories
      .filter((repo) => repo && repo.name && repo.name !== CONFIG.websiteRepo)
      // Fork repositories are intentionally retained: they still belong to this account.
      .sort((a, b) => new Date(b.pushed_at || b.updated_at || 0) - new Date(a.pushed_at || a.updated_at || 0));
  }

  function renderProjects(repositories, sourceLabel) {
    const grid = elements.projectGrid;
    if (!grid) return;
    grid.replaceChildren();

    const visible = getDisplayRepositories(repositories).slice(0, CONFIG.projectsToShow);
    renderStats(getDisplayRepositories(repositories));

    if (!visible.length) {
      const empty = create('div', 'empty-card');
      empty.append(
        create('strong', '', 'NO PUBLIC PROJECTS YET'),
        create('span', '', '暂时没有可展示的公开仓库。欢迎前往 GitHub 查看完整作品。')
      );
      grid.append(empty);
      if (elements.projectCount) elements.projectCount.textContent = 'PROJECT ARCHIVE';
      return;
    }

    visible.forEach((repo, index) => grid.append(makeProjectCard(repo, index)));
    if (elements.projectCount) {
      elements.projectCount.textContent = `${visible.length} PROJECT${visible.length === 1 ? '' : 'S'} · ${sourceLabel}`;
    }
  }

  function renderFailure(message) {
    if (!elements.projectGrid) return;
    elements.projectGrid.replaceChildren();
    const empty = create('div', 'empty-card');
    empty.append(
      create('strong', '', 'PROJECTS TEMPORARILY UNAVAILABLE'),
      create('span', '', message || '暂时无法获取项目列表，请稍后再试。')
    );
    const profileLink = create('a', 'project-open', 'BROWSE ALL PROJECTS ↗');
    profileLink.href = `https://github.com/${CONFIG.username}?tab=repositories`;
    profileLink.target = '_blank';
    profileLink.rel = 'noopener noreferrer';
    empty.append(profileLink);
    elements.projectGrid.append(empty);
    if (elements.projectCount) elements.projectCount.textContent = 'PROJECT ARCHIVE';
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
      // Storage can be unavailable in private browsing; live rendering still works.
    }
  }

  async function requestJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          const reset = response.headers.get('X-RateLimit-Reset');
          const resetText = reset ? `（约 ${new Date(Number(reset) * 1000).toLocaleTimeString('zh-CN')} 后恢复）` : '';
          throw new Error(`GitHub 暂时限制了公开数据请求${resetText}。`);
        }
        if (response.status === 404) throw new Error('没有找到 GitHub 账号或公开仓库。');
        throw new Error(`GitHub 数据接口暂时不可用（${response.status}）。`);
      }
      return await response.json();
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('连接 GitHub 超时，请检查网络后重试。');
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchRepositories() {
    // Read all public repositories owned by this account, including forks.
    // GitHub returns at most 100 repositories per page, so keep requesting pages
    // until the last page is shorter than 100 (with a defensive upper bound).
    const allRepositories = [];
    const username = encodeURIComponent(CONFIG.username);

    for (let page = 1; page <= 10; page += 1) {
      const endpoint = `https://api.github.com/users/${username}/repos?type=owner&per_page=100&page=${page}&sort=updated&direction=desc`;
      const data = await requestJson(endpoint);
      if (!Array.isArray(data)) throw new Error('GitHub 返回的数据格式不正确。');

      allRepositories.push(...data);
      if (data.length < 100) break;
    }

    // Only omit this portfolio website's own repository. Forks and archived
    // public repositories remain visible; private repositories are not exposed
    // by GitHub's public-user endpoint.
    return allRepositories.filter((repo) => repo && repo.name && repo.name !== CONFIG.websiteRepo);
  }

  async function loadRepositories(force = false) {
    if (elements.refresh) elements.refresh.disabled = true;
    const cached = readCache();
    const cacheFresh = cached && (Date.now() - cached.savedAt < CONFIG.cacheTtlMs);

    if (!force && cacheFresh) {
      renderProjects(cached.repositories, 'RECENT PROJECTS');
      setStatus('PROJECTS READY', 'ok');
      if (elements.refresh) elements.refresh.disabled = false;
      return;
    }

    if (cached && cached.repositories.length) renderProjects(cached.repositories, 'SAVED PROJECTS');
    setStatus('LOADING PROJECTS');

    try {
      const repositories = await fetchRepositories();
      writeCache(repositories);
      renderProjects(repositories, 'GITHUB');
      setStatus('PROJECTS UPDATED', 'ok');
    } catch (error) {
      if (cached && cached.repositories.length) {
        renderProjects(cached.repositories, 'SAVED PROJECTS');
        setStatus('SAVED PROJECTS', 'error');
      } else {
        renderFailure(error && error.message);
        setStatus('TEMPORARILY OFFLINE', 'error');
      }
    } finally {
      if (elements.refresh) elements.refresh.disabled = false;
    }
  }

  function setupAvatar() {
    if (!elements.avatar) return;
    const image = $('img', elements.avatar);
    const fallback = $('.avatar-fallback', elements.avatar);
    if (!image) return;
    image.addEventListener('error', () => {
      elements.avatar.classList.add('is-fallback');
      if (fallback) fallback.textContent = 'H';
    }, { once: true });
  }

  function setupNavigation() {
    if (elements.menuToggle && elements.menu) {
      elements.menuToggle.addEventListener('click', () => {
        const isOpen = elements.menu.classList.toggle('open');
        elements.menuToggle.setAttribute('aria-expanded', String(isOpen));
      });
      elements.menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
        elements.menu.classList.remove('open');
        elements.menuToggle.setAttribute('aria-expanded', 'false');
      }));
    }
    if (elements.refresh) elements.refresh.addEventListener('click', () => loadRepositories(true));
  }

  function init() {
    const year = $('#current-year');
    if (year) year.textContent = String(new Date().getFullYear());
    setupAvatar();
    setupNavigation();
    loadRepositories();

    // Keep a long-open portfolio tab reasonably fresh without continuous API polling.
    window.setInterval(() => loadRepositories(true), 10 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
