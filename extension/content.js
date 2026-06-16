(() => {
  // src/core/commands.mjs
  var REMOVE_INTENT_RE = /删除|删掉|去掉|去除|取消|不要|移除|清除|无/;
  var COLOR_MAP = {
    \u84DD: "#3370ff",
    \u84DD\u8272: "#3370ff",
    \u6D45\u84DD: "#e1eaff",
    \u7EFF: "#34c724",
    \u7EFF\u8272: "#34c724",
    \u7EA2: "#f54a45",
    \u7EA2\u8272: "#f54a45",
    \u6A59: "#ff7d00",
    \u6A59\u8272: "#ff7d00",
    \u7D2B: "#7b61ff",
    \u7D2B\u8272: "#7b61ff",
    \u9ED1: "#1f2329",
    \u9ED1\u8272: "#1f2329",
    \u7EAF\u9ED1: "#000000",
    \u767D: "#ffffff",
    \u767D\u8272: "#ffffff",
    \u7EAF\u767D: "#ffffff",
    \u7070: "#f0f1f5",
    \u7070\u8272: "#f0f1f5",
    \u6D45\u7070: "#f6f6fb"
  };
  function getColorFromCommand(command) {
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (command.includes(key)) return value;
    }
    return command.match(/#[0-9a-fA-F]{3,8}/)?.[0];
  }
  function hasLayoutIntent(command) {
    return /高度|宽度|铺满|撑满|满屏|全屏|网页|页面|屏幕|自适应/.test(command);
  }
  function hasPageSizeIntent(command) {
    return /网页高度|页面高度|屏幕高度|满屏|全屏|铺满.*(页面|网页|屏幕)|撑满.*(页面|网页|屏幕)|适配.*(页面|网页|屏幕)/.test(command);
  }
  function extractQuotedText(command) {
    return command.match(/[“"]([^”"]+)[”"]/)?.[1] || command.match(/[改换](?:成|为)(.+)$/)?.[1]?.trim();
  }
  function hasTextStyleIntent(command) {
    return /文字颜色|字体颜色|字色|文字(?:改|变|换|设)?(?:为|成)?(?:蓝|绿|红|橙|紫|黑|白|灰|#)|(?:^|[，,；;])字(?:改|变|换|设)?(?:为|成)?(?:蓝|绿|红|橙|紫|黑|白|灰|#)|(?:蓝|绿|红|橙|紫|黑|白|灰)色?字|颜色(?:改|变|换|设)(?:为|成)/.test(command);
  }
  function hasBackgroundIntent(command) {
    if (/^颜色/.test(command)) return false;
    return /背景色?|底色|填充色|(?:蓝|绿|红|橙|紫|黑|白|灰|浅灰|纯白|纯黑)底|按钮(?:改|变|换|设)(?:为|成)|(?:变|改成?|换成?)(?:蓝|绿|红|橙|紫|黑|白|灰)色?(?:按钮|背景|底)?/.test(command);
  }
  function hasTextColorIntent(command) {
    return /(?:文字|字体?|文本).*(?:蓝|绿|红|橙|紫|黑|白|灰|#[0-9a-fA-F])|(?:蓝|绿|红|橙|紫|黑|白|灰)(?:色)?字|颜色(?:改|换|设)(?:为|成)/.test(command);
  }
  function hasTextContentIntent(command) {
    if (hasTextColorIntent(command)) return false;
    if (hasBackgroundIntent(command)) return false;
    return command.includes("\u6587\u6848") || command.includes("\u6587\u5B57") && !hasTextStyleIntent(command);
  }
  function hasGlassIntent(command) {
    return /磨砂|毛玻璃|玻璃|半透明/.test(command);
  }
  function hasRemoveIntent(command) {
    return REMOVE_INTENT_RE.test(command);
  }
  function hasRemoveGlassIntent(command) {
    return /(删除|删掉|去掉|去除|取消|不要|移除|清除|无)(?:这个|这种|该)?(磨砂|毛玻璃|玻璃|半透明)|(磨砂|毛玻璃|玻璃|半透明)(?:效果)?(删除|删掉|去掉|去除|取消|移除|清除)/.test(command);
  }
  function getGlassBackground(command) {
    if (/黑|深色/.test(command)) return "rgba(31, 35, 41, 0.58)";
    if (/蓝/.test(command)) return "rgba(51, 112, 255, 0.18)";
    if (/灰/.test(command)) return "rgba(246, 246, 251, 0.72)";
    return "rgba(255, 255, 255, 0.72)";
  }
  function extractCssSize(command, axis) {
    const match = command.match(new RegExp(`${axis}[^0-9]*(\\d+(?:\\.\\d+)?)(px|%|vh|vw|rem|em)?`));
    if (!match) return void 0;
    return `${match[1]}${match[2] || "px"}`;
  }
  function extractTextColor(command) {
    const afterText = command.match(/(?:文字|字体?|文本)(?:颜色)?(?:改|变|换|设)?(?:为|成)?(.+?)(?:[，,;；]|$)/);
    if (afterText) {
      const c = getColorFromCommand(afterText[1]);
      if (c) return c;
    }
    const beforeText = command.match(/(蓝|绿|红|橙|紫|黑|白|灰|浅蓝|浅灰|纯白|纯黑)色?字/);
    if (beforeText) return getColorFromCommand(beforeText[1]);
    const colorIntent = command.match(/颜色(?:改|变|换|设)(?:为|成)(.+?)(?:[，,;；]|$)/);
    if (colorIntent) return getColorFromCommand(colorIntent[1]);
    return null;
  }
  function extractBgColor(command) {
    const bgPart = command.match(/(?:底色|背景色?|填充色)(?:改|变|换|设)?(?:为|成)?(.+?)(?:[，,;；]|$)/);
    if (bgPart) {
      const c = getColorFromCommand(bgPart[1]);
      if (c) return c;
    }
    const prefix = command.match(/(蓝|绿|红|橙|紫|黑|白|灰|浅蓝|浅灰|纯白|纯黑)底/);
    if (prefix) return getColorFromCommand(prefix[1]);
    const btnPart = command.match(/按钮(?:改|变|换|设)?(?:为|成)?(.+?)(?:[，,;；]|$)/);
    if (btnPart) return getColorFromCommand(btnPart[1]);
    return null;
  }
  function applyVisualStyleCommand(command, style) {
    const color = getColorFromCommand(command);
    const remove = hasRemoveIntent(command);
    if (hasBackgroundIntent(command)) {
      if (remove || /透明/.test(command) && !/不是透明/.test(command)) {
        style.backgroundColor = "transparent";
      } else {
        const bgColor = extractBgColor(command) || color;
        if (bgColor) style.backgroundColor = bgColor;
      }
    }
    if (hasTextStyleIntent(command)) {
      const textColor = extractTextColor(command) || color;
      if (textColor) style.color = textColor;
    }
    if (/边框/.test(command)) {
      style.border = remove ? "0" : `1px solid ${color || "#3370ff"}`;
    }
    if (/阴影|投影|shadow/i.test(command)) {
      style.boxShadow = remove ? "none" : "0 18px 48px rgba(31, 35, 41, 0.12)";
    }
    if (hasGlassIntent(command) && !hasRemoveGlassIntent(command)) {
      style.backgroundColor = getGlassBackground(command);
      style.backdropFilter = "blur(18px) saturate(160%)";
      style.WebkitBackdropFilter = "blur(18px) saturate(160%)";
      style.border = /不要边框|无边框|删除边框|去掉边框/.test(command) ? "0" : "1px solid rgba(255, 255, 255, 0.55)";
      style.boxShadow = /不要阴影|无阴影|删除阴影|去掉阴影|取消阴影/.test(command) ? "none" : "0 18px 48px rgba(31, 35, 41, 0.12)";
    }
    if (/透明/.test(command) && !/半透明|磨砂|毛玻璃|玻璃|不是透明|不透明/.test(command)) {
      style.backgroundColor = "transparent";
      style.boxShadow = "none";
    }
    if (/不透明/.test(command) && !hasGlassIntent(command)) {
      style.opacity = "1";
    }
  }
  function parseVisualCommand(command) {
    const input = command.trim();
    const style = {};
    let text;
    let hidden;
    if (!input) return { style };
    if (input.includes("\u9690\u85CF")) hidden = true;
    if (input.includes("\u663E\u793A")) hidden = false;
    if (/^(删除|删掉|去掉|移除)(这个|该|此)?(元素|模块|组件|板块|区块)?$/.test(input) || input === "\u5220\u9664") hidden = true;
    if (input.includes("\u52A0\u7C97")) style.fontWeight = "700";
    if (input.includes("\u53D6\u6D88\u52A0\u7C97")) style.fontWeight = "400";
    if (input.includes("\u5C45\u4E2D")) style.textAlign = "center";
    if (input.includes("\u5DE6\u5BF9\u9F50")) style.textAlign = "left";
    if (input.includes("\u53F3\u5BF9\u9F50")) style.textAlign = "right";
    if (input.includes("\u5706\u89D2")) style.borderRadius = input.includes("\u66F4") ? "24px" : "12px";
    if (input.includes("\u653E\u5927")) {
      style.transform = "scale(1.06)";
      style.transformOrigin = "center";
    }
    if (input.includes("\u7F29\u5C0F")) {
      style.transform = "scale(0.94)";
      style.transformOrigin = "center";
    }
    applyVisualStyleCommand(input, style);
    if (input.includes("\u9AD8\u5EA6")) {
      const height = extractCssSize(input, "\u9AD8\u5EA6");
      if (height) {
        style.minHeight = height;
      } else if (hasPageSizeIntent(input)) {
        style.minHeight = "100vh";
      } else if (input.includes("\u81EA\u9002\u5E94") || input.includes("\u9002\u914D")) {
        style.height = "auto";
      }
    }
    if (input.includes("\u5BBD\u5EA6")) {
      const width = extractCssSize(input, "\u5BBD\u5EA6");
      if (width) {
        style.width = width;
      } else if (input.includes("\u94FA\u6EE1") || input.includes("\u6491\u6EE1") || input.includes("\u6EE1")) {
        style.width = "100%";
      } else if (input.includes("\u81EA\u9002\u5E94") || input.includes("\u9002\u914D")) {
        style.width = "auto";
      }
    }
    if (input.includes("\u94FA\u6EE1\u5C4F\u5E55") || input.includes("\u6491\u6EE1\u5C4F\u5E55") || input.includes("\u5168\u5C4F") || input.includes("\u6EE1\u5C4F")) {
      style.minHeight = "100vh";
      style.width = "100%";
    }
    if (input.includes("\u5185\u5BB9\u4E0A\u4E0B\u5C45\u4E2D") || input.includes("\u5782\u76F4\u5C45\u4E2D") || input.includes("\u4E0A\u4E0B\u5C45\u4E2D")) {
      style.display = "flex";
      style.flexDirection = "column";
      style.justifyContent = "center";
    }
    if (input.includes("\u5185\u5BB9\u5DE6\u53F3\u5C45\u4E2D") || input.includes("\u6C34\u5E73\u5C45\u4E2D")) {
      style.display = "flex";
      style.alignItems = "center";
    }
    const spacingMatch = input.match(/(padding|margin|内边距|外边距|内间距|外间距).*?(上|下|左|右|top|bottom|left|right)?.*?(?:增加|加|设为|改为|设置为?)?.*?(\d+)\s*(px|%|rem|em)?/i);
    if (spacingMatch) {
      const propBase = /margin|外/.test(spacingMatch[1]) ? "margin" : "padding";
      const dirMap = { "\u4E0A": "Top", "\u4E0B": "Bottom", "\u5DE6": "Left", "\u53F3": "Right", "top": "Top", "bottom": "Bottom", "left": "Left", "right": "Right" };
      const dir = spacingMatch[2] ? dirMap[spacingMatch[2].toLowerCase()] || "" : "";
      const value = `${spacingMatch[3]}${spacingMatch[4] || "px"}`;
      style[`${propBase}${dir}`] = value;
    }
    const cssPropMatch = input.match(/([a-zA-Z-]+)\s*[:：]?\s*(?:改为|设为|改成|设置为?)?\s*(\d+(?:\.\d+)?\s*(?:px|%|rem|em|vh|vw)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/i);
    if (cssPropMatch && Object.keys(style).length === 0) {
      const rawProp = cssPropMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const validProps = ["fontSize", "lineHeight", "letterSpacing", "fontWeight", "opacity", "gap", "borderRadius", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "marginTop", "marginBottom", "marginLeft", "marginRight"];
      if (validProps.includes(rawProp) || rawProp.startsWith("padding") || rawProp.startsWith("margin")) {
        style[rawProp] = cssPropMatch[2].trim();
      }
    }
    const hasStyleIntent = Object.keys(style).length > 0 || hidden !== void 0;
    if (hasTextContentIntent(input) || !hasStyleIntent && !hasLayoutIntent(input) && (input.includes("\u6539\u6210") || input.includes("\u6539\u4E3A") || input.includes("\u6362\u6210") || input.includes("\u6362\u4E3A"))) {
      text = extractQuotedText(input);
    }
    let order;
    if (/移动?到最后|放到最后|排到最后|移到末尾|移动?到后面|排最后|最后面/.test(input)) order = "last";
    else if (/移动?到最前|放到最前|排到最前|移到开头|移动?到前面|排最前|最前面/.test(input)) order = "first";
    else if (/往?下移动?|向下移动?|下移|往后移/.test(input)) order = "down";
    else if (/往?上移动?|向上移动?|上移|往前移/.test(input)) order = "up";
    let insert;
    const insertMatch = input.match(/(?:增加|添加|新增|加上|加一个|插入)(?:一个)?["""]?(.+?)["""]?$/);
    if (insertMatch && !hasStyleIntent) {
      insert = insertMatch[1].trim();
    }
    return { style, text, hidden, order, insert };
  }
  function isParsedCommandEmpty(parsed) {
    return Object.keys(parsed.style || {}).length === 0 && parsed.text === void 0 && parsed.hidden === void 0 && parsed.order === void 0 && parsed.insert === void 0;
  }

  // src/core/selectors.mjs
  function cssEscape(value) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\#.;?+*~':"!^$[\]()=>|/@]/g, "\\$&");
  }
  function getElementLabel(element) {
    const text = element.innerText?.trim().replace(/\s+/g, " ");
    if (text) return text.slice(0, 80);
    return element.getAttribute("aria-label") || element.getAttribute("title") || element.tagName.toLowerCase();
  }
  function getElementSelector(element) {
    const visualId = element.getAttribute("data-ce-id");
    if (visualId) return `[data-ce-id="${cssEscape(visualId)}"]`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${cssEscape(testId)}"]`;
    const id = element.getAttribute("id");
    if (id) return `#${cssEscape(id)}`;
    const parts = [];
    let current = element;
    while (current && current.tagName !== "BODY") {
      const parent = current.parentElement;
      if (!parent) break;
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
      current = parent;
    }
    return `body > ${parts.join(" > ")}`;
  }
  function getSourceHint(element) {
    const source = element.getAttribute("data-ce-source");
    const sourceId = element.getAttribute("data-ce-id");
    if (!source && !sourceId) return void 0;
    return {
      file: source || void 0,
      id: sourceId || void 0,
      originalText: element.innerText?.trim() || void 0
    };
  }

  // src/core/edits.mjs
  var STORAGE_KEY = "click-edit-edits-v1";
  function toCssPropertyName(key) {
    return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
  function getCurrentPath() {
    return typeof window === "undefined" ? "/" : window.location.pathname;
  }
  function recordMatchesPath(record, path) {
    return !record.path || record.path === path;
  }
  function captureBeforeSnapshot(element, parsed) {
    const style = {};
    for (const key of Object.keys(parsed.style || {})) {
      style[key] = element.style.getPropertyValue(toCssPropertyName(key));
    }
    let orderIndex;
    if (parsed.order && element.parentElement) {
      orderIndex = Array.from(element.parentElement.children).indexOf(element);
    }
    return {
      text: parsed.text !== void 0 ? element.innerText : void 0,
      html: parsed.text !== void 0 ? element.innerHTML : void 0,
      display: parsed.hidden !== void 0 ? element.style.display : void 0,
      orderIndex,
      style
    };
  }
  function createEditRecord({ element, command, parsed, path = getCurrentPath() }) {
    return {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      path,
      selector: getElementSelector(element),
      label: getElementLabel(element),
      command,
      text: parsed.text,
      hidden: parsed.hidden,
      order: parsed.order,
      insert: parsed.insert,
      style: parsed.style,
      before: captureBeforeSnapshot(element, parsed),
      source: getSourceHint(element),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function applyEdit(record, root = document) {
    if (record.path && record.path !== getCurrentPath()) return false;
    const element = root.querySelector(record.selector);
    if (!element) return false;
    if (record.insert) {
      const sibling = element.previousElementSibling || element.nextElementSibling || element;
      const clone = sibling.cloneNode(true);
      clone.removeAttribute("id");
      clone.setAttribute("data-ce-inserted", record.id);
      const textNode = clone.querySelector("span, a, p, h1, h2, h3, h4, h5, h6, li, label, div");
      if (textNode) {
        textNode.textContent = record.insert;
      } else {
        clone.lastChild ? clone.lastChild.textContent = record.insert : clone.textContent = record.insert;
      }
      element.after(clone);
    }
    if (record.text !== void 0) {
      element.innerText = record.text;
    }
    if (record.order && element.parentElement) {
      const parent = element.parentElement;
      if (record.order === "last") {
        parent.appendChild(element);
      } else if (record.order === "first") {
        parent.prepend(element);
      } else if (record.order === "down") {
        const next = element.nextElementSibling;
        if (next) next.after(element);
      } else if (record.order === "up") {
        const prev = element.previousElementSibling;
        if (prev) prev.before(element);
      }
    }
    if (record.hidden !== void 0) {
      element.style.display = record.hidden ? "none" : "";
    }
    for (const [key, value] of Object.entries(record.style || {})) {
      if (value === void 0) continue;
      const property = toCssPropertyName(key);
      if (value === "") {
        element.style.removeProperty(property);
      } else {
        element.style.setProperty(property, value);
      }
    }
    return true;
  }
  function revertEdit(record, root = document) {
    if (record.path && record.path !== getCurrentPath()) return false;
    const element = root.querySelector(record.selector);
    if (!element || !record.before) return false;
    if (record.insert) {
      const inserted = root.querySelector(`[data-ce-inserted="${record.id}"]`);
      if (inserted) inserted.remove();
      return true;
    }
    if (record.before.html !== void 0) {
      element.innerHTML = record.before.html;
    } else if (record.before.text !== void 0) {
      element.innerText = record.before.text;
    }
    if (record.before.orderIndex !== void 0 && element.parentElement) {
      const parent = element.parentElement;
      const children = Array.from(parent.children);
      if (record.before.orderIndex >= children.length) {
        parent.appendChild(element);
      } else {
        const ref = children.filter((c) => c !== element)[record.before.orderIndex];
        if (ref) parent.insertBefore(element, ref);
        else parent.appendChild(element);
      }
    }
    if (record.before.display !== void 0) {
      element.style.display = record.before.display;
    }
    for (const [key, value] of Object.entries(record.before.style || {})) {
      const property = toCssPropertyName(key);
      if (value) {
        element.style.setProperty(property, value);
      } else {
        element.style.removeProperty(property);
      }
    }
    return true;
  }
  function readStoredEdits() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function readStoredEditsForPath(path = getCurrentPath()) {
    return readStoredEdits().filter((record) => recordMatchesPath(record, path));
  }
  function writeStoredEdits(records) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records, null, 2));
  }
  function saveEdit(record) {
    const records = readStoredEdits();
    records.push(record);
    writeStoredEdits(records);
    return records;
  }
  function markExported(path = getCurrentPath(), exportedAt = (/* @__PURE__ */ new Date()).toISOString()) {
    const records = readStoredEdits();
    let dirty = false;
    for (const record of records) {
      if (!recordMatchesPath(record, path)) continue;
      if (!record.exportedAt) {
        record.exportedAt = exportedAt;
        dirty = true;
      }
    }
    if (dirty) writeStoredEdits(records);
    return records;
  }
  function undoLastEdit(root = document) {
    const records = readStoredEdits();
    const path = getCurrentPath();
    let index = -1;
    for (let cursor = records.length - 1; cursor >= 0; cursor -= 1) {
      if (recordMatchesPath(records[cursor], path)) {
        index = cursor;
        break;
      }
    }
    if (index === -1) return void 0;
    const record = records[index];
    if (!revertEdit(record, root)) return void 0;
    records.splice(index, 1);
    writeStoredEdits(records);
    return record;
  }
  function undoToEdit(editId, root = document) {
    const records = readStoredEdits();
    const path = getCurrentPath();
    const targetIndex = records.findIndex((record) => record.id === editId && recordMatchesPath(record, path));
    if (targetIndex === -1) return [];
    const candidates = [];
    for (let index = records.length - 1; index >= targetIndex; index -= 1) {
      const record = records[index];
      if (!recordMatchesPath(record, path)) continue;
      if (!record.before || !root.querySelector(record.selector)) return [];
      candidates.push({ index, record });
    }
    for (const { record } of candidates) {
      if (!revertEdit(record, root)) return [];
    }
    const indicesToRemove = candidates.map((c) => c.index).sort((a, b) => b - a);
    for (const index of indicesToRemove) {
      records.splice(index, 1);
    }
    writeStoredEdits(records);
    return candidates.map((item) => item.record);
  }

  // src/core/computed-style.mjs
  function toCssPropertyName2(key) {
    return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
  function rgbToHex(rgb) {
    if (!rgb || rgb === "transparent") return "";
    if (rgb.startsWith("#")) return rgb;
    const match = rgb.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return rgb;
    const [, r, g, b] = match;
    return "#" + [r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  }
  function parseNumericValue(value) {
    if (!value || value === "auto" || value === "none") return { number: "", unit: "" };
    const match = String(value).match(/^(-?[\d.]+)(px|%|em|rem|vh|vw)?$/);
    if (!match) return { number: "", unit: "" };
    return { number: match[1], unit: match[2] || "px" };
  }
  function readCurrentStyles(element, properties) {
    const computed = window.getComputedStyle(element);
    const result = {};
    for (const property of properties) {
      const cssProperty = toCssPropertyName2(property);
      const inlineValue = element.style.getPropertyValue(cssProperty);
      if (inlineValue) {
        result[property] = inlineValue;
      } else {
        result[property] = computed.getPropertyValue(cssProperty);
      }
    }
    return result;
  }
  var STYLE_PROPERTIES = [
    "backgroundColor",
    "color",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "borderWidth",
    "borderColor",
    "borderRadius",
    "fontSize",
    "fontWeight",
    "textAlign",
    "width",
    "height",
    "display",
    "flexDirection",
    "justifyContent",
    "alignItems",
    "boxShadow",
    "opacity"
  ];
  function readAllStyles(element) {
    return readCurrentStyles(element, STYLE_PROPERTIES);
  }

  // src/runtime/properties-panel.mjs
  function getPropertiesPanelStyles() {
    return `
    .tabs { display: flex; gap: 4px; padding: 0 16px; margin-top: 12px; }
    .tab {
      flex: 1;
      border: 0;
      border-radius: 8px;
      padding: 8px 0;
      font: 600 12px/1 inherit;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .tab--active { color: #fff; background: #3370ff; }
    .tab--inactive { color: #646a73; background: #f0f1f5; }

    .props-scroll { max-height: 50vh; overflow-y: auto; padding: 12px 16px; }

    .group { margin-bottom: 8px; }
    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0;
      cursor: pointer;
      font: 600 12px/1 inherit;
      color: #1f2329;
      user-select: none;
    }
    .group-header:hover { color: #3370ff; }
    .group-arrow { font-size: 10px; transition: transform .15s; width: 12px; }
    .group-arrow--open { transform: rotate(90deg); }
    .group-body { display: none; padding: 4px 0 8px 18px; }
    .group-body--open { display: block; }

    .prop-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .prop-label { width: 56px; flex-shrink: 0; font-size: 11px; color: #646a73; }

    .prop-color-wrap { display: flex; align-items: center; gap: 6px; flex: 1; }
    .prop-color-input {
      width: 28px; height: 28px;
      border: 1px solid #dee0e3;
      border-radius: 6px;
      padding: 2px;
      cursor: pointer;
      background: none;
    }
    .prop-hex-input {
      flex: 1;
      border: 1px solid #dee0e3;
      border-radius: 8px;
      padding: 6px 8px;
      font: 12px/1 monospace;
      color: #1f2329;
      outline: none;
    }
    .prop-hex-input:focus { border-color: #3370ff; }

    .prop-number-wrap { display: flex; align-items: center; gap: 4px; flex: 1; }
    .prop-number-input {
      width: 52px;
      border: 1px solid #dee0e3;
      border-radius: 8px;
      padding: 6px 8px;
      font: 12px/1 inherit;
      color: #1f2329;
      outline: none;
      text-align: center;
    }
    .prop-number-input:focus { border-color: #3370ff; }
    .prop-unit-select {
      border: 1px solid #dee0e3;
      border-radius: 8px;
      padding: 5px 4px;
      font: 11px/1 inherit;
      color: #646a73;
      outline: none;
      background: #fff;
    }

    .prop-select {
      flex: 1;
      border: 1px solid #dee0e3;
      border-radius: 8px;
      padding: 6px 8px;
      font: 12px/1 inherit;
      color: #1f2329;
      outline: none;
      background: #fff;
    }
    .prop-select:focus { border-color: #3370ff; }

    .prop-btn-group { display: flex; gap: 2px; flex: 1; }
    .prop-btn {
      flex: 1;
      border: 1px solid #dee0e3;
      border-radius: 6px;
      padding: 6px 0;
      font: 11px/1 inherit;
      cursor: pointer;
      background: #fff;
      color: #646a73;
      text-align: center;
    }
    .prop-btn--active { background: #3370ff; color: #fff; border-color: #3370ff; }

    .prop-range-wrap { display: flex; align-items: center; gap: 8px; flex: 1; }
    .prop-range {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: #dee0e3;
      border-radius: 2px;
      outline: none;
    }
    .prop-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #3370ff;
      cursor: pointer;
    }
    .prop-range-value { width: 36px; font: 11px/1 monospace; color: #646a73; text-align: right; }

    .prop-toggle {
      position: relative;
      width: 36px; height: 20px;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      transition: background .15s;
    }
    .prop-toggle--on { background: #3370ff; }
    .prop-toggle--off { background: #dee0e3; }
    .prop-toggle::after {
      content: '';
      position: absolute;
      top: 3px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #fff;
      transition: left .15s;
    }
    .prop-toggle--on::after { left: 19px; }
    .prop-toggle--off::after { left: 3px; }

    .spacing-box { display: grid; grid-template-columns: 52px 1fr 52px; grid-template-rows: auto auto auto; gap: 4px; align-items: center; }
    .spacing-box-center { grid-column: 2; grid-row: 2; text-align: center; font: 11px/1 inherit; color: #8f959e; padding: 8px 0; }
    .spacing-top { grid-column: 2; grid-row: 1; justify-self: center; }
    .spacing-right { grid-column: 3; grid-row: 2; }
    .spacing-bottom { grid-column: 2; grid-row: 3; justify-self: center; }
    .spacing-left { grid-column: 1; grid-row: 2; }
    .spacing-input {
      width: 44px;
      border: 1px solid #dee0e3;
      border-radius: 6px;
      padding: 4px;
      font: 11px/1 monospace;
      text-align: center;
      outline: none;
      color: #1f2329;
    }
    .spacing-input:focus { border-color: #3370ff; }

    .spacing-section { margin-bottom: 10px; }
    .spacing-label { font: 11px/1 inherit; color: #8f959e; margin-bottom: 6px; }
  `;
  }
  function colorRow(label, property, value) {
    const hex = rgbToHex(value) || "#000000";
    return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-color-wrap">
        <input type="color" class="prop-color-input" data-property="${property}" value="${hex}">
        <input type="text" class="prop-hex-input" data-property="${property}" value="${hex}" placeholder="#000000">
      </div>
    </div>
  `;
  }
  function numberRow(label, property, value, units = ["px", "%", "em", "rem", "vh", "vw"]) {
    const { number, unit } = parseNumericValue(value);
    const unitOptions = units.map((u) => `<option value="${u}" ${u === (unit || "px") ? "selected" : ""}>${u}</option>`).join("");
    return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-number-wrap">
        <input type="number" class="prop-number-input" data-property="${property}" data-type="number-unit" value="${number}" placeholder="auto">
        <select class="prop-unit-select" data-property="${property}" data-role="unit">${unitOptions}</select>
      </div>
    </div>
  `;
  }
  function selectRow(label, property, value, options) {
    const optionsHtml = options.map(
      (opt) => `<option value="${opt.value}" ${opt.value === value ? "selected" : ""}>${opt.label}</option>`
    ).join("");
    return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <select class="prop-select" data-property="${property}">${optionsHtml}</select>
    </div>
  `;
  }
  function buttonGroupRow(label, property, value, options) {
    const btns = options.map(
      (opt) => `<button class="prop-btn ${opt.value === value ? "prop-btn--active" : ""}" data-property="${property}" data-value="${opt.value}">${opt.label}</button>`
    ).join("");
    return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-btn-group">${btns}</div>
    </div>
  `;
  }
  function rangeRow(label, property, value, min = 0, max = 1, step = 0.01) {
    const num = parseFloat(value) || 1;
    return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-range-wrap">
        <input type="range" class="prop-range" data-property="${property}" min="${min}" max="${max}" step="${step}" value="${num}">
        <span class="prop-range-value">${num}</span>
      </div>
    </div>
  `;
  }
  function toggleRow(label, property, isOn) {
    return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <button class="prop-toggle ${isOn ? "prop-toggle--on" : "prop-toggle--off"}" data-property="${property}" data-toggle="${isOn ? "on" : "off"}"></button>
    </div>
  `;
  }
  function spacingBox(prefix, styles) {
    const top = parseNumericValue(styles[`${prefix}Top`]).number || "0";
    const right = parseNumericValue(styles[`${prefix}Right`]).number || "0";
    const bottom = parseNumericValue(styles[`${prefix}Bottom`]).number || "0";
    const left = parseNumericValue(styles[`${prefix}Left`]).number || "0";
    return `
    <div class="spacing-section">
      <div class="spacing-label">${prefix === "padding" ? "Padding" : "Margin"}</div>
      <div class="spacing-box">
        <div class="spacing-top"><input type="number" class="spacing-input" data-property="${prefix}Top" value="${top}"></div>
        <div class="spacing-left"><input type="number" class="spacing-input" data-property="${prefix}Left" value="${left}"></div>
        <div class="spacing-box-center">${prefix === "padding" ? "P" : "M"}</div>
        <div class="spacing-right"><input type="number" class="spacing-input" data-property="${prefix}Right" value="${right}"></div>
        <div class="spacing-bottom"><input type="number" class="spacing-input" data-property="${prefix}Bottom" value="${bottom}"></div>
      </div>
    </div>
  `;
  }
  function group(title, key, expanded, content) {
    return `
    <div class="group">
      <div class="group-header" data-group="${key}">
        <span class="group-arrow ${expanded ? "group-arrow--open" : ""}">\u25B6</span>
        <span>${title}</span>
      </div>
      <div class="group-body ${expanded ? "group-body--open" : ""}">${content}</div>
    </div>
  `;
  }
  function renderPropertiesPanel(element, expandedGroups) {
    if (!element) {
      return '<div class="props-scroll" style="padding:24px 16px;color:#8f959e;font-size:12px;">\u70B9\u51FB\u9875\u9762\u5143\u7D20\u5F00\u59CB\u7F16\u8F91\u5C5E\u6027\u3002</div>';
    }
    const styles = readAllStyles(element);
    const colorGroup = group("\u989C\u8272", "color", expandedGroups.has("color"), [
      colorRow("\u80CC\u666F\u8272", "backgroundColor", styles.backgroundColor),
      colorRow("\u6587\u5B57\u8272", "color", styles.color)
    ].join(""));
    const spacingGroup = group("\u95F4\u8DDD", "spacing", expandedGroups.has("spacing"), [
      spacingBox("padding", styles),
      spacingBox("margin", styles)
    ].join(""));
    const borderGroup = group("\u8FB9\u6846", "border", expandedGroups.has("border"), [
      numberRow("\u5BBD\u5EA6", "borderWidth", styles.borderWidth, ["px"]),
      colorRow("\u989C\u8272", "borderColor", styles.borderColor),
      numberRow("\u5706\u89D2", "borderRadius", styles.borderRadius, ["px", "%"])
    ].join(""));
    const fontGroup = group("\u5B57\u4F53", "font", expandedGroups.has("font"), [
      numberRow("\u5B57\u53F7", "fontSize", styles.fontSize, ["px", "em", "rem"]),
      selectRow("\u5B57\u91CD", "fontWeight", styles.fontWeight, [
        { value: "100", label: "100 Thin" },
        { value: "200", label: "200 Light" },
        { value: "300", label: "300" },
        { value: "400", label: "400 Normal" },
        { value: "500", label: "500 Medium" },
        { value: "600", label: "600 Semi" },
        { value: "700", label: "700 Bold" },
        { value: "800", label: "800" },
        { value: "900", label: "900 Black" }
      ]),
      buttonGroupRow("\u5BF9\u9F50", "textAlign", styles.textAlign, [
        { value: "left", label: "\u5DE6" },
        { value: "center", label: "\u4E2D" },
        { value: "right", label: "\u53F3" }
      ])
    ].join(""));
    const sizeGroup = group("\u5C3A\u5BF8", "size", expandedGroups.has("size"), [
      numberRow("\u5BBD\u5EA6", "width", styles.width),
      numberRow("\u9AD8\u5EA6", "height", styles.height)
    ].join(""));
    const layoutGroup = group("\u5E03\u5C40", "layout", expandedGroups.has("layout"), [
      selectRow("Display", "display", styles.display, [
        { value: "block", label: "block" },
        { value: "flex", label: "flex" },
        { value: "grid", label: "grid" },
        { value: "inline-block", label: "inline-block" },
        { value: "inline", label: "inline" },
        { value: "none", label: "none" }
      ]),
      selectRow("\u65B9\u5411", "flexDirection", styles.flexDirection, [
        { value: "row", label: "row" },
        { value: "column", label: "column" },
        { value: "row-reverse", label: "row-reverse" },
        { value: "column-reverse", label: "column-reverse" }
      ]),
      selectRow("\u4E3B\u8F74", "justifyContent", styles.justifyContent, [
        { value: "flex-start", label: "flex-start" },
        { value: "center", label: "center" },
        { value: "flex-end", label: "flex-end" },
        { value: "space-between", label: "space-between" },
        { value: "space-around", label: "space-around" },
        { value: "space-evenly", label: "space-evenly" }
      ]),
      selectRow("\u4EA4\u53C9\u8F74", "alignItems", styles.alignItems, [
        { value: "stretch", label: "stretch" },
        { value: "flex-start", label: "flex-start" },
        { value: "center", label: "center" },
        { value: "flex-end", label: "flex-end" },
        { value: "baseline", label: "baseline" }
      ])
    ].join(""));
    const hasShadow = styles.boxShadow && styles.boxShadow !== "none";
    const isHidden = styles.display === "none";
    const effectGroup = group("\u6548\u679C", "effect", expandedGroups.has("effect"), [
      toggleRow("\u9634\u5F71", "boxShadow", hasShadow),
      rangeRow("\u900F\u660E\u5EA6", "opacity", styles.opacity),
      toggleRow("\u9690\u85CF", "hidden", isHidden)
    ].join(""));
    return `
    <div class="props-scroll">
      ${colorGroup}
      ${spacingGroup}
      ${borderGroup}
      ${fontGroup}
      ${sizeGroup}
      ${layoutGroup}
      ${effectGroup}
    </div>
  `;
  }

  // src/core/llm-command.mjs
  var SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4E2A HTML/CSS \u53EF\u89C6\u5316\u7F16\u8F91\u52A9\u624B\u3002\u7528\u6237\u4F1A\u63CF\u8FF0\u5BF9\u9875\u9762\u5143\u7D20\u7684\u4FEE\u6539\u9700\u6C42\uFF0C\u4F60\u9700\u8981\u8FD4\u56DE\u7ED3\u6784\u5316\u7684\u64CD\u4F5C\u6307\u4EE4\u3002

\u4F60\u5FC5\u987B\u4E14\u53EA\u80FD\u8FD4\u56DE\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u6587\u5B57\u3002JSON \u683C\u5F0F\u5982\u4E0B\uFF1A

{
  "style": { "cssProperty": "value" },  // camelCase CSS \u5C5E\u6027\uFF0C\u5982 backgroundColor, fontSize
  "text": "\u65B0\u6587\u5B57\u5185\u5BB9",                    // \u4FEE\u6539\u6587\u5B57\u5185\u5BB9\u65F6\u4F7F\u7528\uFF0C\u4E0D\u4FEE\u6539\u5219\u4E0D\u8981\u6B64\u5B57\u6BB5
  "hidden": true/false,                   // \u9690\u85CF/\u663E\u793A\u5143\u7D20\uFF0C\u4E0D\u6D89\u53CA\u5219\u4E0D\u8981\u6B64\u5B57\u6BB5
  "order": "up/down/first/last",          // \u79FB\u52A8\u5143\u7D20\u4F4D\u7F6E\uFF0C\u4E0D\u6D89\u53CA\u5219\u4E0D\u8981\u6B64\u5B57\u6BB5
  "insert": "\u65B0\u5143\u7D20\u6587\u5B57\u5185\u5BB9"               // \u5728\u5F53\u524D\u5143\u7D20\u540E\u63D2\u5165\u540C\u7C7B\u578B\u65B0\u5143\u7D20\uFF0C\u4E0D\u6D89\u53CA\u5219\u4E0D\u8981\u6B64\u5B57\u6BB5
}

\u89C4\u5219\uFF1A
- style \u4E2D\u7684\u5C5E\u6027\u540D\u7528 camelCase\uFF08\u5982 paddingBottom \u4E0D\u662F padding-bottom\uFF09
- \u989C\u8272\u503C\u7528 hex \u6216 rgba
- \u5C3A\u5BF8\u503C\u5E26\u5355\u4F4D\uFF08px, %, vh \u7B49\uFF09
- \u5982\u679C\u7528\u6237\u8BF4"\u5220\u9664"\u6307\u7684\u662F\u9690\u85CF\u5143\u7D20\uFF0C\u8FD4\u56DE {"hidden": true}
- \u5982\u679C\u7528\u6237\u8BF4"\u79FB\u5230\u6700\u540E"\u4E4B\u7C7B\uFF0C\u8FD4\u56DE {"order": "last"}
- \u53EA\u8FD4\u56DE JSON\uFF0C\u4E0D\u8981 markdown \u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA`;
  var DEFAULT_KEY = "019d1a6691b176a180ab9de6786e3c20";
  var apiKey = null;
  function getApiKey() {
    if (apiKey) return apiKey;
    try {
      apiKey = localStorage.getItem("click-edit-api-key");
    } catch {
    }
    return apiKey || DEFAULT_KEY;
  }
  async function llmParseCommand(command, elementContext) {
    const key = getApiKey();
    if (!key) return null;
    const userMessage = elementContext ? `\u5F53\u524D\u9009\u4E2D\u5143\u7D20\uFF1A<${elementContext.tag}> \u5185\u5BB9\uFF1A"${elementContext.text?.slice(0, 100)}" \u5F53\u524D\u6837\u5F0F\uFF1A${elementContext.currentStyle}

\u7528\u6237\u6307\u4EE4\uFF1A${command}` : `\u7528\u6237\u6307\u4EE4\uFF1A${command}`;
    try {
      const isProxy = !key.startsWith("sk-ant-");
      const baseUrl = isProxy ? "http://deepseek-work.intsig.net/proxy/aws/claude/bedrock" : "https://api.anthropic.com";
      const endpoint = `${baseUrl}/v1/messages`;
      const headers = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      };
      if (isProxy) {
        headers["Authorization"] = `Bearer ${key}`;
      } else {
        headers["x-api-key"] = key;
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: isProxy ? "us.anthropic.claude-haiku-4-5-20251001-v1:0" : "claude-haiku-4-5-20251001",
          max_tokens: 256,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }]
        })
      });
      if (!res.ok) {
        if (res.status === 401) {
          apiKey = null;
          try {
            localStorage.removeItem("click-edit-api-key");
          } catch {
          }
        }
        return null;
      }
      const data = await res.json();
      const text = data.content?.[0]?.text?.trim();
      if (!text) return null;
      const json = JSON.parse(text.replace(/^```json?\s*/, "").replace(/```$/, ""));
      return {
        style: json.style || {},
        text: json.text,
        hidden: json.hidden,
        order: json.order,
        insert: json.insert
      };
    } catch {
      return null;
    }
  }

  // src/core/analytics.mjs
  var STORAGE_KEY2 = "click-edit-analytics-v1";
  var REPO = "ddingdian-dd/click-edit";
  var BATCH_THRESHOLD = 5;
  function readRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY2) || "[]");
    } catch {
      return [];
    }
  }
  function writeRecords(records) {
    localStorage.setItem(STORAGE_KEY2, JSON.stringify(records));
  }
  function trackUnrecognized(command, elementContext) {
    track("unrecognized", command, elementContext);
  }
  function trackMisparsed(command, elementContext, appliedResult) {
    track("misparsed", command, elementContext, appliedResult);
  }
  function track(type, command, elementContext, appliedResult) {
    const records = readRecords();
    records.push({
      type,
      command,
      element: elementContext ? `<${elementContext.tag}> "${elementContext.text?.slice(0, 50)}"` : null,
      applied: appliedResult || null,
      url: location.href,
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
    writeRecords(records);
    if (records.length >= BATCH_THRESHOLD) {
      autoReport();
    }
  }
  function autoReport() {
    const records = readRecords();
    if (!records.length) return;
    const unrecognized = records.filter((r) => r.type === "unrecognized");
    const misparsed = records.filter((r) => r.type === "misparsed");
    const sections = [];
    if (unrecognized.length) {
      sections.push(
        `### \u672A\u8BC6\u522B (${unrecognized.length} \u6761)`,
        "",
        "| \u6307\u4EE4 | \u5143\u7D20 | \u9875\u9762 | \u65F6\u95F4 |",
        "|------|------|------|------|",
        ...unrecognized.map(
          (r) => `| ${r.command} | ${r.element || "-"} | ${r.url?.split("/").pop() || "-"} | ${r.time?.slice(0, 16)} |`
        )
      );
    }
    if (misparsed.length) {
      sections.push(
        "",
        `### \u89E3\u6790\u9519\u8BEF (${misparsed.length} \u6761)`,
        "",
        "| \u6307\u4EE4 | \u5B9E\u9645\u6548\u679C | \u5143\u7D20 | \u65F6\u95F4 |",
        "|------|---------|------|------|",
        ...misparsed.map(
          (r) => `| ${r.command} | ${r.applied || "-"} | ${r.element || "-"} | ${r.time?.slice(0, 16)} |`
        )
      );
    }
    const body = [
      "## \u6307\u4EE4\u95EE\u9898\u4E0A\u62A5",
      "",
      `\u5171 ${records.length} \u6761\uFF08\u672A\u8BC6\u522B ${unrecognized.length} + \u89E3\u6790\u9519\u8BEF ${misparsed.length}\uFF09\uFF0C\u81EA\u52A8\u6536\u96C6\u3002`,
      "",
      ...sections,
      "",
      "---",
      "Auto-reported by Click-Edit analytics"
    ].join("\n");
    const title = `[Analytics] ${records.length} \u6761\u6307\u4EE4\u95EE\u9898 (${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)})`;
    const url = `https://github.com/${REPO}/issues/new?` + new URLSearchParams({
      title,
      body,
      labels: "analytics,unrecognized-command"
    }).toString();
    window.open(url, "_blank");
    writeRecords([]);
  }

  // src/runtime/overlay.mjs
  var ROOT_ID = "click-edit-root";
  var HOVER_OUTLINE_ID = "click-edit-hover-outline";
  var SELECTED_OUTLINE_ID = "click-edit-selected-outline";
  var SAVE_SERVER = "http://localhost:17532/save";
  async function saveHtmlToFile() {
    if (!window.location.href.startsWith("file://")) return "unsupported";
    const clone = document.documentElement.cloneNode(true);
    const editorRoot = clone.querySelector(`#${ROOT_ID}`);
    if (editorRoot) editorRoot.remove();
    clone.querySelectorAll(`#${HOVER_OUTLINE_ID}, #${SELECTED_OUTLINE_ID}`).forEach((el) => el.remove());
    clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    const html = "<!DOCTYPE html>\n" + clone.outerHTML;
    try {
      const res = await fetch(SAVE_SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: window.location.href, html })
      });
      return res.ok ? "saved" : "no-server";
    } catch {
      return "no-server";
    }
  }
  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest(`#${ROOT_ID}`)) return false;
    if (["HTML", "BODY", "SCRIPT", "STYLE"].includes(target.tagName)) return false;
    return true;
  }
  function getLayoutTarget(element, command) {
    if (hasPageSizeIntent(command)) {
      return element.closest("main") || document.querySelector("main") || document.body.firstElementChild || element;
    }
    if (!element.children.length) {
      return element.closest("section, article, main") || element.closest("div") || element;
    }
    return element;
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function formatHistoryTime(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    } catch {
      return "";
    }
  }
  function toCssPropertyName3(key) {
    return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }
  function createOutline({ id, border, shadow, zIndex }) {
    const outline = document.createElement("div");
    outline.id = id;
    outline.style.cssText = [
      "position:fixed",
      `z-index:${zIndex}`,
      "pointer-events:none",
      border,
      shadow,
      "border-radius:8px",
      "display:none"
    ].join(";");
    return outline;
  }
  function updateOutline(outline, element) {
    if (!element) {
      outline.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    outline.style.display = "block";
    outline.style.left = `${rect.left}px`;
    outline.style.top = `${rect.top}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;
  }
  function renderPanel(shadow, state) {
    const history = readStoredEditsForPath();
    const recentHistory = history.slice(-5).reverse();
    const newCount = history.filter((item) => !item.exportedAt).length;
    const exportedCount = history.length - newCount;
    const propertiesHtml = state.activeTab === "properties" ? renderPropertiesPanel(state.selected, state.expandedGroups) : "";
    shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .panel {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: min(420px, calc(100vw - 40px));
        color: #1f2329;
        background: rgba(255, 255, 255, .96);
        border: 1px solid #dee0e3;
        border-radius: 16px;
        box-shadow: 0 24px 64px rgba(31, 35, 41, .16);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .panel--collapsed {
        width: auto;
        border-radius: 50%;
        padding: 0;
      }
      .fab {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        cursor: pointer;
        background: #3370ff;
        border: 0;
        border-radius: 50%;
        color: #fff;
        font-size: 20px;
        box-shadow: 0 4px 16px rgba(51, 112, 255, .3);
      }
      .fab:hover { transform: scale(1.08); }
      .header { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid #eff0f3; }
      .title { font-size: 14px; font-weight: 700; }
      .status { margin-top: 4px; font-size: 12px; line-height: 1.45; color: #646a73; }
      .collapse-btn { border: 0; background: none; cursor: pointer; padding: 4px; color: #8f959e; font-size: 18px; line-height: 1; border-radius: 6px; }
      .collapse-btn:hover { background: #f0f1f5; color: #1f2329; }
      .body { display: ${state.enabled && !state.collapsed ? "block" : "none"}; }
      .selected { padding: 9px 16px; font-size: 12px; line-height: 1.45; color: #646a73; }

      .tabs { display: flex; gap: 4px; padding: 0 16px; margin-top: 8px; }
      .tab {
        flex: 1;
        border: 0;
        border-radius: 8px;
        padding: 8px 0;
        font: 600 12px/1 inherit;
        cursor: pointer;
        transition: background .15s, color .15s;
      }
      .tab--active { color: #fff; background: #3370ff; }
      .tab--inactive { color: #646a73; background: #f0f1f5; }

      .nlp-body { padding: 14px 16px 0; }
      textarea {
        display: block;
        width: 100%;
        min-height: 94px;
        resize: vertical;
        border: 1px solid #dee0e3;
        border-radius: 14px;
        padding: 11px 12px;
        font: 14px/1.5 inherit;
        color: #1f2329;
        outline: none;
      }
      textarea:focus { border-color: #3370ff; box-shadow: 0 0 0 3px rgba(51,112,255,.14); }
      .nlp-actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; padding-bottom: 14px; }
      .nlp-actions .spacer { flex: 1; }

      .footer { padding: 10px 16px 14px; border-top: 1px solid #eff0f3; margin-top: 8px; }
      .footer-actions { display: flex; gap: 8px; align-items: center; }
      .footer-actions .spacer { flex: 1; }
      .history { margin-top: 10px; }
      .history-list { display: grid; gap: 6px; max-height: 120px; overflow: auto; }
      .history-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px 10px;
        border-radius: 10px;
        background: #f6f6fb;
        color: #1f2329;
        font-size: 12px;
        line-height: 1.35;
      }
      .history-copy { min-width: 0; }
      .history-command { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .history-meta { margin-top: 3px; color: #8f959e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
      .history-item--exported { background: #fafbff; opacity: .85; }
      .history-item--exported .history-command::before {
        content: '\u5DF2\u5BFC\u51FA \xB7 ';
        color: #3370ff;
        font-weight: 600;
      }
      .history-divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 2px;
        font-size: 11px;
        color: #8f959e;
      }
      .history-divider::before,
      .history-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #eef0f3;
      }
      .empty-history { color: #8f959e; font-size: 12px; }

      button {
        border: 0;
        border-radius: 999px;
        padding: 9px 14px;
        font: 600 13px/1 inherit;
        cursor: pointer;
      }
      .primary { color: #fff; background: #3370ff; }
      .primary:disabled { background: #c9cdd4; cursor: not-allowed; opacity: 0.6; }
      .secondary { color: #1f2329; background: #f0f1f5; }
      .mini { padding: 8px 11px; font-size: 12px; }

      ${getPropertiesPanelStyles()}
    </style>
    <section class="panel ${state.collapsed ? "panel--collapsed" : ""}">
      ${state.collapsed ? `
        <button class="fab" data-action="expand" title="\u5C55\u5F00\u7F16\u8F91\u5668">&#9998;</button>
      ` : `
      <div class="header">
        <div>
          <div class="title">Click-Edit</div>
          <div class="status">${escapeHtml(state.status || "")}</div>
        </div>
        <button class="collapse-btn" data-action="collapse" title="\u6536\u8D77">&times;</button>
      </div>`}
      <div class="body">
        <div class="tabs">
          <button class="tab ${state.activeTab === "properties" ? "tab--active" : "tab--inactive"}" data-action="tab-properties">\u5C5E\u6027\u9762\u677F</button>
          <button class="tab ${state.activeTab === "nlp" ? "tab--active" : "tab--inactive"}" data-action="tab-nlp">\u5FEB\u6377\u8F93\u5165</button>
        </div>
        ${state.activeTab === "properties" ? propertiesHtml : ""}
        ${state.activeTab === "nlp" ? `
          <div class="nlp-body">
            <textarea placeholder="\u4EFB\u610F\u63CF\u8FF0\u4FEE\u6539\uFF0C\u5982\uFF1A\u5E95\u8272\u6539\u4E3A\u7EAF\u767D\u8272\uFF1B\u5B57\u53F7\u653E\u5927\u523020px\uFF1B\u589E\u52A0\u4E00\u4E2A\u6309\u94AE\uFF1B\u5220\u9664\u8FD9\u4E2A\u5143\u7D20"></textarea>
            <div class="nlp-actions">
              <span class="spacer"></span>
              <button class="primary" data-action="apply" title="\u56DE\u8F66 \u21B5 \u4E5F\u53EF\u89E6\u53D1" disabled>\u5E94\u7528</button>
            </div>
          </div>
        ` : ""}
        ${history.length ? `
          <div class="footer">
            <div class="footer-actions">
              <span style="font-size:12px;color:#1f2329;font-weight:700;">\u4FEE\u6539\u8BB0\u5F55 ${history.length}${newCount && exportedCount ? ` <span style="font-weight:400;color:#8f959e;">\uFF08\u65B0\u589E ${newCount} \xB7 \u5DF2\u5BFC\u51FA ${exportedCount}\uFF09</span>` : ""}</span>
              <span class="spacer"></span>
              <button class="secondary mini" data-action="reset">\u91CD\u7F6E</button>
              <button class="secondary mini" data-action="export" title="\u5BFC\u51FA\u4FEE\u6539\u9879 Markdown\uFF0C\u53EF\u76F4\u63A5\u7ED9\u5F00\u53D1">\u5BFC\u51FA\u4FEE\u6539\u9879${newCount ? ` (${newCount})` : ""}</button>
            </div>
            <div class="history">
              <div class="history-list">${(() => {
      const blocks = [];
      let lastExported = null;
      recentHistory.forEach((item, index) => {
        const isExported = !!item.exportedAt;
        if (lastExported !== null && lastExported !== isExported) {
          blocks.push(`<div class="history-divider">${isExported ? "\u5DF2\u5BFC\u51FA" : "\u672C\u6B21\u65B0\u589E"}</div>`);
        }
        lastExported = isExported;
        const meta = [index === 0 ? "\u6700\u65B0" : formatHistoryTime(item.createdAt), item.label].filter(Boolean).join(" \xB7 ");
        blocks.push(`
                    <div class="history-item ${isExported ? "history-item--exported" : ""}">
                      <div class="history-copy">
                        <div class="history-command" title="${escapeHtml(item.command || "\u672A\u547D\u540D\u4FEE\u6539")}">${escapeHtml(item.command || "\u672A\u547D\u540D\u4FEE\u6539")}</div>
                        <div class="history-meta">${escapeHtml(meta)}</div>
                      </div>
                      <button class="secondary mini" data-action="rollback" data-edit-id="${escapeHtml(item.id)}">\u56DE\u9000</button>
                    </div>
                  `);
      });
      return blocks.join("");
    })()}</div>
            </div>
          </div>
        ` : ""}
      </div>
    </section>
  `;
  }
  function initClickEdit(options = {}) {
    if (typeof window === "undefined") return void 0;
    if (window.__CLICK_EDIT__) return window.__CLICK_EDIT__;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    const shadow = root.attachShadow({ mode: "open" });
    const hoverOutline = createOutline({
      id: HOVER_OUTLINE_ID,
      border: "border:1px dashed rgba(51,112,255,.82)",
      shadow: "box-shadow:0 0 0 3px rgba(51,112,255,.08)",
      zIndex: 2147483645
    });
    const selectedOutline = createOutline({
      id: SELECTED_OUTLINE_ID,
      border: "border:2px solid #3370ff",
      shadow: "box-shadow:0 0 0 4px rgba(51,112,255,.14)",
      zIndex: 2147483646
    });
    const mountHost = document.documentElement;
    function ensureMounted() {
      if (!root.isConnected) mountHost.appendChild(root);
      if (!hoverOutline.isConnected) mountHost.appendChild(hoverOutline);
      if (!selectedOutline.isConnected) mountHost.appendChild(selectedOutline);
    }
    ensureMounted();
    const mountObserver = new MutationObserver(() => ensureMounted());
    mountObserver.observe(mountHost, { childList: true });
    const state = {
      enabled: options.enabled ?? false,
      collapsed: false,
      hovered: null,
      selected: null,
      status: "\u70B9\u51FB\u9875\u9762\u5143\u7D20\u5F00\u59CB\u7F16\u8F91\u3002",
      activeTab: "nlp",
      expandedGroups: /* @__PURE__ */ new Set(["color"])
    };
    let previewProperty = null;
    let editingElement = null;
    let editingOriginalText = null;
    function rerender() {
      renderPanel(shadow, state);
    }
    function setStatus(status) {
      state.status = status;
      rerender();
    }
    function applyPropertyChange(property, value) {
      if (!state.selected) return;
      const parsed = { style: { [property]: value } };
      const command = `${property}: ${value}`;
      const record = createEditRecord({ element: state.selected, command, parsed });
      applyEdit(record);
      saveEdit(record);
      saveHtmlToFile();
      setStatus(`\u5DF2\u4FEE\u6539\uFF1A${property}`);
    }
    function handleToggleProperty(property, currentState) {
      if (!state.selected) return;
      if (property === "boxShadow") {
        const value = currentState === "on" ? "none" : "0 18px 48px rgba(31, 35, 41, 0.12)";
        applyPropertyChange(property, value);
      } else if (property === "hidden") {
        const value = currentState === "on" ? "" : "none";
        applyPropertyChange("display", value);
      }
    }
    function handleNumberUnitChange(target) {
      const property = target.dataset.property;
      const row = target.closest(".prop-number-wrap");
      if (!row || !property) return;
      const numberInput = row.querySelector(".prop-number-input");
      const unitSelect = row.querySelector(".prop-unit-select");
      if (!numberInput) return;
      const num = numberInput.value;
      if (!num) return;
      const unit = unitSelect?.value || "px";
      applyPropertyChange(property, `${num}${unit}`);
    }
    function handleSpacingChange(target) {
      const property = target.dataset.property;
      const value = target.value;
      if (!property || !state.selected) return;
      applyPropertyChange(property, value ? `${value}px` : "0px");
    }
    function onMouseMove(event) {
      if (!state.enabled || state.collapsed) return;
      state.hovered = isEditableTarget(event.target) ? event.target : null;
      updateOutline(hoverOutline, state.hovered && state.hovered !== state.selected ? state.hovered : null);
      updateOutline(selectedOutline, state.selected);
    }
    function commitTextEdit() {
      if (!editingElement) return;
      const newText = editingElement.innerText.trim();
      editingElement.contentEditable = "false";
      editingElement.style.outline = "";
      editingElement.style.cursor = "";
      editingElement.removeEventListener("blur", onEditBlur);
      editingElement.removeEventListener("keydown", onEditKeydown);
      if (newText !== editingOriginalText) {
        editingElement.innerText = editingOriginalText;
        const parsed = { style: {}, text: newText };
        const command = `\u6587\u6848\u4FEE\u6539\uFF1A"${newText.slice(0, 30)}"`;
        const record = createEditRecord({ element: editingElement, command, parsed });
        applyEdit(record);
        saveEdit(record);
        saveHtmlToFile();
        setStatus(`\u5DF2\u4FDD\u5B58\u6587\u6848\u4FEE\u6539`);
      }
      editingElement = null;
      editingOriginalText = null;
    }
    function onEditBlur() {
      setTimeout(() => commitTextEdit(), 0);
    }
    function onEditKeydown(event) {
      if (event.key === "Escape") {
        editingElement.innerText = editingOriginalText;
        commitTextEdit();
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        editingElement.blur();
      }
    }
    function onDblClick(event) {
      if (!state.enabled || state.collapsed || !isEditableTarget(event.target)) return;
      if (!isTextNode(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      state.selected = event.target;
      updateOutline(selectedOutline, event.target);
      startTextEdit(event.target);
    }
    function isTextNode(el) {
      if (!el || !el.childNodes) return false;
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return true;
      }
      return false;
    }
    function startTextEdit(el) {
      if (editingElement) commitTextEdit();
      editingElement = el;
      editingOriginalText = el.innerText.trim();
      el.contentEditable = "true";
      el.style.outline = "2px solid #3370ff";
      el.style.cursor = "text";
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      el.addEventListener("blur", onEditBlur);
      el.addEventListener("keydown", onEditKeydown);
      state.status = "\u7F16\u8F91\u6587\u5B57\u4E2D\u2026 \u70B9\u51FB\u522B\u5904\u4FDD\u5B58\uFF0CEsc \u53D6\u6D88";
      rerender();
    }
    function selectElement(el) {
      state.selected = el;
      state.status = `\u5DF2\u9009\u4E2D\uFF1A${getElementLabel(el)}`;
      updateOutline(hoverOutline, null);
      updateOutline(selectedOutline, state.selected);
      rerender();
    }
    function onClick(event) {
      if (!state.enabled || state.collapsed || !isEditableTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (editingElement && editingElement !== event.target) {
        commitTextEdit();
      }
      if (state.selected === event.target && isTextNode(event.target) && !editingElement) {
        startTextEdit(event.target);
        return;
      }
      selectElement(event.target);
    }
    function applyCommand() {
      const textarea = shadow.querySelector("textarea");
      const command = textarea?.value?.trim();
      return applyCommandToElement(state.selected, command);
    }
    function getElementContext(element) {
      const cs = window.getComputedStyle(element);
      const props = ["display", "padding", "margin", "fontSize", "color", "backgroundColor", "borderRadius"];
      const styles = props.map((p) => `${p}:${cs.getPropertyValue(p.replace(/[A-Z]/g, (l) => "-" + l.toLowerCase()))}`).join("; ");
      return {
        tag: element.tagName.toLowerCase(),
        text: element.innerText?.slice(0, 100),
        currentStyle: styles
      };
    }
    async function applyCommandToElement(element, command) {
      if (!element) {
        setStatus("\u8BF7\u5148\u70B9\u51FB\u9009\u4E2D\u9875\u9762\u5143\u7D20\u3002");
        return void 0;
      }
      if (!command) return void 0;
      const target = hasLayoutIntent(command) ? getLayoutTarget(element, command) : element;
      let parsed = parseVisualCommand(command);
      if (isParsedCommandEmpty(parsed)) {
        setStatus("AI \u7406\u89E3\u4E2D\u2026");
        rerender();
        const llmResult = await llmParseCommand(command, getElementContext(target));
        if (!llmResult || isParsedCommandEmpty(llmResult)) {
          trackUnrecognized(command, getElementContext(target));
          setStatus("\u672A\u80FD\u7406\u89E3\u6307\u4EE4\uFF0C\u8BF7\u6362\u79CD\u65B9\u5F0F\u63CF\u8FF0\u3002");
          return void 0;
        }
        parsed = llmResult;
      }
      const record = createEditRecord({ element: target, command, parsed });
      applyEdit(record);
      saveEdit(record);
      state.selected = target;
      updateOutline(selectedOutline, state.selected);
      const saveResult = await saveHtmlToFile();
      if (saveResult === "saved") setStatus(`\u5DF2\u5E94\u7528\uFF1A${command} \xB7 \u5DF2\u5199\u5165\u6587\u4EF6`);
      else setStatus(`\u5DF2\u5E94\u7528\uFF1A${command}`);
      return record;
    }
    function getEditRect(record) {
      try {
        const el = document.querySelector(record.selector);
        if (!el) return void 0;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.left + window.scrollX),
          y: Math.round(r.top + window.scrollY),
          w: Math.round(r.width),
          h: Math.round(r.height)
        };
      } catch {
        return void 0;
      }
    }
    function describeEditChange(record) {
      const parts = [];
      const styleEntries = Object.entries(record.style || {}).filter(([, v]) => v !== void 0);
      for (const [key, after] of styleEntries) {
        const cssKey = toCssPropertyName3(key);
        const before = record.before?.style?.[key];
        parts.push({ kind: "style", property: cssKey, before: before || "(\u672A\u8BBE\u7F6E)", after });
      }
      if (record.text !== void 0) {
        parts.push({ kind: "text", before: record.before?.text ?? "", after: record.text });
      }
      if (record.hidden !== void 0) {
        parts.push({ kind: "visibility", before: record.hidden ? "\u663E\u793A" : "\u9690\u85CF", after: record.hidden ? "\u9690\u85CF" : "\u663E\u793A" });
      }
      if (record.order) {
        parts.push({ kind: "order", after: record.order });
      }
      if (record.insert) {
        parts.push({ kind: "insert", after: record.insert });
      }
      return parts;
    }
    function buildEditList() {
      const records = readStoredEditsForPath();
      return records.map((record, index) => ({
        index: index + 1,
        selector: record.selector,
        label: record.label,
        command: record.command,
        changes: describeEditChange(record),
        rect: getEditRect(record),
        source: record.source,
        createdAt: record.createdAt,
        exportedAt: record.exportedAt
      }));
    }
    function renderEditItem(lines, item) {
      lines.push(`### ${item.index}. ${item.label || item.selector}`);
      lines.push("");
      if (item.command) lines.push(`> **\u6307\u4EE4**: ${item.command}`);
      lines.push("");
      lines.push(`- selector: \`${item.selector}\``);
      if (item.source) lines.push(`- \u6E90\u7801\u63D0\u793A: \`${item.source}\``);
      if (item.rect) lines.push(`- \u5143\u7D20\u4F4D\u7F6E\uFF08\u9875\u9762\u5750\u6807\uFF09: x=${item.rect.x}, y=${item.rect.y}, w=${item.rect.w}, h=${item.rect.h}`);
      lines.push("");
      lines.push("**\u6539\u52A8**:");
      item.changes.forEach((change) => {
        const line = formatChangeLine(change);
        if (line) lines.push(line);
      });
      lines.push("");
    }
    function formatChangeLine(change) {
      if (change.kind === "style") {
        return `- ${change.property}: \`${change.before}\` \u2192 \`${change.after}\``;
      }
      if (change.kind === "text") {
        return `- \u6587\u6848: "${change.before}" \u2192 "${change.after}"`;
      }
      if (change.kind === "visibility") {
        return `- \u663E\u9690: ${change.before} \u2192 ${change.after}`;
      }
      if (change.kind === "order") {
        const map = { up: "\u4E0A\u79FB\u4E00\u4F4D", down: "\u4E0B\u79FB\u4E00\u4F4D", first: "\u79FB\u5230\u9996\u4F4D", last: "\u79FB\u5230\u672B\u4F4D" };
        return `- \u6392\u5E8F: ${map[change.after] || change.after}`;
      }
      if (change.kind === "insert") {
        return `- \u65B0\u589E\u540C\u7EA7\u5143\u7D20\uFF0C\u6587\u672C: "${change.after}"`;
      }
      return "";
    }
    async function exportEditList() {
      const list = buildEditList();
      if (!list.length) {
        setStatus("\u5F53\u524D\u9875\u9762\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u4FEE\u6539\u3002");
        return;
      }
      const previouslyExported = list.filter((item) => item.exportedAt);
      const newlyAdded = list.filter((item) => !item.exportedAt);
      const url = window.location.href;
      const title = document.title || "";
      const exportedAt = (/* @__PURE__ */ new Date()).toISOString();
      const lines = [];
      lines.push(`# Click-Edit \u4FEE\u6539\u6E05\u5355`);
      lines.push("");
      lines.push(`- \u9875\u9762: ${title}`);
      lines.push(`- URL: ${url}`);
      lines.push(`- \u5BFC\u51FA\u65F6\u95F4: ${exportedAt}`);
      lines.push(`- \u4FEE\u6539\u6761\u6570: ${list.length}\uFF08\u672C\u6B21\u65B0\u589E ${newlyAdded.length}\uFF0C\u5386\u53F2\u5DF2\u5BFC\u51FA ${previouslyExported.length}\uFF09`);
      lines.push("");
      lines.push("---");
      lines.push("");
      if (newlyAdded.length) {
        lines.push(`## \u{1F195} \u672C\u6B21\u65B0\u589E\uFF08${newlyAdded.length} \u6761\uFF09`);
        lines.push("");
        lines.push("> \u4E0A\u6B21\u5BFC\u51FA\u4E4B\u540E\u4EA7\u751F\u7684\u4FEE\u6539\uFF0C\u5F00\u53D1\u4F18\u5148\u770B\u8FD9\u4E00\u6BB5\u3002");
        lines.push("");
        newlyAdded.forEach((item) => renderEditItem(lines, item));
        lines.push("---");
        lines.push("");
      }
      if (previouslyExported.length) {
        lines.push(`## \u2705 \u5DF2\u5BFC\u51FA\u8FC7\uFF08${previouslyExported.length} \u6761\uFF09`);
        lines.push("");
        lines.push("> \u4E4B\u524D\u5DF2\u7ECF\u5BFC\u51FA\u8FC7\u7684\u4FEE\u6539\uFF0C\u7559\u5728\u8FD9\u91CC\u4F9B\u5B8C\u6574\u5BF9\u7167\u3002");
        lines.push("");
        previouslyExported.forEach((item) => renderEditItem(lines, item));
        lines.push("---");
        lines.push("");
      }
      lines.push("## \u539F\u59CB\u6570\u636E\uFF08JSON\uFF0C\u53EF\u76F4\u63A5\u5582\u7ED9\u811A\u672C\uFF09");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify({
        url,
        title,
        exportedAt,
        summary: { total: list.length, newlyAdded: newlyAdded.length, previouslyExported: previouslyExported.length },
        edits: list
      }, null, 2));
      lines.push("```");
      lines.push("");
      const md = lines.join("\n");
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const pageName = (document.title || "page").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
      const suggestedName = `click-edit-${pageName}.md`;
      let summary;
      if (newlyAdded.length && previouslyExported.length) {
        summary = `\u672C\u6B21\u65B0\u589E ${newlyAdded.length} \u6761\uFF0C\u542B\u5386\u53F2 ${previouslyExported.length} \u6761`;
      } else if (newlyAdded.length) {
        summary = `${newlyAdded.length} \u6761\u4FEE\u6539`;
      } else {
        summary = `${previouslyExported.length} \u6761\u5386\u53F2\u4FEE\u6539\uFF0C\u65E0\u65B0\u589E`;
      }
      if (typeof window.showSaveFilePicker === "function") {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{ description: "Markdown \u6587\u4EF6", accept: { "text/markdown": [".md"] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          markExported(void 0, exportedAt);
          rerender();
          setStatus(`\u4FDD\u5B58\u6210\u529F\uFF1A${handle.name}\uFF08${summary}\uFF09`);
        } catch (err) {
          if (err.name === "AbortError") {
            setStatus("\u5DF2\u53D6\u6D88\u4FDD\u5B58\u3002");
          } else {
            setStatus(`\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message || err}`);
          }
        }
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      markExported(void 0, exportedAt);
      rerender();
      setStatus(`\u5DF2\u4E0B\u8F7D ${suggestedName}\uFF08${summary}\uFF09\uFF0C\u8BF7\u5230\u6D4F\u89C8\u5668\u9ED8\u8BA4\u4E0B\u8F7D\u6587\u4EF6\u5939\u67E5\u6536`);
    }
    function undoEdit() {
      const record = undoLastEdit();
      if (!record) {
        setStatus("\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u4FEE\u6539\u3002");
        return void 0;
      }
      if (record.command) {
        const el = document.querySelector(record.selector);
        const ctx = el ? { tag: el.tagName.toLowerCase(), text: el.innerText?.slice(0, 50) } : null;
        trackMisparsed(record.command, ctx, JSON.stringify(record.style || {}));
      }
      setStatus(`\u5DF2\u64A4\u9500\uFF1A${record.command || record.label || "\u4E0A\u4E00\u6761\u4FEE\u6539"}`);
      return record;
    }
    function rollbackEdit(editId) {
      const records = undoToEdit(editId);
      if (!records.length) {
        setStatus("\u65E0\u6CD5\u56DE\u9000\u8FD9\u6761\u8BB0\u5F55\uFF0C\u8BF7\u786E\u8BA4\u5143\u7D20\u4ECD\u5728\u5F53\u524D\u9875\u9762\u3002");
        return [];
      }
      records.forEach((record) => {
        if (record.command) {
          const el = document.querySelector(record.selector);
          const ctx = el ? { tag: el.tagName.toLowerCase(), text: el.innerText?.slice(0, 50) } : null;
          trackMisparsed(record.command, ctx, JSON.stringify(record.style || {}));
        }
      });
      setStatus(`\u5DF2\u56DE\u9000 ${records.length} \u6761\u4FEE\u6539\u3002`);
      return records;
    }
    function resetEdits() {
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
    shadow.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("[data-action]");
      const action = trigger?.getAttribute?.("data-action");
      if (action === "collapse") {
        state.collapsed = true;
        state.hovered = null;
        updateOutline(hoverOutline, null);
        updateOutline(selectedOutline, null);
        rerender();
        return;
      }
      if (action === "expand") {
        state.collapsed = false;
        updateOutline(selectedOutline, state.selected);
        rerender();
        return;
      }
      if (action === "toggle") {
        state.enabled = !state.enabled;
        if (!state.enabled) {
          state.hovered = null;
          state.selected = null;
          updateOutline(hoverOutline, null);
          updateOutline(selectedOutline, null);
        }
        state.status = state.enabled ? "\u7F16\u8F91\u6A21\u5F0F\u5DF2\u6253\u5F00\uFF0C\u70B9\u51FB\u9875\u9762\u5143\u7D20\u3002" : "\u6253\u5F00\u7F16\u8F91\u6A21\u5F0F\u540E\uFF0C\u70B9\u51FB\u9875\u9762\u5143\u7D20\u3002";
        rerender();
        return;
      }
      if (action === "tab-properties") {
        state.activeTab = "properties";
        rerender();
        return;
      }
      if (action === "tab-nlp") {
        state.activeTab = "nlp";
        rerender();
        return;
      }
      if (action === "apply") {
        applyCommand();
        return;
      }
      if (action === "undo") {
        undoEdit();
        return;
      }
      if (action === "rollback") {
        rollbackEdit(trigger.getAttribute("data-edit-id"));
        return;
      }
      if (action === "export") {
        exportEditList();
        return;
      }
      if (action === "reset") {
        resetEdits();
        return;
      }
      const groupHeader = event.target?.closest?.(".group-header");
      if (groupHeader) {
        const key = groupHeader.dataset.group;
        if (state.expandedGroups.has(key)) {
          state.expandedGroups.delete(key);
        } else {
          state.expandedGroups.add(key);
        }
        rerender();
        return;
      }
      const toggleBtn = event.target?.closest?.(".prop-toggle");
      if (toggleBtn) {
        handleToggleProperty(toggleBtn.dataset.property, toggleBtn.dataset.toggle);
        return;
      }
      const btnGroup = event.target?.closest?.(".prop-btn");
      if (btnGroup) {
        applyPropertyChange(btnGroup.dataset.property, btnGroup.dataset.value);
        return;
      }
    });
    shadow.addEventListener("input", (event) => {
      const target = event.target;
      if (target.matches?.("textarea")) {
        const applyBtn = shadow.querySelector('[data-action="apply"]');
        if (applyBtn) applyBtn.disabled = !target.value.trim();
        return;
      }
      if (!state.selected) return;
      if (target.type === "color" && target.dataset.property) {
        state.selected.style.setProperty(toCssPropertyName3(target.dataset.property), target.value);
        const row = target.closest(".prop-color-wrap");
        const hexInput = row?.querySelector(".prop-hex-input");
        if (hexInput) hexInput.value = target.value;
        previewProperty = target.dataset.property;
        return;
      }
      if (target.type === "range" && target.dataset.property) {
        state.selected.style.setProperty(toCssPropertyName3(target.dataset.property), target.value);
        const valueSpan = target.closest(".prop-range-wrap")?.querySelector(".prop-range-value");
        if (valueSpan) valueSpan.textContent = target.value;
        previewProperty = target.dataset.property;
        return;
      }
      if (target.classList.contains("spacing-input") && target.dataset.property) {
        const value = target.value ? `${target.value}px` : "0px";
        state.selected.style.setProperty(toCssPropertyName3(target.dataset.property), value);
        previewProperty = target.dataset.property;
        return;
      }
      if (target.dataset.type === "number-unit" || target.dataset.role === "unit") {
        const property = target.dataset.property;
        const row = target.closest(".prop-number-wrap");
        if (!row || !property) return;
        const numberInput = row.querySelector(".prop-number-input");
        const unitSelect = row.querySelector(".prop-unit-select");
        const num = numberInput?.value;
        if (num) {
          const unit = unitSelect?.value || "px";
          state.selected.style.setProperty(toCssPropertyName3(property), `${num}${unit}`);
          previewProperty = property;
        }
        return;
      }
    });
    shadow.addEventListener("change", (event) => {
      const target = event.target;
      if (!state.selected) return;
      if (target.type === "color" && target.dataset.property) {
        applyPropertyChange(target.dataset.property, target.value);
        previewProperty = null;
        return;
      }
      if (target.classList.contains("prop-hex-input") && target.dataset.property) {
        const value = target.value.trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
          applyPropertyChange(target.dataset.property, value);
        }
        return;
      }
      if (target.type === "range" && target.dataset.property) {
        applyPropertyChange(target.dataset.property, target.value);
        previewProperty = null;
        return;
      }
      if (target.classList.contains("prop-select") && target.dataset.property) {
        applyPropertyChange(target.dataset.property, target.value);
        return;
      }
      if (target.classList.contains("spacing-input") && target.dataset.property) {
        handleSpacingChange(target);
        previewProperty = null;
        return;
      }
      if (target.dataset.type === "number-unit" || target.dataset.role === "unit") {
        handleNumberUnitChange(target);
        previewProperty = null;
        return;
      }
    });
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && event.target?.matches?.("textarea")) {
        event.preventDefault();
        const command = event.target.value?.trim();
        if (command && state.selected) {
          applyCommandToElement(state.selected, command);
        } else if (!state.selected) {
          setStatus("\u8BF7\u5148\u70B9\u51FB\u9009\u4E2D\u9875\u9762\u5143\u7D20\u3002");
        }
      }
    });
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDblClick, true);
    readStoredEdits().forEach((record) => applyEdit(record));
    rerender();
    const api = {
      destroy() {
        mountObserver.disconnect();
        document.removeEventListener("mousemove", onMouseMove, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("dblclick", onDblClick, true);
        if (editingElement) commitTextEdit();
        root.remove();
        hoverOutline.remove();
        selectedOutline.remove();
        delete window.__CLICK_EDIT__;
      },
      exportEditList: () => exportEditList(),
      history: () => readStoredEditsForPath(),
      applyToElement: (element, command) => applyCommandToElement(element, command),
      undo: () => undoEdit(),
      rollback: (editId) => rollbackEdit(editId)
    };
    window.__CLICK_EDIT__ = api;
    return api;
  }

  // extension/content-entry.mjs
  console.log("[Click-Edit] content script loaded, initializing...");
  if (!window.__CLICK_EDIT__) {
    try {
      initClickEdit({ enabled: true });
      console.log("[Click-Edit] editor initialized successfully");
    } catch (err) {
      console.error("[Click-Edit] init failed:", err);
    }
  }
})();
