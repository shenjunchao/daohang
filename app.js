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
        { id: createId(), name: "腾讯空间", url: "https://qzone.qq.com", icon: "Q" },
        { id: createId(), name: "百度贴吧", url: "https://tieba.baidu.com", icon: "百" },
        { id: createId(), name: "网易邮箱", url: "https://mail.163.com", icon: "邮" },
        { id: createId(), name: "搜狐新闻", url: "https://news.sohu.com", icon: "搜" },
        { id: createId(), name: "新浪微博", url: "https://weibo.com", icon: "微" },
      ],
    },
    {
      id: createId(),
      name: "分类2",
      sites: [
        { id: createId(), name: "GitHub", url: "https://github.com", icon: "G" },
        { id: createId(), name: "Vercel", url: "https://vercel.com", icon: "V" },
        { id: createId(), name: "知乎", url: "https://www.zhihu.com", icon: "知" },
      ],
    },
  ],
};

const defaultAnnouncement = {
  id: null,
  title: "公告",
  content: "这里可以展示使用教程、注意事项和版本更新说明。你可以在管理页修改内容并发布。",
  downloadUrl: "",
  downloadLabel: "",
  updatedAt: "",
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
let announcement = { ...defaultAnnouncement };

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const engineSelect = document.querySelector("#engineSelect");
const searchButton = document.querySelector("#searchButton");
const sidebar = document.querySelector("#sidebar");
const categoryCards = document.querySelector("#categoryCards");
const editToggle = document.querySelector("#editToggle");
const editPanel = document.querySelector("#editPanel");
const categoryForm = document.querySelector("#categoryForm");
const categoryName = document.querySelector("#categoryName");
const siteForm = document.querySelector("#siteForm");
const siteCategory = document.querySelector("#siteCategory");
const siteName = document.querySelector("#siteName");
const siteUrl = document.querySelector("#siteUrl");
const siteIcon = document.querySelector("#siteIcon");
const editingSiteId = document.querySelector("#editingSiteId");
const editingSiteCategoryId = document.querySelector("#editingSiteCategoryId");
const siteSubmitButton = document.querySelector("#siteSubmitButton");
const cancelSiteEditButton = document.querySelector("#cancelSiteEditButton");
const fetchIconButton = document.querySelector("#fetchIconButton");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");
const categoryTemplate = document.querySelector("#categoryTemplate");
const siteTemplate = document.querySelector("#siteTemplate");

const authForm = document.querySelector("#authForm");
const authStatus = document.querySelector("#authStatus");
const authUsername = document.querySelector("#authUsername");
const authPassword = document.querySelector("#authPassword");
const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const loginButton = document.querySelector("#loginButton");
const registerButton = document.querySelector("#registerButton");
const syncNowButton = document.querySelector("#syncNowButton");
const logoutButton = document.querySelector("#logoutButton");

const announcementTrigger = document.querySelector("#announcementTrigger");
const announcementModal = document.querySelector("#announcementModal");
const announcementModalTitle = document.querySelector("#announcementModalTitle");
const announcementUpdatedAt = document.querySelector("#announcementUpdatedAt");
const announcementContent = document.querySelector("#announcementContent");
const announcementDownloadLink = document.querySelector("#announcementDownloadLink");
const announcementModalClose = document.querySelector("#announcementModalClose");
const announcementFeedbackForm = document.querySelector("#announcementFeedbackForm");
const announcementFeedbackName = document.querySelector("#announcementFeedbackName");
const announcementFeedbackEmail = document.querySelector("#announcementFeedbackEmail");
const announcementFeedbackContent = document.querySelector("#announcementFeedbackContent");
const announcementFeedbackStatus = document.querySelector("#announcementFeedbackStatus");
const announcementFeedbackSubmit = document.querySelector("#announcementFeedbackSubmit");

render();
initCloudSession();
initAnnouncement();

window.addEventListener("hashchange", () => {
  activeCategoryId = location.hash.replace("#", "");
  renderSidebar();
});

searchForm.addEventListener("submit", handleSearch);
engineSelect.addEventListener("change", updateSearchButton);
editToggle.addEventListener("click", toggleEditMode);
categoryForm.addEventListener("submit", handleCategorySubmit);
siteUrl.addEventListener("blur", autofillSiteIcon);
fetchIconButton.addEventListener("click", handleFetchIcon);
cancelSiteEditButton.addEventListener("click", resetSiteForm);
siteForm.addEventListener("submit", handleSiteSubmit);
exportButton.addEventListener("click", handleExport);
importInput.addEventListener("change", handleImport);
authForm.addEventListener("submit", handleLogin);
forgotPasswordButton.addEventListener("click", handleForgotPassword);
registerButton.addEventListener("click", handleRegister);
syncNowButton.addEventListener("click", () => syncToCloud({ showStatus: true }));
logoutButton.addEventListener("click", handleLogout);
announcementTrigger.addEventListener("click", openAnnouncementModal);
announcementModalClose.addEventListener("click", closeAnnouncementModal);
announcementFeedbackForm?.addEventListener("submit", handleAnnouncementFeedbackSubmit);
announcementModal.addEventListener("click", (event) => {
  if (event.target === announcementModal) {
    closeAnnouncementModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !announcementModal.hidden) {
    closeAnnouncementModal();
  }
});

function render() {
  document.title = data.settings?.title || "个人导航";
  renderAnnouncement();
  renderSearchEngines();
  renderSidebar();
  renderCategoryOptions();
  renderCategories();
  renderAuthState();
  syncEditingState();
  syncAnnouncementFeedbackState();
}

function renderSearchEngines() {
  const currentValue = engineSelect.value;
  engineSelect.innerHTML = "";

  data.searchEngines.forEach((engine, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = engine.name;
    engineSelect.append(option);
  });

  engineSelect.value = data.searchEngines[currentValue] ? currentValue : "0";
  updateSearchButton();
}

function renderAnnouncement() {
  if (announcementModalTitle) {
    announcementModalTitle.textContent = announcement.title || defaultAnnouncement.title;
  }

  if (announcementUpdatedAt) {
    announcementUpdatedAt.textContent = formatAnnouncementTime(announcement.updatedAt);
  }

  if (announcementContent) {
    announcementContent.textContent = announcement.content || defaultAnnouncement.content;
  }

  if (announcementDownloadLink) {
    const hasDownload = Boolean(announcement.downloadUrl);
    announcementDownloadLink.hidden = !hasDownload;
    announcementDownloadLink.href = hasDownload ? announcement.downloadUrl : "#";
    announcementDownloadLink.textContent = announcement.downloadLabel || "下载附件";
  }
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
    link.draggable = editing;
    link.dataset.categoryId = category.id;
    link.textContent = category.name;
    link.addEventListener("click", () => {
      activeCategoryId = category.id;
      renderSidebar();
    });
    link.addEventListener("dragstart", (event) => startCategoryDrag(event, category.id, link));
    link.addEventListener("dragend", () => endCategoryDrag(link));
    link.addEventListener("dragover", (event) => overSidebarItem(event, link));
    link.addEventListener("dragleave", () => link.classList.remove("is-drop-target", "is-drop-after"));
    link.addEventListener("drop", (event) => dropSidebarItem(event, category.id, link));
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
  } else if (data.categories[0]) {
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
  forgotPasswordButton.hidden = !configured || loggedIn;
  syncNowButton.hidden = !configured || !loggedIn;
  logoutButton.hidden = !configured || !loggedIn;
}

function syncAnnouncementFeedbackState() {
  if (!announcementFeedbackForm) return;

  const configured = supabaseReady;
  const loggedIn = Boolean(currentUser);

  announcementFeedbackName.disabled = !configured;
  announcementFeedbackEmail.disabled = !configured;
  announcementFeedbackContent.disabled = !configured;
  announcementFeedbackSubmit.disabled = !configured;
  announcementFeedbackEmail.readOnly = loggedIn;

  if (loggedIn) {
    announcementFeedbackEmail.value = currentUser.email || "";
  }

  if (!configured) {
    announcementFeedbackStatus.textContent = "未配置 Supabase，暂时无法提交反馈。";
    return;
  }

  if (!announcementFeedbackStatus.dataset.manual || announcementFeedbackStatus.dataset.manual === "false") {
    announcementFeedbackStatus.textContent = loggedIn
      ? "已登录，可直接向开发者 / 管理员提交反馈。"
      : "可匿名留言，建议留下邮箱，方便管理员联系你。";
  }
}

function syncEditingState() {
  document.body.classList.toggle("is-editing", editing);
  editPanel.classList.toggle("is-manage-mode", editing);
  editToggle.textContent = editing ? "完成" : "编辑";
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

  item.querySelector(".edit-site").addEventListener("click", () => {
    beginSiteEdit(categoryId, site);
  });

  item.querySelector(".remove-site").addEventListener("click", () => {
    deleteSite(categoryId, site.id);
  });

  return item;
}

function handleSearch(event) {
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
}

function toggleEditMode() {
  editing = !editing;
  render();
}

function handleCategorySubmit(event) {
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
}

function autofillSiteIcon() {
  if (!siteIcon.value.trim() && siteUrl.value.trim()) {
    siteIcon.value = getFaviconUrl(normalizeUrl(siteUrl.value.trim()));
  }
}

function handleFetchIcon() {
  const url = normalizeUrl(siteUrl.value.trim());
  if (!url) {
    siteUrl.focus();
    return;
  }

  siteIcon.value = getFaviconUrl(url);
}

function handleSiteSubmit(event) {
  event.preventDefault();
  const name = siteName.value.trim();
  const url = normalizeUrl(siteUrl.value.trim());
  const icon = siteIcon.value.trim() || getFaviconUrl(url);
  const targetCategory = data.categories.find((item) => item.id === siteCategory.value);

  if (!targetCategory || !name || !url) return;

  if (editingSiteId.value) {
    updateSite({
      sourceCategoryId: editingSiteCategoryId.value,
      siteId: editingSiteId.value,
      targetCategoryId: targetCategory.id,
      name,
      url,
      icon,
    });
    return;
  }

  targetCategory.sites.push({
    id: createId(),
    name,
    url,
    icon,
  });

  resetSiteForm();
  siteCategory.value = targetCategory.id;
  saveAndRender();
}

function handleExport() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "my-navigation.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function handleImport() {
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
}

function openAnnouncementModal() {
  announcementModal.hidden = false;
  document.body.classList.add("is-modal-open");
  if (announcementFeedbackStatus) {
    announcementFeedbackStatus.dataset.manual = "false";
  }
  syncAnnouncementFeedbackState();
}

function closeAnnouncementModal() {
  announcementModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

async function initAnnouncement(options = {}) {
  if (!supabaseClient) {
    renderAnnouncement();
    return;
  }

  try {
    const { data: row, error } = await supabaseClient
      .from("site_announcements")
      .select("id, title, content, download_url, download_label, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    announcement = row
      ? {
          id: row.id,
          title: String(row.title || defaultAnnouncement.title),
          content: String(row.content || defaultAnnouncement.content),
          downloadUrl: String(row.download_url || ""),
          downloadLabel: String(row.download_label || ""),
          updatedAt: String(row.updated_at || ""),
        }
      : {
          ...defaultAnnouncement,
          content: "暂时还没有发布公告。你可以在右侧公告管理里新增一条内容。",
        };
  } catch {
    announcement = {
      ...defaultAnnouncement,
      content: "公告加载失败。请确认 Supabase 中已创建公告表，并且存在一条已发布公告。",
    };
  }

  renderAnnouncement();
}

async function handleAnnouncementFeedbackSubmit(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setAnnouncementFeedbackStatus("未配置 Supabase，暂时无法提交反馈。");
    return;
  }

  const nickname = announcementFeedbackName.value.trim();
  const contactEmail = announcementFeedbackEmail.value.trim();
  const content = announcementFeedbackContent.value.trim();

  if (!content) {
    setAnnouncementFeedbackStatus("请先填写反馈内容。");
    announcementFeedbackContent.focus();
    return;
  }

  announcementFeedbackSubmit.disabled = true;
  setAnnouncementFeedbackStatus("正在提交反馈...");

  const payload = {
    user_id: currentUser?.id || null,
    nickname,
    contact_email: contactEmail,
    content,
    source_page: window.location.href,
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("site_feedback").insert(payload);

  announcementFeedbackSubmit.disabled = false;

  if (error) {
    setAnnouncementFeedbackStatus(error.message || "提交反馈失败，请稍后重试。");
    return;
  }

  announcementFeedbackContent.value = "";
  if (!currentUser) {
    announcementFeedbackName.value = "";
    announcementFeedbackEmail.value = "";
  }
  setAnnouncementFeedbackStatus("反馈已提交成功，感谢你的建议。", true);
}

function setAnnouncementFeedbackStatus(text, keep = false) {
  if (!announcementFeedbackStatus) return;
  announcementFeedbackStatus.textContent = text;
  announcementFeedbackStatus.dataset.manual = keep ? "true" : "false";
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

async function handleLogin(event) {
  event.preventDefault();
  if (!supabaseClient) return;

  const email = authUsername.value.trim();
  const password = authPassword.value.trim();
  if (!email || !password) {
    setAuthNotice("请输入邮箱和密码。");
    renderAuthState();
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
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
  const emailRedirectTo = new URL("./", window.location.href).toString();
  const { data: signUpData, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
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
  await syncToCloud({ showStatus: true });
}

async function handleForgotPassword() {
  if (!supabaseClient) return;

  const email = authUsername.value.trim();
  if (!email) {
    setAuthNotice("请先输入你的注册邮箱。");
    renderAuthState();
    authUsername.focus();
    return;
  }

  const redirectTo = new URL("./reset-password.html", window.location.href).toString();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    setAuthNotice(error.message || "发送重置邮件失败。");
    renderAuthState();
    return;
  }

  setAuthNotice("重置密码邮件已发送，请前往邮箱打开链接设置新密码。");
  renderAuthState();
}

async function handleLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
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

  if (sourceCategory === targetCategory && sourceIndex < targetIndex) {
    targetIndex -= 1;
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

function overSidebarItem(event, link) {
  if (!editing || !draggedCategoryId) return;

  event.preventDefault();
  const rect = link.getBoundingClientRect();
  const shouldPlaceAfter = event.clientY > rect.top + rect.height / 2;
  link.classList.toggle("is-drop-after", shouldPlaceAfter);
  link.classList.add("is-drop-target");
}

function dropSidebarItem(event, targetCategoryId, link) {
  if (!editing || !draggedCategoryId) return;

  event.preventDefault();
  event.stopPropagation();
  const rect = link.getBoundingClientRect();
  const place = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  moveCategory(draggedCategoryId, targetCategoryId, place);
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

function moveCategory(sourceCategoryId, targetCategoryId, place = "before") {
  if (sourceCategoryId === targetCategoryId) return;

  const sourceIndex = data.categories.findIndex((category) => category.id === sourceCategoryId);
  const targetIndex = data.categories.findIndex((category) => category.id === targetCategoryId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  const [category] = data.categories.splice(sourceIndex, 1);
  let insertIndex = targetIndex;
  if (place === "after") {
    insertIndex += 1;
  }

  if (sourceIndex < insertIndex) {
    insertIndex -= 1;
  }

  data.categories.splice(insertIndex, 0, category);
  saveAndRender();
}

function clearDropStates() {
  document
    .querySelectorAll(".is-droppable, .is-drop-target, .is-drop-after, .is-category-target, .is-dragging")
    .forEach((element) => {
      element.classList.remove("is-droppable", "is-drop-target", "is-drop-after", "is-category-target", "is-dragging");
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
  if (editingSiteId.value === siteId) {
    resetSiteForm();
  }
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

function formatAnnouncementTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `更新于 ${date.toLocaleDateString("zh-CN")}`;
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

function beginSiteEdit(categoryId, site) {
  editingSiteId.value = site.id;
  editingSiteCategoryId.value = categoryId;
  siteCategory.value = categoryId;
  siteName.value = site.name;
  siteUrl.value = site.url;
  siteIcon.value = site.icon || "";
  siteSubmitButton.textContent = "保存修改";
  cancelSiteEditButton.hidden = false;
  siteName.focus();
}

function resetSiteForm() {
  siteForm.reset();
  editingSiteId.value = "";
  editingSiteCategoryId.value = "";
  siteSubmitButton.textContent = "添加网站";
  cancelSiteEditButton.hidden = true;
  if (data.categories[0]) {
    siteCategory.value = data.categories[0].id;
  }
}

function updateSite({ sourceCategoryId, siteId, targetCategoryId, name, url, icon }) {
  const sourceCategory = data.categories.find((category) => category.id === sourceCategoryId);
  const targetCategory = data.categories.find((category) => category.id === targetCategoryId);
  if (!sourceCategory || !targetCategory) return;

  const siteIndex = sourceCategory.sites.findIndex((site) => site.id === siteId);
  if (siteIndex < 0) return;

  const [site] = sourceCategory.sites.splice(siteIndex, 1);
  site.name = name;
  site.url = url;
  site.icon = icon;
  targetCategory.sites.push(site);

  resetSiteForm();
  siteCategory.value = targetCategoryId;
  saveAndRender();
}
