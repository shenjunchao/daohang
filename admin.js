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
const announcementAdminReload = document.querySelector("#announcementAdminReload");
const announcementAdminSave = document.querySelector("#announcementAdminSave");

renderAdminState();
initAdminSession();

adminAuthForm.addEventListener("submit", handleAdminLogin);
adminLogoutButton.addEventListener("click", handleAdminLogout);
announcementAdminReload.addEventListener("click", loadAnnouncement);
announcementAdminForm.addEventListener("submit", saveAnnouncement);

function renderAdminState() {
  if (!supabaseReady) {
    adminAuthStatus.textContent = "未配置 Supabase，无法使用公告后台。";
    adminAuthForm.classList.add("is-auth-disabled");
    announcementAdminForm.hidden = true;
    return;
  }

  adminAuthForm.classList.remove("is-auth-disabled");

  if (!currentUser) {
    adminAuthStatus.textContent = "请先登录管理员账号。";
    adminAuthEmail.readOnly = false;
    adminAuthPassword.readOnly = false;
    adminLoginButton.hidden = false;
    adminLogoutButton.hidden = true;
    announcementAdminForm.hidden = true;
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
    return;
  }

  adminAuthStatus.textContent = `已登录管理员：${currentUser.email}`;
  announcementAdminForm.hidden = false;
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
      await loadAnnouncement();
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
    .select("id, title, content, updated_at")
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
  announcementAdminMeta.textContent = row?.updated_at
    ? `最近更新：${new Date(row.updated_at).toLocaleString("zh-CN")}`
    : "当前还没有已发布公告，填写后可直接创建。";
}

async function saveAnnouncement(event) {
  event.preventDefault();
  if (!supabaseClient || !currentUser || !isAdmin) return;

  const title = announcementAdminTitle.value.trim() || "公告";
  const content = announcementAdminContent.value.trim();
  if (!content) {
    announcementAdminMeta.textContent = "公告正文不能为空。";
    return;
  }

  announcementAdminSave.disabled = true;
  announcementAdminMeta.textContent = "正在更新公告...";

  const payload = {
    title,
    content,
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
