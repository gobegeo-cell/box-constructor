(function(){
  const iframe = document.getElementById('conf');
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'CONF_HEIGHT') return;
    const h = Math.max(700, Number(e.data.height || 0));
    iframe.style.height = h + 'px';
  });
})();
