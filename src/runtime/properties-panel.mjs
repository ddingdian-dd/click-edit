import { readAllStyles, rgbToHex, parseNumericValue } from '../core/computed-style.mjs'

export function getPropertiesPanelStyles() {
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
  `
}

function colorRow(label, property, value) {
  const hex = rgbToHex(value) || '#000000'
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-color-wrap">
        <input type="color" class="prop-color-input" data-property="${property}" value="${hex}">
        <input type="text" class="prop-hex-input" data-property="${property}" value="${hex}" placeholder="#000000">
      </div>
    </div>
  `
}

function numberRow(label, property, value, units = ['px', '%', 'em', 'rem', 'vh', 'vw']) {
  const { number, unit } = parseNumericValue(value)
  const unitOptions = units.map(u => `<option value="${u}" ${u === (unit || 'px') ? 'selected' : ''}>${u}</option>`).join('')
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-number-wrap">
        <input type="number" class="prop-number-input" data-property="${property}" data-type="number-unit" value="${number}" placeholder="auto">
        <select class="prop-unit-select" data-property="${property}" data-role="unit">${unitOptions}</select>
      </div>
    </div>
  `
}

function selectRow(label, property, value, options) {
  const optionsHtml = options.map(opt =>
    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
  ).join('')
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <select class="prop-select" data-property="${property}">${optionsHtml}</select>
    </div>
  `
}

function buttonGroupRow(label, property, value, options) {
  const btns = options.map(opt =>
    `<button class="prop-btn ${opt.value === value ? 'prop-btn--active' : ''}" data-property="${property}" data-value="${opt.value}">${opt.label}</button>`
  ).join('')
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-btn-group">${btns}</div>
    </div>
  `
}

function rangeRow(label, property, value, min = 0, max = 1, step = 0.01) {
  const num = parseFloat(value) || 1
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <div class="prop-range-wrap">
        <input type="range" class="prop-range" data-property="${property}" min="${min}" max="${max}" step="${step}" value="${num}">
        <span class="prop-range-value">${num}</span>
      </div>
    </div>
  `
}

function toggleRow(label, property, isOn) {
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <button class="prop-toggle ${isOn ? 'prop-toggle--on' : 'prop-toggle--off'}" data-property="${property}" data-toggle="${isOn ? 'on' : 'off'}"></button>
    </div>
  `
}

function spacingBox(prefix, styles) {
  const top = parseNumericValue(styles[`${prefix}Top`]).number || '0'
  const right = parseNumericValue(styles[`${prefix}Right`]).number || '0'
  const bottom = parseNumericValue(styles[`${prefix}Bottom`]).number || '0'
  const left = parseNumericValue(styles[`${prefix}Left`]).number || '0'
  return `
    <div class="spacing-section">
      <div class="spacing-label">${prefix === 'padding' ? 'Padding' : 'Margin'}</div>
      <div class="spacing-box">
        <div class="spacing-top"><input type="number" class="spacing-input" data-property="${prefix}Top" value="${top}"></div>
        <div class="spacing-left"><input type="number" class="spacing-input" data-property="${prefix}Left" value="${left}"></div>
        <div class="spacing-box-center">${prefix === 'padding' ? 'P' : 'M'}</div>
        <div class="spacing-right"><input type="number" class="spacing-input" data-property="${prefix}Right" value="${right}"></div>
        <div class="spacing-bottom"><input type="number" class="spacing-input" data-property="${prefix}Bottom" value="${bottom}"></div>
      </div>
    </div>
  `
}

function group(title, key, expanded, content) {
  return `
    <div class="group">
      <div class="group-header" data-group="${key}">
        <span class="group-arrow ${expanded ? 'group-arrow--open' : ''}">▶</span>
        <span>${title}</span>
      </div>
      <div class="group-body ${expanded ? 'group-body--open' : ''}">${content}</div>
    </div>
  `
}

export function renderPropertiesPanel(element, expandedGroups) {
  if (!element) {
    return '<div class="props-scroll" style="padding:24px 16px;color:#8f959e;font-size:12px;">点击页面元素开始编辑属性。</div>'
  }

  const styles = readAllStyles(element)

  const colorGroup = group('颜色', 'color', expandedGroups.has('color'), [
    colorRow('背景色', 'backgroundColor', styles.backgroundColor),
    colorRow('文字色', 'color', styles.color),
  ].join(''))

  const spacingGroup = group('间距', 'spacing', expandedGroups.has('spacing'), [
    spacingBox('padding', styles),
    spacingBox('margin', styles),
  ].join(''))

  const borderGroup = group('边框', 'border', expandedGroups.has('border'), [
    numberRow('宽度', 'borderWidth', styles.borderWidth, ['px']),
    colorRow('颜色', 'borderColor', styles.borderColor),
    numberRow('圆角', 'borderRadius', styles.borderRadius, ['px', '%']),
  ].join(''))

  const fontGroup = group('字体', 'font', expandedGroups.has('font'), [
    numberRow('字号', 'fontSize', styles.fontSize, ['px', 'em', 'rem']),
    selectRow('字重', 'fontWeight', styles.fontWeight, [
      { value: '100', label: '100 Thin' },
      { value: '200', label: '200 Light' },
      { value: '300', label: '300' },
      { value: '400', label: '400 Normal' },
      { value: '500', label: '500 Medium' },
      { value: '600', label: '600 Semi' },
      { value: '700', label: '700 Bold' },
      { value: '800', label: '800' },
      { value: '900', label: '900 Black' },
    ]),
    buttonGroupRow('对齐', 'textAlign', styles.textAlign, [
      { value: 'left', label: '左' },
      { value: 'center', label: '中' },
      { value: 'right', label: '右' },
    ]),
  ].join(''))

  const sizeGroup = group('尺寸', 'size', expandedGroups.has('size'), [
    numberRow('宽度', 'width', styles.width),
    numberRow('高度', 'height', styles.height),
  ].join(''))

  const layoutGroup = group('布局', 'layout', expandedGroups.has('layout'), [
    selectRow('Display', 'display', styles.display, [
      { value: 'block', label: 'block' },
      { value: 'flex', label: 'flex' },
      { value: 'grid', label: 'grid' },
      { value: 'inline-block', label: 'inline-block' },
      { value: 'inline', label: 'inline' },
      { value: 'none', label: 'none' },
    ]),
    selectRow('方向', 'flexDirection', styles.flexDirection, [
      { value: 'row', label: 'row' },
      { value: 'column', label: 'column' },
      { value: 'row-reverse', label: 'row-reverse' },
      { value: 'column-reverse', label: 'column-reverse' },
    ]),
    selectRow('主轴', 'justifyContent', styles.justifyContent, [
      { value: 'flex-start', label: 'flex-start' },
      { value: 'center', label: 'center' },
      { value: 'flex-end', label: 'flex-end' },
      { value: 'space-between', label: 'space-between' },
      { value: 'space-around', label: 'space-around' },
      { value: 'space-evenly', label: 'space-evenly' },
    ]),
    selectRow('交叉轴', 'alignItems', styles.alignItems, [
      { value: 'stretch', label: 'stretch' },
      { value: 'flex-start', label: 'flex-start' },
      { value: 'center', label: 'center' },
      { value: 'flex-end', label: 'flex-end' },
      { value: 'baseline', label: 'baseline' },
    ]),
  ].join(''))

  const hasShadow = styles.boxShadow && styles.boxShadow !== 'none'
  const isHidden = styles.display === 'none'
  const effectGroup = group('效果', 'effect', expandedGroups.has('effect'), [
    toggleRow('阴影', 'boxShadow', hasShadow),
    rangeRow('透明度', 'opacity', styles.opacity),
    toggleRow('隐藏', 'hidden', isHidden),
  ].join(''))

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
  `
}
