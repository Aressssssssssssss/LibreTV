/**
 * search.js — 高级卡片渲染增强版（保持原有 API，新增 UI 渲染辅助）
 * - 保留 searchByAPIAndKeyWord 原样返回列表（只“新增”规范化字段，不破坏原结构）
 * - 新增 renderSearchResults(results)：把结果渲染到 #results 网格中，并显示 #resultsArea
 * - 新增骨架屏、懒加载、图片代理回退、评分/清晰度/来源角标
 * - 点击卡片：优先调用 openDetailModal(item)，否则回退 fillAndSearch(item.norm_title)
 */

/* ===================== 工具函数 ===================== */
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pick(...candidates) {
  for (const v of candidates) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

/**
 * 规范化 VOD 条目（不修改原对象，仅新增 norm_* 字段）
 */
function normalizeVodItem(raw = {}) {
  const name = pick(raw.name, raw.vod_name, raw.title, raw.vod_title, raw.videoName);
  const cover = pick(raw.pic, raw.vod_pic, raw.cover, raw.image, raw.vod_pic_thumb);
  const year = pick(raw.year, raw.vod_year, raw.releaseyear);
  const remark = pick(raw.note, raw.vod_remarks, raw.remarks, raw.remark, raw.type_name, raw.category);
  const area = pick(raw.area, raw.vod_area, raw.region);
  const type = pick(raw.type, raw.type_name, raw.vod_class, raw.class);
  const score = pick(raw.score, raw.rating, raw.rate);
  const id = pick(raw.id, raw.vod_id, raw._id);

  return Object.assign({}, raw, {
    norm_title: name || "未知标题",
    norm_cover: cover || "",           // 可能为空，渲染时会有占位
    norm_year: year || "",
    norm_remark: remark || "",
    norm_area: area || "",
    norm_type: type || "",
    norm_score: score || "",
    norm_id: id || "",
  });
}

/* ===================== 图片懒加载（IntersectionObserver） ===================== */
const _AresTV_LazyPool = [];
let _AresTV_IO = null;
function ensureLazyObserver() {
  if (_AresTV_IO) return _AresTV_IO;
  if (!("IntersectionObserver" in window)) return null;
  _AresTV_IO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const dataSrc = img.getAttribute("data-src");
        if (dataSrc) {
          img.src = dataSrc;
          img.removeAttribute("data-src");
        }
        _AresTV_IO.unobserve(img);
      }
    });
  }, { rootMargin: "200px" });
  return _AresTV_IO;
}

function lazyLoad(img) {
  const io = ensureLazyObserver();
  if (io) io.observe(img);
  else if (img.dataset && img.dataset.src) {
    img.src = img.dataset.src; // 兼容不支持 IO 的环境
    img.removeAttribute("data-src");
  }
}

/* ===================== 骨架屏 ===================== */
function createResultSkeleton(count = 12) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const sk = document.createElement("div");
    sk.className = "animate-pulse border border-[#2a2d39] rounded-[14px] overflow-hidden bg-[rgba(255,255,255,.03)]";
    sk.innerHTML = `
      <div class="w-full aspect-[2/3] bg-[#111]"></div>
      <div class="p-3">
        <div class="h-4 bg-[#1b1e28] rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-[#1b1e28] rounded w-1/2"></div>
      </div>
    `;
    frag.appendChild(sk);
  }
  return frag;
}

/* ===================== 卡片模板 ===================== */
function buildSourceBadge(sourceName) {
  if (!sourceName) return "";
  return `<span class="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/70 border border-white/15">${escapeHTML(sourceName)}</span>`;
}
function buildScoreBadge(score) {
  if (!score) return "";
  return `<span class="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded bg-black/70"><span class="text-yellow-400">★</span> ${escapeHTML(score)}</span>`;
}
function buildRemarkBadge(remark) {
  if (!remark) return "";
  return `<span class="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded bg-black/70">${escapeHTML(remark)}</span>`;
}

function createResultCard(item) {
  const safeTitle = escapeHTML(item.norm_title);
  const cover = item.norm_cover;
  const proxiedCover = cover ? (typeof PROXY_URL !== "undefined" ? PROXY_URL + encodeURIComponent(cover) : cover) : "";
  const container = document.createElement("div");

  container.className =
    "group transition-all duration-300 border border-[#2a2d39] hover:border-white/20 rounded-[14px] overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,.03),rgba(0,0,0,.03))] hover:translate-y-[-2px] hover:shadow-[0_14px_26px_rgba(0,0,0,.35)]";
  container.setAttribute("role", "button");
  container.setAttribute("tabindex", "0");
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter") container.click();
  });

  const handleClick = () => {
    if (typeof openDetailModal === "function") {
      openDetailModal(item); // 你的详情弹窗逻辑
    } else if (typeof fillAndSearch === "function") {
      fillAndSearch(item.norm_title); // 回退：直接发起搜索
    } else if (typeof fillAndSearchWithDouban === "function") {
      fillAndSearchWithDouban(item.norm_title); // 进一步回退
    }
  };

  const coverHtml = cover
    ? `
      <img data-src="${cover}"
           alt="${safeTitle}"
           class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
           onerror="this.onerror=null; this.src='${proxiedCover}'; this.classList.add('object-contain');"
           loading="lazy" referrerpolicy="no-referrer">
    `
    : `
      <div class="w-full h-full flex items-center justify-center text-sm text-gray-400 select-none">
        无封面
      </div>
    `;

  container.innerHTML = `
    <div class="relative w-full aspect-[2/3] overflow-hidden cursor-pointer" aria-label="${safeTitle}">
      ${buildSourceBadge(item.source_name)}
      ${buildScoreBadge(item.norm_score)}
      ${buildRemarkBadge(item.norm_remark || item.norm_type)}
      ${coverHtml}
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 pointer-events-none"></div>
    </div>
    <div class="p-3">
      <div class="flex items-center justify-between mb-1">
        <button class="text-sm font-semibold text-white hover:text-pink-400 transition truncate" title="${safeTitle}">${safeTitle}</button>
        ${item.norm_year ? `<span class="text-[11px] text-gray-400 ml-2 flex-shrink-0">${escapeHTML(item.norm_year)}</span>` : ""}
      </div>
      <div class="text-[11px] text-gray-400 truncate">
        ${escapeHTML(item.norm_type || item.norm_area || "")}
      </div>
    </div>
  `;

  // 绑定点击
  container.querySelector("button").addEventListener("click", (e) => {
    e.stopPropagation();
    handleClick();
  });
  container.addEventListener("click", handleClick);

  // 懒加载
  const img = container.querySelector("img[data-src]");
  if (img) lazyLoad(img);

  return container;
}

/* ===================== 公开渲染函数 ===================== */
function renderSearchResults(results = []) {
  const area = document.getElementById("resultsArea");
  const grid = document.getElementById("results");
  const counter = document.getElementById("searchResultsCount");
  if (!area || !grid) return;

  // 切换区域显示
  area.classList.remove("hidden");
  const doubanArea = document.getElementById("doubanArea");
  if (doubanArea) doubanArea.classList.add("hidden");

  // 清空并显示骨架
  grid.innerHTML = "";
  grid.appendChild(createResultSkeleton(Math.min(12, Math.max(8, results.length || 12))));

  // 规范化 + 渲染
  const normalized = results.map(normalizeVodItem);
  const frag = document.createDocumentFragment();
  normalized.forEach((item) => {
    frag.appendChild(createResultCard(item));
  });

  // 替换骨架
  grid.innerHTML = "";
  grid.appendChild(frag);
  if (counter) counter.textContent = String(normalized.length);
}

/* ===================== 对外暴露（可从其它模块复用） ===================== */
window.AresTVSearchUI = Object.assign(window.AresTVSearchUI || {}, {
  renderSearchResults,
  createResultCard,
  normalizeVodItem,
});

/* ===================== 你给的原始函数：仅在内部“新增字段”，不改变返回结构 ===================== */
async function searchByAPIAndKeyWord(apiId, query) {
  try {
    let apiUrl, apiName, apiBaseUrl;

    // 处理自定义API
    if (apiId.startsWith('custom_')) {
      const customIndex = apiId.replace('custom_', '');
      const customApi = getCustomApiInfo(customIndex);
      if (!customApi) return [];

      apiBaseUrl = customApi.url;
      apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
      apiName = customApi.name;
    } else {
      // 内置API
      if (!API_SITES[apiId]) return [];
      apiBaseUrl = API_SITES[apiId].api;
      apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
      apiName = API_SITES[apiId].name;
    }

    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // 添加鉴权参数到代理URL
    const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ?
      await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
      PROXY_URL + encodeURIComponent(apiUrl);

    const response = await fetch(proxiedUrl, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return [];
    }

    // 处理第一页结果 + 轻量规范化
    const results = data.list.map(item => {
      const enriched = {
        ...item,
        source_name: apiName,
        source_code: apiId,
        api_url: apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
      };
      return normalizeVodItem(enriched);
    });

    // 获取总页数
    const pageCount = data.pagecount || 1;
    const pagesToFetch = Math.min(pageCount - 1, API_CONFIG.search.maxPages - 1);

    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl = apiBaseUrl + API_CONFIG.search.pagePath
          .replace('{query}', encodeURIComponent(query))
          .replace('{page}', page);

        const pagePromise = (async () => {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(() => pageController.abort(), 15000);

            const proxiedPageUrl = await window.ProxyAuth?.addAuthToProxyUrl ?
              await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(pageUrl)) :
              PROXY_URL + encodeURIComponent(pageUrl);

            const pageResponse = await fetch(proxiedPageUrl, {
              headers: API_CONFIG.search.headers,
              signal: pageController.signal
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) return [];

            const pageData = await pageResponse.json();

            if (!pageData || !pageData.list || !Array.isArray(pageData.list)) return [];

            return pageData.list.map(item => normalizeVodItem({
              ...item,
              source_name: apiName,
              source_code: apiId,
              api_url: apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
            }));
          } catch (error) {
            console.warn(`API ${apiId} 第${page}页搜索失败:`, error);
            return [];
          }
        })();

        additionalPagePromises.push(pagePromise);
      }

      const additionalResults = await Promise.all(additionalPagePromises);
      additionalResults.forEach(pageResults => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      });
    }

    return results;
  } catch (error) {
    console.warn(`API ${apiId} 搜索失败:`, error);
    return [];
  }
}
