// 同步视觉 radio 按钮 ↔ 隐藏的 select（供 options.js 读取）
(function () {
  const select = document.getElementById('themeSelect');
  if (!select) return;

  // radio → select
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', () => {
      select.value = radio.value;
      select.dispatchEvent(new Event('change'));
    });
  });

  // select → radio（options.js 写入 select.value 时同步回来）
  const orig = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(select, 'value', {
    get: () => orig.get.call(select),
    set: (v) => {
      orig.set.call(select, v);
      const radio = document.querySelector(`input[name="theme"][value="${v}"]`);
      if (radio) radio.checked = true;
    }
  });
})();
