'use strict';
window.PhosphorControlHelp = (() => {
  const clean = text => text.replace(/\s+/g,' ').trim();
  const normalize = text => clean(text).toLowerCase().replace(/[^a-z0-9]+/g,' ');
  function setup(panel) {
    const doc=panel.ownerDocument, sources=new Map();
    const guide=[...doc.querySelectorAll('.guide dt')].map(term=>({
      name:normalize(term.textContent),text:clean(term.nextElementSibling?.textContent||'')
    }));
    const labelFor=id=>doc.querySelector(`label[for="${id}"]`) || doc.getElementById(id);
    const add=(target,source)=>{
      if(!target)return;
      if(!sources.has(target))sources.set(target,[]);
      sources.get(target).push(source);
    };
    const aliases={sndAmt:'Amount',apEvery:'New look every',apFade:'Fade time',apWild:'How wild'};
    for(const control of panel.querySelectorAll('.minimal-section .ctl')) {
      const range=control.querySelector('input[type="range"]');
      const label=control.querySelector('.ctl-head label, .ctl-head .lbl, :scope > .lbl');
      if(!label)continue;
      if(range)add(label,()=>range.dataset.dependencyHelp || '');
      const name=normalize(aliases[range?.id]||label.textContent);
      const entry=guide.find(entry=>entry.name===name) || guide.find(entry=>name.length>=4 && (' '+entry.name+' ').includes(' '+name+' '));
      if(entry?.text)add(label,()=>entry.text);
      for(const hint of control.querySelectorAll(':scope > .hint')) {
        if(hint.querySelector('button,a,input,select') || hint.matches('[role="status"],[role="alert"]'))continue;
        add(label,()=>clean(hint.textContent));hint.hidden=true;
      }
      const ends=control.querySelector(':scope > .ends');
      if(ends){add(label,()=>clean([...ends.children].map(child=>child.textContent).join(' → ')));ends.hidden=true;}
    }
    const mapped=[
      ['Click Share audio', 'connectAudio'],['No installation needed.', 'connectAudio'],
      ['Edit one loop', 'view'],['Plain textures', 'sceneSelect'],['Loaded pictures', 'sceneSelect'],
      ['In 3D, Input size', 'size'],['Your look and autopilot', 'autopilot'],
    ];
    for(const hint of panel.querySelectorAll('.hint')) {
      if(hint.closest('#legacyControls') || hint.id==='localPreviewNotice' || hint.id==='hiddenHint' || /Status$/.test(hint.id) || hint.id==='vidLoopText' || hint.matches('[role="status"],[role="alert"]') || hint.querySelector('button,a,input,select'))continue;
      if(hint.hidden)continue;
      let target;
      if(hint.id==='sharpNote')target=labelFor('pictureSharpness');
      else if(hint.closest('#musicMappings'))target=doc.querySelector('#musicMappings summary');
      else {
        const match=mapped.find(([prefix])=>clean(hint.textContent).startsWith(prefix));
        if(match)target=labelFor(match[1]);
        else if(hint.closest('.dev'))target=labelFor('sceneSelect');
      }
      if(target){add(target,()=>clean(hint.textContent));hint.hidden=true;}
    }
    // Guide entries for non-slider features stay beside their actual control.
    for(const [id,name] of [['autopilot','Autopilot'],['neutral','Neutral'],['sceneSelect','Wave, Shape, Bars, Sparks, Ink, 3D world, Fractals']]) {
      const entry=guide.find(entry=>entry.name===normalize(name));
      if(entry?.text)add(labelFor(id),()=>entry.text);
    }
    const tooltip=doc.createElement('div');tooltip.id='controlTooltip';tooltip.className='control-tooltip';tooltip.role='tooltip';tooltip.hidden=true;doc.body.appendChild(tooltip);
    let active=null;
    const hide=()=>{if(active)active.removeAttribute('aria-describedby');active=null;tooltip.hidden=true;};
    function show(button,getText) {
      const text=[...new Set(getText.map(read=>read()).filter(Boolean))].join('\n\n');
      if(!text)return;
      hide();active=button;tooltip.textContent=text;tooltip.hidden=false;button.setAttribute('aria-describedby',tooltip.id);
      const rect=button.getBoundingClientRect();
      tooltip.style.left=Math.max(8,Math.min(rect.left,innerWidth-tooltip.offsetWidth-8))+'px';
      tooltip.style.top=(rect.bottom+tooltip.offsetHeight+12<innerHeight?rect.bottom+6:Math.max(8,rect.top-tooltip.offsetHeight-6))+'px';
    }
    function bindHover(trigger,readers) {
      trigger.addEventListener('pointerenter',()=>show(trigger,readers));
      trigger.addEventListener('pointerleave',()=>{hide();});
      trigger.addEventListener('focusin',()=>show(trigger,readers));
      trigger.addEventListener('focusout',hide);
    }
    for(const [target,readers]of sources) {
      const isButton=target.matches('button');
      const trigger=isButton ? target : doc.createElement('button');
      if(!isButton) {
        trigger.type='button';trigger.className='control-help';trigger.textContent='?';
        trigger.setAttribute('aria-label','About '+clean(target.textContent));
        target.insertAdjacentElement('afterend',trigger);
        if(target.closest('.ctl-head') || target.matches('.ctl > .lbl')) {
          const group=doc.createElement('span');group.className='control-label';
          target.insertAdjacentElement('beforebegin',group);group.append(target,trigger);
        }
      } else if(target.title) {
        const existing=target.title;readers.unshift(()=>existing);target.removeAttribute('title');
      }
      const actions=target.closest('.slider-controls')?.querySelector('.slider-actions');
      if(actions&&!isButton) {
        const glyph=doc.createElement('span');glyph.className='slider-action-glyph';
        glyph.setAttribute('aria-hidden','true');glyph.textContent=trigger.textContent;trigger.replaceChildren(glyph);
        actions.insertBefore(trigger,actions.querySelector('output'));
      } else if(!isButton) {
        let group=target.closest('.control-label');
        if(!group) {
          group=doc.createElement('span');group.className='control-label';
          target.insertAdjacentElement('beforebegin',group);group.append(target,trigger);
        }
        group.classList.add('control-heading');
      }
      bindHover(trigger,readers);
      if(!isButton)trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();show(trigger,readers);});
    }
    for(const trigger of panel.querySelectorAll('.minimal-section .mini-reset, .minimal-section .lfo-toggle')) {
      const text=trigger.matches('.lfo-toggle')?'LFO':'Reset';
      trigger.removeAttribute('title');trigger.querySelector('input')?.removeAttribute('title');
      if(trigger.matches('.mini-reset')&&!trigger.querySelector('.slider-action-glyph')) {
        const glyph=doc.createElement('span');glyph.className='slider-action-glyph';glyph.setAttribute('aria-hidden','true');
        glyph.textContent=trigger.textContent;trigger.replaceChildren(glyph);
      }
      bindHover(trigger,[()=>text]);
    }
    doc.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
    doc.addEventListener('pointerdown',event=>{if(active&&!active.contains(event.target))hide();});
    doc.addEventListener('scroll',event=>{if(event.target!==tooltip)hide();},true);window.addEventListener('resize',hide);
  }
  return {setup};
})();
