const pageMeta = {
  dashboard: ["MAPI 总看板", "快速掌握渠道接入规模与同步异常"],
  account: ["新增同步账户", "普通运营可自助完成账户接入"],
  channel: ["新增渠道", "高级运营 / 产品配置媒体鉴权与拉取范围"],
};

const exceptions = [
  { channel: "百度搜索", id: "78392015", name: "有道词典-品牌01", diagnosis: "Access Token 已过期", state: "授权异常", type: "danger" },
  { channel: "百度搜索", id: "78392018", name: "翻译官-搜索02", diagnosis: "账户授权范围已失效", state: "授权异常", type: "danger" },
  { channel: "Bing", id: "184720553", name: "Dict_Search", diagnosis: "OAuth Token 失效", state: "授权异常", type: "danger" },
  { channel: "腾讯广告", id: "90883102", name: "翻译官-App", diagnosis: "接口返回权限不足", state: "待处理", type: "pending" },
];

const channelAuth = {
  baidu: { name: "百度搜索", fields: [["Access Token", "password"], ["API Key", "password"]] },
  "360": { name: "360 搜索", fields: [["Access Token", "password"], ["API Key", "password"]] },
  bing: { name: "Bing", fields: [["OAuth Token", "password"], ["Developer Token", "password"], ["Customer ID", "text"]] },
  tencent: { name: "腾讯广告", fields: [["Access Token", "password"]] },
  ocean: { name: "巨量引擎", fields: [["Access Token", "password"]] },
};

const metrics = ["曝光", "点击", "消费", "激活", "注册", "付费"];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showPage(page) {
  $$(".page").forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.panel === page));
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.page === page));
  [$("#pageTitle").textContent, $("#pageSubtitle").textContent] = pageMeta[page];
  $(".sidebar").classList.remove("is-open");
  updatePermissions();
}

function updatePermissions() {
  const advanced = $("#roleSelect").value === "advanced";
  $("#channelNav").disabled = !advanced;
  $("#channelNav").title = advanced ? "" : "请先切换为高级运营 / 产品";
  $("#permissionCard").classList.toggle("is-hidden", advanced);
  $("#advancedContent").classList.toggle("is-hidden", !advanced);
  if (!advanced) $("#mediaResult").classList.remove("is-visible");
}

function renderExceptions(filter = "all") {
  const data = filter === "all" ? exceptions : exceptions.filter((item) => item.channel === filter);
  $("#exceptionTable").innerHTML = data.map((item) => `
    <tr>
      <td>${item.channel}</td><td>${item.id}</td><td>${item.name}</td><td>${item.diagnosis}</td>
      <td><span class="status-pill ${item.type}">${item.state}</span></td>
      <td><button class="link-button repair-button" data-account="${item.name}">去处理</button></td>
    </tr>`).join("");
  $("#emptyState").style.display = data.length ? "none" : "block";
  $$(".repair-button").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.account}：已生成重新授权入口（演示）`)));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function renderMetrics() {
  $("#metricOptions").innerHTML = metrics.map((metric) => `<label><input type="checkbox" name="metrics" value="${metric}" />${metric}</label>`).join("");
}

function setDefaultDate() {
  const date = new Date();
  date.setDate(1);
  $("#startDate").value = date.toISOString().slice(0, 10);
}

function renderAuthFields(channelKey) {
  const config = channelAuth[channelKey];
  $("#authHint").textContent = config ? `已根据 ${config.name} 自动匹配鉴权字段` : "请先选择渠道";
  $("#authFields").innerHTML = config ? config.fields.map(([name, type]) => `
    <label><span>${name}</span><input type="${type}" data-auth required autocomplete="off" placeholder="请输入 ${name}" /></label>`).join("") : "";
}

$$('.nav-item').forEach((button) => button.addEventListener("click", () => {
  if (!button.disabled) showPage(button.dataset.page);
}));

$("#mobileMenu").addEventListener("click", () => $(".sidebar").classList.toggle("is-open"));
$("#roleSelect").addEventListener("change", updatePermissions);
$("#channelFilter").addEventListener("change", (event) => renderExceptions(event.target.value));
$("#refreshDashboard").addEventListener("click", () => showToast("看板数据已刷新（演示数据）"));
$("#expiredCard").addEventListener("click", () => $("#expiredTooltip").classList.toggle("is-visible"));

$("#accountForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedMetrics = $$('input[name="metrics"]:checked').map((input) => input.value);
  if (!selectedMetrics.length) return showToast("请至少选择一个指标");
  $("#accountResult").innerHTML = `<strong>账户配置校验通过</strong>渠道：${$("#opChannel").value}；账户 ID：${$("#accountId").value}；报表粒度：${$("#granularity").value}；指标：${selectedMetrics.join("、")}。<br />已模拟完成权限检查和真实试拉，正式接入后将创建历史补拉及每日同步任务。`;
  $("#accountResult").classList.add("is-visible");
  $("#accountResult").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

$("#advChannel").addEventListener("change", (event) => renderAuthFields(event.target.value));
$$('input[name="scope"]').forEach((radio) => radio.addEventListener("change", () => {
  const manager = $('input[name="scope"]:checked').value === "manager";
  $("#scopeLabel").innerHTML = `${manager ? "账户管家" : "广告账户"} ID <em>*</em>`;
  $("#scopeId").placeholder = `请输入${manager ? "账户管家" : "广告账户"} ID`;
}));

$("#channelForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const key = $("#advChannel").value;
  const manager = $('input[name="scope"]:checked').value === "manager";
  $("#mediaResult").innerHTML = `<strong>媒体连接成功</strong>${channelAuth[key].name}鉴权已通过；${manager ? "账户管家" : "广告账户"} ID：${$("#scopeId").value}；产品：${$("#product").value}。<br />已模拟获取媒体账户信息，当前渠道可以进入下一步报表配置。`;
  $("#mediaResult").classList.add("is-visible");
  $("#mediaResult").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

renderExceptions();
renderMetrics();
setDefaultDate();
updatePermissions();
