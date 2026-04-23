const storageKey = "personal-navigation-data";
const defaultData = {
  settings: {
    eyebrow: "My Navigation",
    title: "个人自定义导航",
  },
  searchEngines: [
    { name: "百度", action: "https://www.baidu.com/s", queryKey: "wd", buttonText: "百度一下" },
    { name: "必应", action: "https://www.bing.com/search", queryKey: "q", buttonText: "必应搜索" },
    { name: "Google", action: "https://www.google.com/search", queryKey: "q", buttonText: "Google" },
  ],
  categories: [
    {
      id: createId(),
      name: "分类1",
      sites: [
        { id: createId(), name: "腾讯·空间", url: "https://qzone.qq.com", icon: "Q" },
        { id: createId(), name: "百度·贴吧", url: "https://tieba.baidu.com", icon: "百" },
        { id: createId(), name: "网易·邮箱", url: "https://mail.163.com", icon: "邮" },
        { id: createId(), name: "搜狐·新闻", url: "https://news.sohu.com", icon: "搜" },
        { id: createId(), name: "新浪·微博", url: "https://weibo.com", icon: "微" },
        { id: createId(), name: "凤凰·军事", url: "https://news.ifeng.com/mil", icon: "凤" },
      ],
    },
    {
      id: createId(),
      name: "分类2",
      sites: [
        { id: createId(), name: "GitHub", url: "https://github.com", icon: "G" },
        { id: createId(), name: "Vercel", url: "https://vercel.com", icon: "V" },
        { id: createId(), name: "Stack Overflow", url: "https://stackoverflow.com", icon: "S" },
        { id: createId(), name: "知乎", url: "https://www.zhihu.com", icon: "知" },
      ],
    },
  ],
};

const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseReady = Boolean(
  window.supabase?.createClient &&
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  !supabaseConfig.url.includes("YOUR_") &&
  !supabaseConfig.anonKey.includes("YOUR_"),
);

const supabaseClient = supabaseReady
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

let data = loadLocalData();
let editing = false;
let draggedSite = null;
let draggedCategoryId = "";
let activeCategoryId = location.hash.replace("#", "");
let currentUser = null;
let authNotice = "";
let syncTimer = null;
let syncing = false;
let syncQueued = false;

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const engineSelect = document.querySelector("#engineSelect");
const searchButton = document.querySelector("#searchButton");
const eyebrowText = document.querySelector("#eyebrowText");
const pageTitle = document.querySelector("#pageTitle");
const sidebar = document.querySelector("#sidebar");
const categoryCards = document.querySelector("#categoryCards");
const editToggle = document.querySelector("#editToggle");
const editPanel = document.querySelector("#editPanel");
const appearanceForm = document.querySelector("#appearanceForm");
const settingsEyebrow = document.querySelector("#settingsEyebrow");
const settingsTitle = document.querySelector("#settingsTitle");
const categoryForm = document.querySelector("#categoryForm");
const categoryName = document.querySelector("#categoryName");
const siteForm = document.querySelector("#siteForm");
const siteCategory = document.querySelector("#siteCategory");
const siteName = document.querySelector("#siteName");
const siteUrl = document.querySelector("#siteUrl");
const siteIcon = document.querySelector("#siteIcon");
const fetchIconButton = document.querySelector("#fetchIconButton");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");
const categoryTemplate = document.querySelector("#categoryTemplate");
const siteTemplate = document.querySelector("#siteTemplate");
const authForm = document.querySelector("#authForm");
const authStatus = document.querySelector("#authStatus");
const authUsername = document.querySelector("#authUsername");
const authPassword = document.querySelector("#authPassword");
const loginButton = document.querySelector("#loginButton");
const registerButton = document.querySelector("#registerButton");
const syncNowButton = document.querySelector("#syncNowButton");
const logoutButton = document.querySelector("#logoutButton");

render();
initCloudSession();

window.addEventListener("hashchange", () => {
  activeCategoryId = location.hash.replace("#", "");
  renderSidebar();
});

appearanceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  data.settings.eyebrow = settingsEyebrow.value.trim() || defaultData.settings.eyebrow;
  data.settings.title = settingsTitle.value.trim() || defaultData.settings.title;
  saveAndRender();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleLogin();
});

registerButton.addEventListener("click", async () => {
  await handleRegister();
});

syncNowButton.addEventListener("click", async () => {
  await syncToCloud({ immediate: true, showStatus: true });
});

logoutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const keyword = searchInput.value.trim();
  if (!keyword) {
    searchInput.focus();
    return;
  }

  const engine = data.searchEngines[Number(engineSelect.value)] || data.searchEngines[0];
  const target = new URL(engine.action);
  target.searchParams.set(engine.queryKey, keyword);
  window.open(target.toString(), "_blank", "noreferrer");
});

engineSelect.addEventListener("change", updateSearchButton);

editToggle.addEventListener("click", () => {
  editing = !editing;
  document.body.classList.toggle("is-editing", editing);
  editToggle.textContent = editing ? "完成" : "编辑";
  syncEditingState();
  render();
});

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryName.value.trim();
  if (!name) return;

  data.categories.push({
    id: createId(),
    name,
    sites: [],
  });

  categoryName.value = "";
  saveAndRender();
});

siteUrl.addEventListener("blur", () => {
  if (!siteIcon.value.trim() && siteUrl.value.trim()) {
    siteIcon.value = getFaviconUrl(normalizeUrl(siteUrl.value.trim()));
  }
});

fetchIconButton.addEventListener("click", () => {
  const url = normalizeUrl(siteUrl.value.trim());
  if (!url) {
    siteUrl.focus();
    return;
  }

  siteIcon.value = getFaviconUrl(url);
});

siteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const category = data.categories.find((item) => item.id === siteCategory.value);
  const name = siteName.value.trim();
  const url = normalizeUrl(siteUrl.value.trim());
  const icon = siteIcon.value.trim() || getFaviconUrl(url);

  if (!category || !name || !url) return;

  category.sites.push({
    id: createId(),
    name,
    url,
    icon,
  });

  siteForm.reset();
  siteCategory.value = category.id;
  saveAndRender();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "my-navigation.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.categories) || !Array.isArray(imported.searchEngines)) {
      throw new Error("invalid data");
    }

    data = normalizeImportedData(imported);
    saveAndRender();
    setAuthNotice(currentUser ? "导入成功，已准备同步到云端。" : "导入成功，已保存到本地。");
  } catch {
    alert("导入失败，请选择由本页面导出的 JSON 文件。");
  } finally {
    importInput.value = "";
    renderAuthState();
  }
});

function render() {
  renderPageSettings();
  renderSearchEngines();
  renderSidebar();
  renderCategoryOptions();
  renderCategories();
  renderAuthState();
  syncEditingState();
}

function renderSearchEngines() {
  engineSelect.innerHTML = "";

  data.searchEngines.forEach((engine, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = engine.name;
    engineSelect.append(option);
  });

  updateSearchButton();
}

function renderPageSettings() {
  const settings = getSettings();

  eyebrowText.textContent = settings.eyebrow;
  pageTitle.textContent = settings.title;
  document.title = settings.title || "个人导航";

  settingsEyebrow.value = settings.eyebrow;
  settingsTitle.value = settings.title;
}

function renderSidebar() {
  sidebar.innerHTML = "";
  const activeExists = data.categories.some((category) => category.id === activeCategoryId);
  const currentCategoryId = activeExists ? activeCategoryId : data.categories[0]?.id;
  activeCategoryId = currentCategoryId || "";

  data.categories.forEach((category) => {
    const link = document.createElement("a");
    link.className = "side-link";
    link.classList.toggle("is-active", category.id === currentCategoryId);
    link.href = `#${category.id}`;
    link.textContent = category.name;
    link.addEventListener("click", () => {
      activeCategoryId = category.id;
      renderSidebar();
    });
    sidebar.append(link);
  });
}

function renderCategoryOptions() {
  const currentValue = siteCategory.value;
  siteCategory.innerHTML = "";

  data.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    siteCategory.append(option);
  });

  if (data.categories.some((category) => category.id === currentValue)) {
    siteCategory.value = currentValue;
    return;
  }

  if (data.categories[0]) {
    siteCategory.value = data.categories[0].id;
  }
}

function renderAuthState() {
  const configured = supabaseReady;
  const loggedIn = Boolean(currentUser);
  const fallbackNotice = configured
    ? loggedIn
      ? `已登录：${currentUser.email}，修改会自动同步。`
      : "未登录，当前使用本地数据。"
    : "未配置 Supabase，当前使用本地数据。";

  authStatus.textContent = authNotice || fallbackNotice;
  authForm.classList.toggle("is-auth-disabled", !configured);
  authUsername.readOnly = loggedIn || !configured;
  authPassword.readOnly = loggedIn || !configured;
  authUsername.value = loggedIn ? currentUser.email || "" : authUsername.value;
  authPassword.value = loggedIn ? "" : authPassword.value;
  authPassword.placeholder = loggedIn ? "账号已登录" : "密码";

  loginButton.hidden = !configured || loggedIn;
  registerButton.hidden = !configured || loggedIn;
  syncNowButton.hidden = !configured || !loggedIn;
  logoutButton.hidden = !configured || !loggedIn;
}

function syncEditingState() {
  editPanel.classList.toggle("is-manage-mode", editing);
}

function renderCategories() {
  categoryCards.innerHTML = "";

  if (!data.categories.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有分类，使用右侧表单添加你的第一个导航分类。";
    categoryCards.append(empty);
    return;
  }

  data.categories.forEach((category) => {
    const card = categoryTemplate.content.firstElementChild.cloneNode(true);
    const header = card.querySelector(".card-header");
    const grid = card.querySelector(".site-grid");

    card.id = category.id;
    card.dataset.categoryId = category.id;
    header.draggable = editing;
    grid.dataset.categoryId = category.id;

    card.querySelector("h2").textContent = category.name;
    card.querySelector(".rename-category").addEventListener("click", () => renameCategory(category.id));
    card.querySelector(".delete-category").addEventListener("click", () => deleteCategory(category.id));

    header.addEventListener("dragstart", (event) => startCategoryDrag(event, category.id, card));
    header.addEventListener("dragend", () => endCategoryDrag(card));
    card.addEventListener("dragover", (event) => overCategory(event, card));
    card.addEventListener("dragleave", () => card.classList.remove("is-category-target"));
    card.addEventListener("drop", (event) => dropCategory(event, category.id));

    grid.addEventListener("dragover", overSiteGrid);
    grid.addEventListener("dragleave", () => grid.classList.remove("is-droppable"));
    grid.addEventListener("drop", (event) => dropSiteToGrid(event, category.id));

    category.sites.forEach((site) => {
      grid.append(createSiteItem(category.id, site));
    });

    categoryCards.append(card);
  });
}

function createSiteItem(categoryId, site) {
  const item = siteTemplate.content.firstElementChild.cloneNode(true);
  const link = item.querySelector(".site-link");
  const icon = item.querySelector(".site-icon");

  item.dataset.categoryId = categoryId;
  item.dataset.siteId = site.id;
  item.draggable = editing;
  link.href = site.url;
  link.querySelector(".site-title").textContent = site.name;
  link.addEventListener("click", (event) => {
    if (editing) {
      event.preventDefault();
    }
  });

  renderIcon(icon, site);

  item.addEventListener("dragstart", (event) => startSiteDrag(event, categoryId, site.id, item));
  item.addEventListener("dragend", () => endSiteDrag(item));
  item.addEventListener("dragover", (event) => overSiteItem(event, item));
  item.addEventListener("dragleave", () => item.classList.remove("is-drop-target", "is-drop-after"));
  item.addEventListener("drop", (event) => dropSiteToItem(event, categoryId, site.id, item));

  item.querySelector(".refresh-site-icon").addEventListener("click", () => {
    site.icon = getFaviconUrl(site.url);
    saveAndRender();
  });

  item.querySelector(".remove-site").addEventListener("click", () => {
    deleteSite(categoryId, site.id);
  });

  return item;
}

function startSiteDrag(event, categoryId, siteId, item) {
  if (!editing) {
    event.preventDefault();
    return;
  }

  draggedSite = { categoryId, siteId };
  draggedCategoryId = "";
  item.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", "site");
}

function endSiteDrag(item) {
  draggedSite = null;
  item.classList.remove("is-dragging");
  clearDropStates();
}

function overSiteGrid(event) {
  if (!editing || !draggedSite) return;

  event.preventDefault();
  event.currentTarget.classList.add("is-droppable");
}

function overSiteItem(event, item) {
  if (!editing || !draggedSite) return;

  event.preventDefault();
  const rect = item.getBoundingClientRect();
  const shouldPlaceAfter = event.clientX > rect.left + rect.width / 2;
  item.classList.toggle("is-drop-after", shouldPlaceAfter);
  item.classList.add("is-drop-target");
}

function dropSiteToItem(event, targetCategoryId, targetSiteId, item) {
  if (!editing || !draggedSite) return;

  event.preventDefault();
  event.stopPropagation();
  const rect = item.getBoundingClientRect();
  const place = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
  moveSite(draggedSite.categoryId, draggedSite.siteId, targetCategoryId, targetSiteId, place);
}

function dropSiteToGrid(event, targetCategoryId) {
  if (!editing || !draggedSite) return;

  event.preventDefault();
  moveSite(draggedSite.categoryId, draggedSite.siteId, targetCategoryId, "", "end");
}

function moveSite(sourceCategoryId, sourceSiteId, targetCategoryId, targetSiteId, place) {
  const sourceCategory = data.categories.find((category) => category.id === sourceCategoryId);
  const targetCategory = data.categories.find((category) => category.id === targetCategoryId);
  if (!sourceCategory || !targetCategory) return;

  const sourceIndex = sourceCategory.sites.findIndex((site) => site.id === sourceSiteId);
  if (sourceIndex < 0 || sourceSiteId === targetSiteId) return;

  const [site] = sourceCategory.sites.splice(sourceIndex, 1);
  let targetIndex = targetCategory.sites.findIndex((item) => item.id === targetSiteId);

  if (targetIndex < 0 || place === "end") {
    targetIndex = targetCategory.sites.length;
  } else if (place === "after") {
    targetIndex += 1;
  }

  targetCategory.sites.splice(targetIndex, 0, site);
  saveAndRender();
}

function startCategoryDrag(event, categoryId, card) {
  if (!editing || event.target.closest?.("button")) {
    event.preventDefault();
    return;
  }

  draggedCategoryId = categoryId;
  draggedSite = null;
  card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", "category");
}

function endCategoryDrag(card) {
  draggedCategoryId = "";
  card.classList.remove("is-dragging");
  clearDropStates();
}

function overCategory(event, card) {
  if (!editing || !draggedCategoryId) return;

  event.preventDefault();
  card.classList.add("is-category-target");
}

function dropCategory(event, targetCategoryId) {
  if (!editing || !draggedCategoryId) return;

  event.preventDefault();
  event.stopPropagation();
  moveCategory(draggedCategoryId, targetCategoryId);
}

function moveCategory(sourceCategoryId, targetCategoryId) {
  if (sourceCategoryId === targetCategoryId) return;

  const sourceIndex = data.categories.findIndex((category) => category.id === sourceCategoryId);
  const targetIndex = data.categories.findIndex((category) => category.id === targetCategoryId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  const [category] = data.categories.splice(sourceIndex, 1);
  data.categories.splice(targetIndex, 0, category);
  saveAndRender();
}

function clearDropStates() {
  document.querySelectorAll(".is-droppable, .is-drop-target, .is-drop-after, .is-category-target").forEach((element) => {
    element.classList.remove("is-droppable", "is-drop-target", "is-drop-after", "is-category-target");
  });
}

function renderIcon(iconElement, site) {
  iconElement.innerHTML = "";

  if (site.icon && isRemoteIcon(site.icon)) {
    const image = document.createElement("img");
    image.src = site.icon;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => fallbackIconImage(image, iconElement, site));
    iconElement.append(image);
    return;
  }

  iconElement.textContent = site.icon || getFallbackLetter(site.name);
}

function fallbackIconImage(image, iconElement, site) {
  const directIcon = getDirectFaviconUrl(site.url);
  if (!image.dataset.fallbackTried && directIcon && image.src !== directIcon) {
    image.dataset.fallbackTried = "true";
    image.src = directIcon;
    return;
  }

  iconElement.innerHTML = "";
  iconElement.textContent = getFallbackLetter(site.name);
}

function getFaviconUrl(url) {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(parsed.origin)}`;
  } catch {
    return "";
  }
}

function getDirectFaviconUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function renameCategory(categoryId) {
  const category = data.categories.find((item) => item.id === categoryId);
  if (!category) return;

  const name = prompt("请输入新的分类名称：", category.name)?.trim();
  if (!name) return;

  category.name = name;
  saveAndRender();
}

function deleteCategory(categoryId) {
  const category = data.categories.find((item) => item.id === categoryId);
  if (!category) return;

  if (!confirm(`确定删除“${category.name}”分类吗？分类下的网站也会删除。`)) return;

  data.categories = data.categories.filter((item) => item.id !== categoryId);
  saveAndRender();
}

function deleteSite(categoryId, siteId) {
  const category = data.categories.find((item) => item.id === categoryId);
  if (!category) return;

  category.sites = category.sites.filter((site) => site.id !== siteId);
  saveAndRender();
}

function updateSearchButton() {
  const engine = data.searchEngines[Number(engineSelect.value)] || data.searchEngines[0];
  searchButton.textContent = engine?.buttonText || "搜索";
}

function saveAndRender() {
  saveLocalData();
  render();
  scheduleCloudSync();
}

function loadLocalData() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return cloneData(defaultData);

  try {
    return normalizeImportedData(JSON.parse(saved));
  } catch {
    return cloneData(defaultData);
  }
}

function saveLocalData() {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

async function initCloudSession() {
  if (!supabaseClient) {
    renderAuthState();
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  await applySession(sessionData.session, { initial: true });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
}

async function applySession(session, options = {}) {
  currentUser = session?.user || null;

  if (!currentUser) {
    if (!options.initial) {
      setAuthNotice("已退出登录，当前使用本地数据。");
    }
    render();
    return;
  }

  authUsername.value = currentUser.email || "";

  try {
    const remoteNavigation = await loadCloudNavigation(currentUser.id);
    if (remoteNavigation) {
      data = normalizeImportedData(remoteNavigation);
      saveLocalData();
      setAuthNotice(options.initial ? "已从云端加载导航数据。" : "登录成功，已加载你的云端数据。");
    } else if (!options.initial) {
      setAuthNotice("登录成功，云端还没有导航数据，已使用当前本地数据。");
      scheduleCloudSync();
    }
  } catch (error) {
    setAuthNotice(error.message || "读取云端数据失败。");
  }

  render();
}

async function handleLogin() {
  if (!supabaseClient) return;

  const email = authUsername.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    setAuthNotice("请输入邮箱和密码。");
    renderAuthState();
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setAuthNotice(error.message || "登录失败。");
    renderAuthState();
    return;
  }

  authPassword.value = "";
}

async function handleRegister() {
  if (!supabaseClient) return;

  const email = authUsername.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    setAuthNotice("请输入邮箱和密码。");
    renderAuthState();
    return;
  }

  const localSnapshot = normalizeImportedData(data);
  const { data: signUpData, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    setAuthNotice(error.message || "注册失败。");
    renderAuthState();
    return;
  }

  if (!signUpData.session) {
    setAuthNotice("注册成功，请先去邮箱完成验证，再回来登录。");
    renderAuthState();
    return;
  }

  currentUser = signUpData.user;
  data = localSnapshot;
  saveLocalData();
  setAuthNotice("注册成功，正在同步当前导航到云端...");
  render();
  await syncToCloud({ immediate: true, showStatus: true });
}

async function loadCloudNavigation(userId) {
  const { data: row, error } = await supabaseClient
    .from("user_navigation")
    .select("navigation")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return row?.navigation || null;
}

function scheduleCloudSync() {
  if (!currentUser || !supabaseClient) return;

  if (syncing) {
    syncQueued = true;
    return;
  }

  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncToCloud();
  }, 700);
}

async function syncToCloud(options = {}) {
  if (!currentUser || !supabaseClient) return;
  if (syncing) {
    syncQueued = true;
    return;
  }

  syncing = true;
  clearTimeout(syncTimer);

  if (options.showStatus) {
    setAuthNotice("正在同步到云端...");
    renderAuthState();
  }

  const payload = {
    user_id: currentUser.id,
    navigation: normalizeImportedData(data),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("user_navigation").upsert(payload);

  syncing = false;

  if (error) {
    setAuthNotice(error.message || "云端同步失败。");
    renderAuthState();
    return;
  }

  setAuthNotice(`已同步到云端：${currentUser.email}`);
  renderAuthState();

  if (syncQueued) {
    syncQueued = false;
    scheduleCloudSync();
  }
}

function normalizeImportedData(imported) {
  return {
    settings: {
      eyebrow: String(imported.settings?.eyebrow || defaultData.settings.eyebrow),
      title: String(imported.settings?.title || defaultData.settings.title),
    },
    searchEngines: Array.isArray(imported.searchEngines) && imported.searchEngines.length
      ? imported.searchEngines.map((engine) => ({
          name: String(engine.name || "搜索"),
          action: String(engine.action || "https://www.baidu.com/s"),
          queryKey: String(engine.queryKey || "wd"),
          buttonText: String(engine.buttonText || engine.name || "搜索"),
        }))
      : cloneData(defaultData.searchEngines),
    categories: Array.isArray(imported.categories)
      ? imported.categories.map((category) => ({
          id: category.id || createId(),
          name: String(category.name || "未命名分类"),
          sites: Array.isArray(category.sites)
            ? category.sites.map((site) => ({
                id: site.id || createId(),
                name: String(site.name || "未命名网站"),
                url: normalizeUrl(String(site.url || "#")),
                icon: String(site.icon || ""),
              }))
            : [],
        }))
      : cloneData(defaultData.categories),
  };
}

function normalizeUrl(url) {
  if (!url) return "";
  if (url === "#") return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(value);
}

function getFallbackLetter(name) {
  return String(name || "?").slice(0, 1).toUpperCase();
}

function setAuthNotice(text) {
  authNotice = text;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneData(source) {
  return JSON.parse(JSON.stringify(source));
}

function getSettings() {
  return {
    eyebrow: data.settings?.eyebrow || defaultData.settings.eyebrow,
    title: data.settings?.title || defaultData.settings.title,
  };
}
