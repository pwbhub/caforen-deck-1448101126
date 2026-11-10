/* ==========================================================================
   sha256.js — implementasi SHA-256 murni (sinkron), bekerja di file:// maupun
   http(s) tanpa bergantung pada crypto.subtle (yang tidak selalu tersedia).
   CASha256.hex(string) → hash heksadesimal 64 karakter (input di-encode UTF-8).
   ========================================================================== */
(function(root){
  'use strict';
  var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function utf8(str){
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(str);
    var s=unescape(encodeURIComponent(str)),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;
  }
  function hex(str){
    var msg=utf8(String(str)),len=msg.length,bitLenHi=Math.floor(len/0x20000000),bitLenLo=(len<<3)>>>0;
    var total=((len+9+63)>>6)<<6,buf=new Uint8Array(total);buf.set(msg);buf[len]=0x80;
    var dv=new DataView(buf.buffer);dv.setUint32(total-8,bitLenHi);dv.setUint32(total-4,bitLenLo);
    var h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    var w=new Uint32Array(64);
    for(var off=0;off<total;off+=64){
      for(var t=0;t<16;t++)w[t]=dv.getUint32(off+t*4);
      for(t=16;t<64;t++){
        var x=w[t-15],y=w[t-2];
        var s0=((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3);
        var s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);
        w[t]=(w[t-16]+s0+w[t-7]+s1)>>>0;
      }
      var a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for(t=0;t<64;t++){
        var S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
        var ch=(e&f)^(~e&g);
        var t1=(h+S1+ch+K[t]+w[t])>>>0;
        var S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
        var mj=(a&b)^(a&c)^(b&c);
        var t2=(S0+mj)>>>0;
        h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(function(v){return ('00000000'+v.toString(16)).slice(-8)}).join('');
  }
  /* penurunan kunci berulang (key stretching) agar hash tidak mudah ditebak */
  function stretch(secret,salt,rounds){
    var h=hex(salt+'::'+secret);
    for(var i=0;i<rounds;i++)h=hex(h+'|'+salt+'|'+i);
    return h;
  }
  function randomHex(bytes){
    var a=new Uint8Array(bytes||16);
    try{(root.crypto||root.msCrypto).getRandomValues(a)}catch(_){for(var i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256)}
    return Array.prototype.map.call(a,function(b){return ('0'+b.toString(16)).slice(-2)}).join('');
  }
  root.CASha256={hex:hex,stretch:stretch,randomHex:randomHex};
})(typeof window!=='undefined'?window:globalThis);
