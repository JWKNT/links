(() => {
  "use strict";

  const PAGE_SIZE = 200;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const elements = {
    search: document.querySelector("#link-search"),
    category: document.querySelector("#category-select"),
    sort: document.querySelector("#sort-select"),
    reset: document.querySelector("#reset-controls"),
    emptyReset: document.querySelector("#empty-reset"),
    list: document.querySelector("#link-list"),
    empty: document.querySelector("#empty-state"),
    status: document.querySelector("#result-status"),
    total: document.querySelector("#total-count"),
    pagination: document.querySelector("#pagination"),
    previous: document.querySelector("#previous-page"),
    next: document.querySelector("#next-page"),
    pageStatus: document.querySelector("#page-status"),
    categoryTemplate: document.querySelector("#category-template"),
    linkTemplate: document.querySelector("#link-template"),
  };

  const state = { links: [], categories: [], query: "", category: "", sort: "document", page: 1 };
  let renderQueued = false;

  function normalize(value) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  }

  function prepare(link, order) {
    let host = "";
    try {
      host = new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      host = link.url;
    }
    return {
      ...link,
      order,
      host,
      search: normalize(`${link.title} ${link.description} ${link.category} ${link.url}`),
    };
  }

  function visibleLinks() {
    const terms = normalize(state.query).split(/\s+/).filter(Boolean);
    const matches = state.links.filter((link) => {
      if (state.category && link.category !== state.category) return false;
      return terms.every((term) => link.search.includes(term));
    });

    const categoryOrder = new Map(state.categories.map((category, index) => [category, index]));
    if (state.sort === "category") {
      matches.sort((a, b) => collator.compare(a.category, b.category) || a.order - b.order);
    } else if (state.sort === "title") {
      matches.sort((a, b) => (categoryOrder.get(a.category) - categoryOrder.get(b.category)) || collator.compare(a.title, b.title));
    } else {
      matches.sort((a, b) => a.order - b.order);
    }
    return matches;
  }

  function makeEntry(link) {
    const fragment = elements.linkTemplate.content.cloneNode(true);
    const anchor = fragment.querySelector(".link-title");
    anchor.href = link.url;
    anchor.textContent = link.title;
    fragment.querySelector(".link-description").textContent = link.description;
    fragment.querySelector(".link-host").textContent = link.host;
    return fragment;
  }

  function renderNow() {
    renderQueued = false;
    const matches = visibleLinks();
    const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageLinks = matches.slice(start, start + PAGE_SIZE);
    const root = document.createDocumentFragment();
    let activeList = null;
    let activeCategory = null;

    for (const link of pageLinks) {
      if (link.category !== activeCategory) {
        const group = elements.categoryTemplate.content.cloneNode(true);
        group.querySelector("h2").textContent = link.category;
        activeList = group.querySelector("ol");
        root.append(group);
        activeCategory = link.category;
      }
      activeList.append(makeEntry(link));
    }

    elements.list.replaceChildren(root);
    elements.empty.hidden = matches.length !== 0;
    elements.status.textContent = matches.length === 0
      ? "0 links"
      : `${matches.length.toLocaleString()} ${matches.length === 1 ? "link" : "links"}${matches.length > PAGE_SIZE ? ` · showing ${(start + 1).toLocaleString()}–${Math.min(start + PAGE_SIZE, matches.length).toLocaleString()}` : ""}`;
    elements.reset.hidden = !state.query && !state.category && state.sort === "document";

    elements.pagination.hidden = pageCount <= 1;
    elements.previous.disabled = state.page <= 1;
    elements.next.disabled = state.page >= pageCount;
    elements.pageStatus.textContent = `Page ${state.page.toLocaleString()} of ${pageCount.toLocaleString()}`;
  }

  function requestRender({ resetPage = true } = {}) {
    if (resetPage) state.page = 1;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(renderNow);
  }

  function resetControls() {
    state.query = "";
    state.category = "";
    state.sort = "document";
    elements.search.value = "";
    elements.category.value = "";
    elements.sort.value = "document";
    requestRender();
    elements.search.focus();
  }

  async function load() {
    try {
      const response = await fetch("data/links.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      state.links = Array.isArray(data.links) ? data.links.map(prepare) : [];

      const options = document.createDocumentFragment();
      const counts = new Map();
      for (const link of state.links) counts.set(link.category, (counts.get(link.category) || 0) + 1);
      for (const category of state.categories) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = `${category} (${(counts.get(category) || 0).toLocaleString()})`;
        options.append(option);
      }
      elements.category.append(options);
      elements.total.textContent = `${state.links.length.toLocaleString()} ${state.links.length === 1 ? "link" : "links"} · ${state.categories.length.toLocaleString()} ${state.categories.length === 1 ? "category" : "categories"}`;
      renderNow();
    } catch (error) {
      elements.total.textContent = "Unavailable";
      elements.status.textContent = "The link collection could not be loaded.";
      elements.empty.hidden = false;
      elements.empty.querySelector("p").textContent = `The link collection could not be loaded (${error.message}).`;
      elements.emptyReset.hidden = true;
    }
  }

  elements.search.addEventListener("input", () => {
    state.query = elements.search.value;
    requestRender();
  });
  elements.category.addEventListener("change", () => {
    state.category = elements.category.value;
    requestRender();
  });
  elements.sort.addEventListener("change", () => {
    state.sort = elements.sort.value;
    requestRender();
  });
  elements.reset.addEventListener("click", resetControls);
  elements.emptyReset.addEventListener("click", resetControls);
  elements.previous.addEventListener("click", () => {
    state.page -= 1;
    requestRender({ resetPage: false });
    elements.status.scrollIntoView({ block: "start" });
  });
  elements.next.addEventListener("click", () => {
    state.page += 1;
    requestRender({ resetPage: false });
    elements.status.scrollIntoView({ block: "start" });
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      elements.search.focus();
      elements.search.select();
    } else if (event.key === "Escape" && document.activeElement === elements.search && elements.search.value) {
      elements.search.value = "";
      state.query = "";
      requestRender();
    }
  });

  load();
})();
