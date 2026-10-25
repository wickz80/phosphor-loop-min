'use strict';
window.PhosphorDependencies = (() => {
  const FEEDBACK = new Set(['zoom','spin','color','warp','flow','melt','push','dye','grow','lookup','chase','breathe','chroma','restless','julia','crystal','blur']);
  function reason(id, {loop={},audio=false,route=null,video={}}={}) {
    if(['videoShadowHue','videoHighlightHue'].includes(id) && !(video.videoGradient>0))return 'Requires Gradient mix above 0 in the global Video section.';
    if(FEEDBACK.has(id) && !(loop.trails > 0))return 'Requires Trails above 0. This effect modifies previous frames, not the incoming texture or 3D camera.';
    if(id==='blend' && (!loop.in2 || loop.in2==='none'))return 'Choose a second input before adjusting Blend.';
    if(id==='size' && loop.in1==='none' && (!loop.in2 || loop.in2==='none'))return 'Choose an input other than Nothing before adjusting Input size.';
    if(id==='sndAmt' && !audio)return 'Share audio before adjusting the music-response amount.';
    if(route && route.effect==='none')return 'Choose an effect for this music mapping first.';
    if(route && !audio)return 'Share audio before adjusting music-mapping strength.';
    return '';
  }
  function help(id) {
    if(FEEDBACK.has(id))return 'Requires Trails above 0; modifies accumulated feedback rather than the incoming texture.';
    return '';
  }
  function normalizeScene(scene) {
    if(!(scene.trails>0))for(const id of FEEDBACK)if(id in scene)scene[id]=0;
    if(!scene.in2||scene.in2==='none')scene.blend=0;
    return scene;
  }
  function create({root,getState}) {
    const controls=[...root.querySelectorAll('.minimal-section input[type="range"]')];
    function update() {
      for(const el of controls) {
        const why=reason(el.id,getState(el));
        if(el.disabled!==!!why)el.disabled=!!why;
        if(el.dataset.dependencyReason!==why) {
          el.title=why;
          if(why)el.setAttribute('aria-description',why);else el.removeAttribute('aria-description');
          el.dataset.dependencyReason=why;
          el.dataset.dependencyHelp=why ? 'Unavailable: '+why : help(el.id);
        }
        const ctl=el.closest('.ctl') || el.closest('.music-route') || el.closest('.vcr');
        if(ctl && ctl.classList.contains('dependency-disabled')!==!!why)ctl.classList.toggle('dependency-disabled',!!why);
        const wrapper=el.closest('.lfo-slider');
        if(wrapper)for(const tick of wrapper.querySelectorAll('.lfo-bound'))tick.disabled=!!why;
        const lfo=(wrapper?.previousElementSibling?.classList.contains('lfo-control') ? wrapper.previousElementSibling : null)
          || (el.closest('.music-strength, .vcr-time')?.previousElementSibling?.classList.contains('lfo-control') ? el.closest('.music-strength, .vcr-time').previousElementSibling : null);
        if(lfo) {
          const check=ctl?.querySelector('.lfo-toggle input') || lfo.querySelector('input[type="checkbox"]');
          if(check)check.disabled=!!why && !check.checked;
          for(const select of lfo.querySelectorAll('select'))select.disabled=!!why;
          lfo.classList.toggle('dependency-disabled',!!why);
        }
      }
    }
    update();return {update};
  }
  return {FEEDBACK,reason,help,normalizeScene,create};
})();
