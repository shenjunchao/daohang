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

let currentUser = null;
let isAdmin = false;
let announcementId = null;

const adminAuthForm = document.querySelector("#adminAuthForm");
const adminAuthStatus = document.querySelector("#adminAuthStatus");
const adminAuthEmail = document.querySelector("#adminAuthEmail");
const adminAuthPassword = document.querySelector("#adminAuthPassword");
const adminLoginButton = document.querySelector("#adminLoginButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");

const announcementAdminForm = document.querySelector("#announcementAdminForm");
const announcementAdminMeta = document.querySelector("#announcementAdminMeta");
const announcementAdminTitle = document.querySelector("#announcementAdminTitle");
const announcementAdminContent = document.querySelector("#announcementAdminContent");
const announcementAdminDownloadUrl = document.querySelector("#announcementAdminDownloadUrl");
const announcementAdminDownloadLabel = document.querySelector("#announcementAdminDownloadLabel");
const announcementAdminReload = document.querySelector("#announcementAdminReload");
const announcementAdminSave = document.querySelector("#announcementAdminSave");

const feedbackAdminPanel = document.querySelector("#feedbackAdminPanel");
const feedbackAdminMeta = document.querySelector("#feedbackAdminMeta");
const feedbackAdminReload = document.querySelector("#feedbackAdminReload");
const feedbackAdminList = document.querySelector("#feedbackAdminList");

renderAdminState();
initAdminSession();

adminAuthForm.addEventListener("submit", handleAdminLogin);
adminLogoutButton.addEventListener("click", handleAdminLogout);
announcementAdminReload.addEventListener("click", loadAnnouncement);
announcementAdminForm.addEventListener("submit", saveAnnouncement);
feedbackAdminReload?.addEventListener("click", loadFeedback);

function renderAdminState() {
  if (!supabaseReady) {
    adminAuthStatus.textContent = "未配置 Supabase，无法使用公告后台。";
    adminAuthForm.classList.add("is-auth-disabled");
    announcementAdminForm.hidden = true;
    feedbackAdminPanel.hidden = true;
    return;
  }

  adminAuthForm.classList.remove("is-auth-disabled");

  if (!currentUser) {
    adminAuthStatus.textContent = "请先登录管理员账号。";
    adminAuthEmail.readOnly = false;
    adminAuthPassword.readOnly = false;
    adminAuthPassword.placeholder = "密码";
    adminLoginButton.hidden = false;
    adminLogoutButton.hidden = true;
    announcementAdminForm.hidden = true;
    feedbackAdminPanel.hidden = true;
    return;
  }

  adminAuthEmail.value = currentUser.email || "";
  adminAuthEmail.readOnly = true;
  adminAuthPassword.readOnly = true;
  adminAuthPassword.value = "";
  adminAuthPassword.placeholder = "账号已登录";
  adminLoginButton.hidden = true;
  adminLogoutButton.hidden = false;

  if (!isAdmin) {
    adminAuthStatus.textContent = "当前账号已登录，但不是公告管理员。";
    announcementAdminForm.hidden = true;
    feedbackAdminPanel.hidden = true;
    return;
  }

  adminAuthStatus.textContent = `已登录管理员：${currentUser.email}`;
  announcementAdminForm.hidden = false;
  feedbackAdminPanel.hidden = false;
}

async function initAdminSession() {
  if (!supabaseClient) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  await applySession(sessionData.session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
}

async function applySession(session) {
  currentUser = session?.user || null;
  isAdmin = false;

  if (currentUser) {
    await refreshAdminState();
    if (isAdmin) {
      await Promise.all([loadAnnouncement(), loadFeedback()]);
    }
  }

  renderAdminState();
}

async function refreshAdminState() {
  if (!supabaseClient || !currentUser) {
    isAdmin = false;
    return;
  }

  try {
    const { data: row, error } = await supabaseClient
      .from("site_admins")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    isAdmin = Boolean(row);
  } catch {
    isAdmin = false;
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  if (!supabaseClient) return;

  const email = adminAuthEmail.value.trim();
  const password = adminAuthPassword.value.trim();

  if (!email || !password) {
    adminAuthStatus.textContent = "请输入邮箱和密码。";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    adminAuthStatus.textContent = error.message || "登录失败。";
    return;
  }

  adminAuthPassword.value = "";
}

async function handleAdminLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

async function loadAnnouncement() {
  if (!supabaseClient || !currentUser || !isAdmin) return;

  announcementAdminMeta.textContent = "正在读取公告...";

  const { data: row, error } = await supabaseClient
    .from("site_announcements")
    .select("id, title, content, download_url, download_label, updated_at")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    announcementAdminMeta.textContent = error.message || "读取公告失败。";
    return;
  }

  announcementId = row?.id || null;
  announcementAdminTitle.value = row?.title || "公告";
  announcementAdminContent.value = row?.content || "";
  announcementAdminDownloadUrl.value = row?.download_url || "";
  announcementAdminDownloadLabel.value = row?.download_label || "";
  announcementAdminMeta.textContent = row?.updated_at
    ? `最近更新：${new Date(row.updated_at).toLocaleString("zh-CN")}`
    : "当前还没有已发布公告，填写后可直接创建。";
}

async function saveAnnouncement(event) {
  event.preventDefault();
  if (!supabaseClient || !currentUser || !isAdmin) return;

  const title = announcementAdminTitle.value.trim() || "公告";
  const content = announcementAdminContent.value.trim();
  const downloadUrl = announcementAdminDownloadUrl.value.trim();
  const downloadLabel = announcementAdminDownloadLabel.value.trim();

  if (!content) {
    announcementAdminMeta.textContent = "公告正文不能为空。";
    return;
  }

  announcementAdminSave.disabled = true;
  announcementAdminMeta.textContent = "正在更新公告...";

  const payload = {
    title,
    content,
    download_url: downloadUrl || null,
    download_label: downloadUrl ? downloadLabel || "下载附件" : null,
    is_published: true,
    updated_at: new Date().toISOString(),
  };

  let error = null;

  if (announcementId) {
    ({ error } = await supabaseClient.from("site_announcements").update(payload).eq("id", announcementId));
  } else {
    ({ error } = await supabaseClient.from("site_announcements").insert(payload));
  }

  announcementAdminSave.disabled = false;

  if (error) {
    announcementAdminMeta.textContent = error.message || "公告更新失败。";
    return;
  }

  announcementAdminMeta.textContent = "公告已更新。";
  await loadAnnouncement();
}

async function loadFeedback() {
  if (!supabaseClient || !currentUser || !isAdmin) return;

  feedbackAdminMeta.textContent = "正在读取用户反馈...";

  const { data: rows, error } = await supabaseClient
    .from("site_feedback")
    .select("id, nickname, contact_email, content, status, source_page, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    feedbackAdminMeta.textContent = error.message || "读取反馈失败。";
    return;
  }

  renderFeedbackList(rows || []);
  feedbackAdminMeta.textContent = rows?.length
    ? `已加载 ${rows.length} 条反馈，最新内容显示在最上方。`
    : "暂时还没有用户反馈。";
}

function renderFeedbackList(rows) {
  if (!feedbackAdminList) return;

  feedbackAdminList.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "feedback-admin-empty";
    empty.textContent = "暂无用户反馈。";
    feedbackAdminList.append(empty);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "feedback-admin-item";

    const head = document.createElement("div");
    head.className = "feedback-admin-item-head";

    const authorWrap = document.createElement("div");
    authorWrap.className = "feedback-admin-author";

    const name = document.createElement("strong");
    name.textContent = row.nickname || row.contact_email || "匿名用户";

    const meta = document.createElement("p");
    meta.textContent = [row.contact_email || "", formatAdminTime(row.created_at)].filter(Boolean).join(" · ");

    const status = document.createElement("span");
    status.className = "feedback-admin-status";
    status.textContent = row.status || "new";

    authorWrap.append(name, meta);
    head.append(authorWrap, status);

    const content = document.createElement("p");
    content.className = "feedback-admin-content";
    content.textContent = row.content || "";

    item.append(head, content);

    if (row.source_page) {
      const source = document.createElement("a");
      source.className = "feedback-admin-source";
      source.href = row.source_page;
      source.target = "_blank";
      source.rel = "noreferrer noopener";
      source.textContent = "来源页面";
      item.append(source);
    }

    feedbackAdminList.append(item);
  });
}

function formatAdminTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN");
}
