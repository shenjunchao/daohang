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

const resetPasswordForm = document.querySelector("#resetPasswordForm");
const resetPasswordStatus = document.querySelector("#resetPasswordStatus");
const newPassword = document.querySelector("#newPassword");
const confirmPassword = document.querySelector("#confirmPassword");
const resetPasswordSubmit = document.querySelector("#resetPasswordSubmit");
const passwordToggles = document.querySelectorAll(".password-toggle");

resetPasswordForm.addEventListener("submit", handleResetPassword);
passwordToggles.forEach((button) => {
  button.addEventListener("click", () => togglePassword(button));
});

if (!supabaseReady) {
  resetPasswordStatus.textContent = "未配置 Supabase，无法重置密码。";
}

async function handleResetPassword(event) {
  event.preventDefault();
  if (!supabaseClient) return;

  const password = newPassword.value.trim();
  const confirm = confirmPassword.value.trim();

  if (!password || !confirm) {
    resetPasswordStatus.textContent = "请输入并确认新密码。";
    return;
  }

  if (password.length < 8) {
    resetPasswordStatus.textContent = "新密码长度不能少于 8 位。";
    return;
  }

  if (password !== confirm) {
    resetPasswordStatus.textContent = "两次输入的新密码不一致。";
    return;
  }

  resetPasswordSubmit.disabled = true;
  resetPasswordStatus.textContent = "正在更新密码...";

  const { error } = await supabaseClient.auth.updateUser({ password });

  resetPasswordSubmit.disabled = false;

  if (error) {
    resetPasswordStatus.textContent = error.message || "密码更新失败，请重新打开邮件里的链接后再试。";
    return;
  }

  newPassword.value = "";
  confirmPassword.value = "";
  resetPasswordStatus.textContent = "密码已更新成功。你现在可以返回首页重新登录。";
}

function togglePassword(button) {
  const targetId = button.dataset.target;
  const input = document.getElementById(targetId);
  if (!input) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.textContent = isPassword ? "🙈" : "👁";
}
