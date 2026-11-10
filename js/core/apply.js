/* ==========================================================================
   apply.js — menerapkan konfigurasi Admin ke sebuah dokumen (shell / halaman).
   Dipakai bersama oleh index.html, setiap halaman, dan preview Konsol Admin.
   - tokenCss(config)        : CSS variabel warna/font hasil pengaturan
   - setStyle(doc,id,css)    : pasang/ganti <style> khusus
   - TextOverrides(doc,route): mesin ganti nama/teks elemen (tahan render ulang)
   - runScript(code,label,ctx): jalankan skrip kustom dengan aman
   ========================================================================== */
(function(root){
  'use strict';
  function clean(v){v=String(v==null?'':v).trim();return /^[#a-zA-Z0-9(),.%\s-]{1,60}$/.test(v)?v:''}
  function decl(map){var s='';Object.keys(map).forEach(function(k){if(map[k])s+=k+':'+map[k]+';'});return s}

  function tokenCss(c){
    if(!c||!c.colors)return '';
    var col=c.colors,a=col.accents||{},L=col.light||{},D=col.dark||{},f=col.font||{},css='';
    var acc={};['g','yel','red','blu','pink','orange','mint','violet'].forEach(function(k){var v=clean(a[k]);if(v)acc['--'+k]=v});
    var font={};
    if(f.body)font['--fn']=String(f.body).replace(/[;{}<>]/g,'')+',ui-rounded,system-ui,sans-serif';
    if(f.display)font['--ff']=String(f.display).replace(/[;{}<>]/g,'')+',ui-rounded,system-ui,sans-serif';
    if(clean(col.radius))font['--r']=clean(col.radius);
    var top=decl(acc)+decl(font);
    if(top)css+='html:root{'+top+'}\n';
    function theme(t){
      var m={};var bg=clean(t.bg),pa=clean(t.paper),fg=clean(t.fg),mu=clean(t.mut),fi=clean(t.field);
      if(bg)m['--bg']=bg;
      if(pa){m['--paper']=pa;m['--paper-2']='color-mix(in srgb,'+pa+' 88%,'+(fg||'#000')+')'}
      if(fg){m['--fg']=fg;m['--bd']=fg;m['--field-fg']=fg}
      if(mu)m['--mut']=mu;
      if(fi)m['--field']=fi;
      return m;
    }
    var lm=theme(L),dm=theme(D);
    if(clean(L.paper))lm['--hdr-bg']=clean(L.paper);
    if(clean(L.fg)){lm['--hdr-fg']=clean(L.fg);lm['--hdr-line']=clean(L.fg)}
    if(clean(D.fg)){dm['--hdr-fg']=clean(D.fg);dm['--hdr-line']=clean(D.fg)}
    if(clean(D.paper))dm['--live-bg']=clean(D.paper);
    if(clean(L.paper))lm['--live-bg']='color-mix(in srgb,'+clean(L.paper)+' 90%,#000)';
    if(decl(lm))css+='html:root:not([data-theme=dark]){'+decl(lm)+'}\n';
    if(decl(dm))css+='html:root[data-theme=dark]{'+decl(dm)+'}\n';
    return css;
  }

  function setStyle(doc,id,css){
    var el=doc.getElementById(id);
    if(!css){if(el)el.remove();return}
    if(!el){el=doc.createElement('style');el.id=id;(doc.head||doc.documentElement).appendChild(el)}
    else if(el.parentNode&&el!==el.parentNode.lastElementChild){el.parentNode.appendChild(el)}
    if(el.textContent!==css)el.textContent=css;
  }

  /* ---------- penggantian teks/atribut elemen ---------- */
  function TextOverrides(doc,route){
    this.doc=doc;this.route=route||'';this.rules=[];this.track=new Map();this.busy=false;
    this.burst=0;this.burstAt=0;this.paused=false;
    var self=this;
    this.obs=new MutationObserver(function(){if(!self.busy&&!self.paused)self.schedule()});
    setStyle(doc,'ca-hide-style','[data-ca-hide]{display:none!important}');
  }
  TextOverrides.prototype.set=function(rules){
    var r=this.route;
    this.rules=(rules||[]).filter(function(x){return x&&x.on!==false&&x.selector&&(x.route==='*'||!x.route||x.route===r)});
    this.apply();
    if(this.rules.length){this.obs.observe(this.doc.documentElement,{childList:true,subtree:true,characterData:true})}
    else this.obs.disconnect();
  };
  TextOverrides.prototype.schedule=function(){
    var self=this;clearTimeout(this.t);
    this.t=setTimeout(function(){
      var now=Date.now();if(now-self.burstAt>1000){self.burstAt=now;self.burst=0}
      if(++self.burst>25){self.paused=true;setTimeout(function(){self.paused=false},2000);return}
      self.apply();
    },60);
  };
  function key(prop){return prop}
  TextOverrides.prototype.apply=function(){
    var self=this,doc=this.doc,want=new Map();
    this.busy=true;
    try{
      this.rules.forEach(function(rule){
        var els;try{els=doc.querySelectorAll(rule.selector)}catch(_){return}
        Array.prototype.forEach.call(els,function(el){
          var m=want.get(el);if(!m){m={};want.set(el,m)}m[key(rule.prop||'text')]=rule.value==null?'':String(rule.value);
        });
      });
      /* kembalikan elemen yang tidak lagi ditarget */
      this.track.forEach(function(orig,el){
        var m=want.get(el)||{};
        Object.keys(orig).forEach(function(p){if(!(p in m)){restore(el,p,orig[p]);delete orig[p]}});
        if(!Object.keys(orig).length)self.track.delete(el);
      });
      want.forEach(function(m,el){
        var orig=self.track.get(el);if(!orig){orig={};self.track.set(el,orig)}
        Object.keys(m).forEach(function(p){
          if(!(p in orig))orig[p]=snapshot(el,p);
          put(el,p,m[p],orig);
        });
      });
    }finally{
      var s=this;setTimeout(function(){s.busy=false},0);
    }
  };
  function snapshot(el,p){
    switch(p){
      case 'text':return el.textContent;
      case 'html':return el.innerHTML;
      case 'hide':return null;
      case 'style':return el.getAttribute('style');
      case 'value':return el.value;
      default:return el.getAttribute(p);
    }
  }
  function put(el,p,v,orig){
    switch(p){
      case 'text':if(el.textContent!==v)el.textContent=v;break;
      case 'html':if(el.__caHtml!==v||el.innerHTML!==el.__caNorm){el.innerHTML=v;el.__caHtml=v;el.__caNorm=el.innerHTML}break;
      case 'hide':if(v==='0'||v==='false'){el.removeAttribute('data-ca-hide')}else if(!el.hasAttribute('data-ca-hide'))el.setAttribute('data-ca-hide','');break;
      case 'style':var base=orig.style||'';var nv=(base?base.replace(/;?\s*$/,';'):'')+v;if(el.getAttribute('style')!==nv)el.setAttribute('style',nv);break;
      case 'value':if(el.value!==v&&doc_active(el)){el.value=v;try{el.dispatchEvent(new Event('input',{bubbles:true}))}catch(_){}}break;
      default:if(el.getAttribute(p)!==v)el.setAttribute(p,v);
    }
  }
  function doc_active(el){return el.ownerDocument.activeElement!==el}
  function restore(el,p,o){
    switch(p){
      case 'text':el.textContent=o==null?'':o;break;
      case 'html':el.innerHTML=o==null?'':o;break;
      case 'hide':el.removeAttribute('data-ca-hide');break;
      case 'style':if(o==null)el.removeAttribute('style');else el.setAttribute('style',o);break;
      case 'value':break;
      default:if(o==null)el.removeAttribute(p);else el.setAttribute(p,o);
    }
  }

  function runScript(code,label,ctx,onError){
    if(!code||!String(code).trim())return true;
    try{(new Function('CA','config','document','window',String(code)+'\n//# sourceURL=ca-custom-'+label+'.js'))(ctx&&ctx.CA,ctx&&ctx.config,document,window);return true}
    catch(e){console.error('[Skrip kustom '+label+']',e);if(onError)onError(e);return false}
  }

  /* CSS lengkap untuk satu rute: token + CSS semua halaman + CSS halaman */
  function pageCss(c,route){
    if(!c)return '';
    var parts=[tokenCss(c)];
    if(c.css){if(c.css.all)parts.push('/* semua halaman */\n'+c.css.all);if(c.css.pages&&c.css.pages[route])parts.push('/* '+route+' */\n'+c.css.pages[route])}
    return parts.filter(Boolean).join('\n');
  }

  root.CAApply={tokenCss:tokenCss,pageCss:pageCss,setStyle:setStyle,TextOverrides:TextOverrides,runScript:runScript};
})(window);
