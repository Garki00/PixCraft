(function(){
  "use strict";

  /* ---------- 常量配置 ---------- */
  var GRID_SIZE     = 24;
  var MAX_DISPLAY   = 460;
  var PREVIEW_SQUARE = 480;
  var EXPORT_SQUARE  = 720;
  var LEGEND_RATIO   = 560 / 720;
  var BORDER_RATIO   = 0.05;

  /* ---------- 40 色调色板 ---------- */
  var PALETTE = [
    [34,34,34],[180,180,180],[234,231,223],[255,255,255],
    [211,47,54],[156,10,0],[214,12,74],[230,150,141],
    [254,152,117],[247,208,192],[252,239,234],[251,246,232],
    [220,210,200],[226,206,171],[213,99,34],[212,140,66],
    [242,153,0],[249,201,51],[252,228,153],[179,180,122],
    [194,218,114],[108,110,0],[170,139,82],[169,143,116],
    [170,146,40],[63,43,18],[116,73,31],[83,70,88],
    [42,36,70],[57,69,153],[90,69,157],[179,157,207],
    [182,188,223],[169,172,190],[99,171,185],[180,210,220],
    [145,216,230],[71,174,160],[182,211,200],[39,56,100]
  ];

  /* ---------- 元素引用 ---------- */
  var uploadStage  = document.getElementById('uploadStage');
  var cropStage    = document.getElementById('cropStage');
  var resultStage  = document.getElementById('resultStage');

  var dropzone     = document.getElementById('dropzone');
  var fileInput    = document.getElementById('fileInput');

  var cropContainer  = document.getElementById('cropContainer');
  var cropImage      = document.getElementById('cropImage');
  var cropBox        = document.getElementById('cropBox');
  var cropHandle     = document.getElementById('cropHandle');
  var confirmCropBtn = document.getElementById('confirmCropBtn');
  var cancelCropBtn  = document.getElementById('cancelCropBtn');

  var resultCanvas       = document.getElementById('resultCanvas');
  var labelToggle        = document.getElementById('labelToggle');
  var downloadBtn        = document.getElementById('downloadBtn');
  var restartBtn         = document.getElementById('restartBtn');
  var downloadModal      = document.getElementById('downloadModal');
  var modalCloseBtn      = document.getElementById('modalCloseBtn');
  var modalDownloadBtn   = document.getElementById('modalDownloadBtn');
  var modalPreviewCanvas = document.getElementById('modalPreviewCanvas');
  var dlOptions          = document.querySelectorAll('input[name="dlOption"]');

  /* ---------- 高级选项元素 ---------- */
  var advBtn            = document.getElementById('advBtn');
  var advCloseBtn       = document.getElementById('advCloseBtn');
  var advDrawerOverlay  = document.getElementById('advDrawerOverlay');
  var contrastSlider    = document.getElementById('contrastSlider');
  var contrastVal       = document.getElementById('contrastVal');
  var sharpenSlider     = document.getElementById('sharpenSlider');
  var sharpenVal        = document.getElementById('sharpenVal');

  /* ---------- 状态 ---------- */
  var naturalImg = null;
  var dispScale  = 1;
  var labelGrid  = null;
  var lastSx = 0, lastSy = 0, lastSsize = 0;

  var box  = { x: 0, y: 0, size: 0 };
  var drag = null;

  /* ================= 阶段切换 ================= */
  function showStage(stage){
    [uploadStage, cropStage, resultStage].forEach(function(s){
      s.classList.remove('stage--active');
    });
    stage.classList.add('stage--active');
  }

  /* ================= 1. 导入图片 ================= */
  dropzone.addEventListener('click', function(){ fileInput.click(); });

  fileInput.addEventListener('change', function(e){
    if(e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
    fileInput.value = '';
  });

  ['dragenter','dragover'].forEach(function(evt){
    dropzone.addEventListener(evt, function(e){
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.add('dropzone--drag');
    });
  });
  ['dragleave','drop'].forEach(function(evt){
    dropzone.addEventListener(evt, function(e){
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove('dropzone--drag');
    });
  });
  dropzone.addEventListener('drop', function(e){
    var files = e.dataTransfer && e.dataTransfer.files;
    if(files && files[0]) loadFile(files[0]);
  });

  window.addEventListener('dragover', function(e){ e.preventDefault(); });
  window.addEventListener('drop',     function(e){ e.preventDefault(); });

  function loadFile(file){
    if(!file.type || file.type.indexOf('image/') !== 0){
      alert('请选择图片文件');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        naturalImg = img;
        openCropStage();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ================= 2. 裁剪阶段 ================= */
  function openCropStage(){
    cropImage.src = naturalImg.src;
    showStage(cropStage);

    var nw = naturalImg.naturalWidth;
    var nh = naturalImg.naturalHeight;
    var maxDisp = Math.min(MAX_DISPLAY, cropContainer.parentElement.clientWidth || MAX_DISPLAY);
    var scaleToFit = Math.min(1, maxDisp / nw, maxDisp / nh);
    var dispW = Math.round(nw * scaleToFit);
    var dispH = Math.round(nh * scaleToFit);

    cropImage.style.width  = dispW + 'px';
    cropImage.style.height = dispH + 'px';
    cropContainer.style.width  = dispW + 'px';
    cropContainer.style.height = dispH + 'px';

    dispScale = nw / dispW;

    var initSize = Math.round(Math.min(dispW, dispH) * 0.8);
    box.size = initSize;
    box.x = Math.round((dispW - initSize) / 2);
    box.y = Math.round((dispH - initSize) / 2);

    applyBoxStyle();
  }

  function applyBoxStyle(){
    cropBox.style.left   = box.x + 'px';
    cropBox.style.top    = box.y + 'px';
    cropBox.style.width  = box.size + 'px';
    cropBox.style.height = box.size + 'px';
  }

  function clampBox(){
    var dispW = cropContainer.clientWidth;
    var dispH = cropContainer.clientHeight;
    var maxSize = Math.min(dispW, dispH);

    if(box.size > maxSize) box.size = maxSize;
    if(box.size < 20)      box.size = 20;
    if(box.x < 0) box.x = 0;
    if(box.y < 0) box.y = 0;
    if(box.x + box.size > dispW) box.x = dispW - box.size;
    if(box.y + box.size > dispH) box.y = dispH - box.size;
  }

  cropBox.addEventListener('pointerdown', function(e){
    if(e.target === cropHandle) return;
    e.preventDefault();
    drag = { mode:'move', startX:e.clientX, startY:e.clientY, boxX:box.x, boxY:box.y, boxSize:box.size };
    cropBox.setPointerCapture(e.pointerId);
  });

  cropHandle.addEventListener('pointerdown', function(e){
    e.preventDefault();
    e.stopPropagation();
    drag = { mode:'resize', startX:e.clientX, startY:e.clientY, boxX:box.x, boxY:box.y, boxSize:box.size };
    cropHandle.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointermove', function(e){
    if(!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;

    if(drag.mode === 'move'){
      box.x = drag.boxX + dx;
      box.y = drag.boxY + dy;
    } else {
      var delta = Math.max(dx, dy);
      var newSize = drag.boxSize + delta;
      var dW = cropContainer.clientWidth;
      var dH = cropContainer.clientHeight;
      var maxS = Math.min(dW - drag.boxX, dH - drag.boxY);
      box.size = Math.max(20, Math.min(newSize, maxS));
    }
    clampBox();
    applyBoxStyle();
  });

  window.addEventListener('pointerup',     function(){ drag = null; });
  window.addEventListener('pointercancel', function(){ drag = null; });

  cancelCropBtn.addEventListener('click', function(){
    naturalImg = null;
    showStage(uploadStage);
  });

  confirmCropBtn.addEventListener('click', function(){
    if(!naturalImg) return;

    confirmCropBtn.disabled = true;
    var origLabel = confirmCropBtn.textContent;
    confirmCropBtn.textContent = '处理中…';

    setTimeout(function(){
      try{
        var sx    = Math.round(box.x * dispScale);
        var sy    = Math.round(box.y * dispScale);
        var ssize = Math.round(box.size * dispScale);

        sx    = Math.max(0, Math.min(sx,    naturalImg.naturalWidth  - 1));
        sy    = Math.max(0, Math.min(sy,    naturalImg.naturalHeight - 1));
        ssize = Math.max(1, Math.min(ssize, naturalImg.naturalWidth - sx, naturalImg.naturalHeight - sy));

        lastSx = sx; lastSy = sy; lastSsize = ssize;

        labelGrid = computeLabelGrid(naturalImg, sx, sy, ssize);
        labelToggle.checked = false;
        updatePreview();
        showStage(resultStage);
      } catch(err){
        console.error('裁剪处理失败:', err);
        alert('图片处理失败，请重试或更换一张图片。');
      } finally {
        confirmCropBtn.disabled = false;
        confirmCropBtn.textContent = origLabel;
      }
    }, 30);
  });

  /* ================= 颜色工具 ================= */
  var SRGB_TO_LINEAR = new Float64Array(256);
  for(var i = 0; i < 256; i++){
    var c = i / 255;
    SRGB_TO_LINEAR[i] = (c <= 0.04045) ? (c / 12.92) : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c){
    if(c <= 0) return 0;
    if(c >= 1) return 255;
    var v = (c <= 0.0031308) ? (c * 12.92) : (1.055 * Math.pow(c, 1/2.4) - 0.055);
    return v * 255;
  }

  function colorDistRedmean(r1,g1,b1,r2,g2,b2){
    var rm = (r1 + r2) / 2;
    var dr = r1-r2, dg = g1-g2, db = b1-b2;
    return (2 + rm/256)*dr*dr + 4*dg*dg + (2 + (255-rm)/256)*db*db;
  }

  function colorDistEuclidean(r1,g1,b1,r2,g2,b2){
    var dr = r1-r2, dg = g1-g2, db = b1-b2;
    return dr*dr + dg*dg + db*db;
  }

  function rgbToHsl(r,g,b){
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    var l = (mx + mn) / 2;
    if(mx === mn) return [0, 0, l];
    var d = mx - mn;
    var s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    var h;
    if(mx === r)      h = (g - b) / d + (g < b ? 6 : 0);
    else if(mx === g) h = (b - r) / d + 2;
    else              h = (r - g) / d + 4;
    return [h / 6, s, l];
  }

  function colorDistHsl(r1,g1,b1,r2,g2,b2){
    var hsl1 = rgbToHsl(r1,g1,b1);
    var hsl2 = rgbToHsl(r2,g2,b2);
    var dh = hsl1[0] - hsl2[0];
    if(dh > 0.5) dh -= 1;
    if(dh < -0.5) dh += 1;
    var ds = hsl1[1] - hsl2[1];
    var dl = hsl1[2] - hsl2[2];
    return (dh * dh * 4) + (ds * ds) + (dl * dl * 2);
  }

  function rgbToLab(r,g,b){
    var rl = SRGB_TO_LINEAR[r];
    var gl = SRGB_TO_LINEAR[g];
    var bl = SRGB_TO_LINEAR[b];
    var x = rl*0.4124564 + gl*0.3575761 + bl*0.1804375;
    var y = rl*0.2126729 + gl*0.7151522 + bl*0.0721750;
    var z = rl*0.0193339 + gl*0.1191920 + bl*0.9503041;
    x /= 0.95047; z /= 1.08883;
    function f(t){ return t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116); }
    var fx = f(x), fy = f(y), fz = f(z);
    return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
  }

  function colorDistLab(r1,g1,b1,r2,g2,b2){
    var lab1 = rgbToLab(r1,g1,b1);
    var lab2 = rgbToLab(r2,g2,b2);
    var dL = lab1[0]-lab2[0], dA = lab1[1]-lab2[1], dB = lab1[2]-lab2[2];
    return dL*dL + dA*dA + dB*dB;
  }

  function getQuantAlgo(){
    var radios = document.querySelectorAll('input[name="quantAlgo"]');
    for(var i = 0; i < radios.length; i++){
      if(radios[i].checked) return radios[i].value;
    }
    return 'redmean';
  }

  function nearestPaletteIndex(r,g,b){
    var algo = getQuantAlgo();
    var best = 0, bestDist = Infinity;
    for(var k = 0; k < PALETTE.length; k++){
      var p = PALETTE[k];
      var d;
      if(algo === 'euclidean')  d = colorDistEuclidean(r,g,b,p[0],p[1],p[2]);
      else if(algo === 'hsl')   d = colorDistHsl(r,g,b,p[0],p[1],p[2]);
      else if(algo === 'lab')   d = colorDistLab(r,g,b,p[0],p[1],p[2]);
      else                      d = colorDistRedmean(r,g,b,p[0],p[1],p[2]);
      if(d < bestDist){ bestDist = d; best = k; }
    }
    return best;
  }

  /* ================= 缩放算法 ================= */
  function getScaleAlgo(){
    var radios = document.querySelectorAll('input[name="scaleAlgo"]');
    for(var i = 0; i < radios.length; i++){
      if(radios[i].checked) return radios[i].value;
    }
    return 'browser';
  }

  function scaleImageBrowser(img, sx, sy, ssize, targetSize){
    var c = document.createElement('canvas');
    c.width = targetSize; c.height = targetSize;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, ssize, ssize, 0, 0, targetSize, targetSize);
    return ctx.getImageData(0, 0, targetSize, targetSize).data;
  }

  function scaleImageNearest(img, sx, sy, ssize, targetSize){
    var c = document.createElement('canvas');
    c.width = targetSize; c.height = targetSize;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, ssize, ssize, 0, 0, targetSize, targetSize);
    return ctx.getImageData(0, 0, targetSize, targetSize).data;
  }

  function scaleImageProgressive(img, sx, sy, ssize, targetSize){
    // Draw source crop first at native size
    var srcC = document.createElement('canvas');
    srcC.width = ssize; srcC.height = ssize;
    var srcCtx = srcC.getContext('2d');
    srcCtx.drawImage(img, sx, sy, ssize, ssize, 0, 0, ssize, ssize);

    var cur = srcC;
    var curSize = ssize;
    // Halve repeatedly until we are within 2x of target
    while(curSize > targetSize * 2){
      var half = Math.max(targetSize, Math.floor(curSize / 2));
      var tmp = document.createElement('canvas');
      tmp.width = half; tmp.height = half;
      var tCtx = tmp.getContext('2d');
      tCtx.imageSmoothingEnabled = true;
      tCtx.imageSmoothingQuality = 'high';
      tCtx.drawImage(cur, 0, 0, curSize, curSize, 0, 0, half, half);
      cur = tmp;
      curSize = half;
    }
    // Final step to targetSize
    var fin = document.createElement('canvas');
    fin.width = targetSize; fin.height = targetSize;
    var fCtx = fin.getContext('2d');
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.drawImage(cur, 0, 0, curSize, curSize, 0, 0, targetSize, targetSize);
    return fCtx.getImageData(0, 0, targetSize, targetSize).data;
  }

  function scaleImageArea(img, sx, sy, ssize, targetSize){
    // Get source pixels first
    var srcC = document.createElement('canvas');
    srcC.width = ssize; srcC.height = ssize;
    var srcCtx = srcC.getContext('2d');
    srcCtx.drawImage(img, sx, sy, ssize, ssize, 0, 0, ssize, ssize);
    var src = srcCtx.getImageData(0, 0, ssize, ssize).data;

    var dst = new Uint8ClampedArray(targetSize * targetSize * 4);
    var ratio = ssize / targetSize;

    for(var ty = 0; ty < targetSize; ty++){
      for(var tx = 0; tx < targetSize; tx++){
        var x0 = tx * ratio, x1 = (tx + 1) * ratio;
        var y0 = ty * ratio, y1 = (ty + 1) * ratio;
        var rS = 0, gS = 0, bS = 0, w = 0;

        for(var py = Math.floor(y0); py < Math.ceil(y1); py++){
          var wy = Math.min(py + 1, y1) - Math.max(py, y0);
          for(var px = Math.floor(x0); px < Math.ceil(x1); px++){
            var wx = Math.min(px + 1, x1) - Math.max(px, x0);
            var wt = wx * wy;
            var si = (py * ssize + px) * 4;
            rS += src[si]   * wt;
            gS += src[si+1] * wt;
            bS += src[si+2] * wt;
            w  += wt;
          }
        }
        var di = (ty * targetSize + tx) * 4;
        dst[di]   = rS / w;
        dst[di+1] = gS / w;
        dst[di+2] = bS / w;
        dst[di+3] = 255;
      }
    }
    return dst;
  }

  function scaleImage(img, sx, sy, ssize, targetSize){
    var algo = getScaleAlgo();
    if(algo === 'nearest')     return scaleImageNearest(img, sx, sy, ssize, targetSize);
    if(algo === 'progressive') return scaleImageProgressive(img, sx, sy, ssize, targetSize);
    if(algo === 'area')        return scaleImageArea(img, sx, sy, ssize, targetSize);
    return scaleImageBrowser(img, sx, sy, ssize, targetSize);
  }

  /* ================= 取样算法 ================= */
  function getSampleAlgo(){
    var radios = document.querySelectorAll('input[name="sampleAlgo"]');
    for(var i = 0; i < radios.length; i++){
      if(radios[i].checked) return radios[i].value;
    }
    return 'average';
  }

  var GAUSS_KERNEL = [1,2,1,2,4,2,1,2,1]; // 3x3 gaussian (sum=16)

  function sampleGrid(srcData, w, algo){
    var avg = new Float64Array(GRID_SIZE * GRID_SIZE * 3);

    for(var gy = 0; gy < GRID_SIZE; gy++){
      var y0 = Math.floor(gy * w / GRID_SIZE);
      var y1 = Math.floor((gy + 1) * w / GRID_SIZE);
      if(y1 <= y0) y1 = y0 + 1;

      for(var gx = 0; gx < GRID_SIZE; gx++){
        var x0 = Math.floor(gx * w / GRID_SIZE);
        var x1 = Math.floor((gx + 1) * w / GRID_SIZE);
        if(x1 <= x0) x1 = x0 + 1;

        var outIdx = (gy * GRID_SIZE + gx) * 3;

        if(algo === 'center'){
          var cy = Math.floor((y0 + y1) / 2);
          var cx = Math.floor((x0 + x1) / 2);
          var si = (cy * w + cx) * 4;
          avg[outIdx]   = srcData[si];
          avg[outIdx+1] = srcData[si+1];
          avg[outIdx+2] = srcData[si+2];

        } else if(algo === 'gaussian'){
          var ccy = Math.floor((y0 + y1) / 2);
          var ccx = Math.floor((x0 + x1) / 2);
          var rS = 0, gS = 0, bS = 0, wS = 0;
          var ki = 0;
          for(var kdy = -1; kdy <= 1; kdy++){
            for(var kdx = -1; kdx <= 1; kdx++){
              var ky = Math.max(0, Math.min(w-1, ccy + kdy));
              var kx = Math.max(0, Math.min(w-1, ccx + kdx));
              var kw = GAUSS_KERNEL[ki++];
              var ksi = (ky * w + kx) * 4;
              rS += srcData[ksi]   * kw;
              gS += srcData[ksi+1] * kw;
              bS += srcData[ksi+2] * kw;
              wS += kw;
            }
          }
          avg[outIdx]   = rS / wS;
          avg[outIdx+1] = gS / wS;
          avg[outIdx+2] = bS / wS;

        } else if(algo === 'median'){
          var rs = [], gs = [], bs = [];
          for(var py = y0; py < y1; py++){
            var rowS = py * w * 4;
            for(var px = x0; px < x1; px++){
              var idx = rowS + px * 4;
              rs.push(srcData[idx]);
              gs.push(srcData[idx+1]);
              bs.push(srcData[idx+2]);
            }
          }
          rs.sort(function(a,b){return a-b;});
          gs.sort(function(a,b){return a-b;});
          bs.sort(function(a,b){return a-b;});
          var mid = Math.floor(rs.length / 2);
          avg[outIdx]   = rs[mid];
          avg[outIdx+1] = gs[mid];
          avg[outIdx+2] = bs[mid];

        } else { // average
          var rSum = 0, gSum = 0, bSum = 0, count = 0;
          for(var ay = y0; ay < y1; ay++){
            var rowStart = ay * w * 4;
            for(var ax = x0; ax < x1; ax++){
              var aidx = rowStart + ax * 4;
              rSum += srcData[aidx];
              gSum += srcData[aidx+1];
              bSum += srcData[aidx+2];
              count++;
            }
          }
          avg[outIdx]   = rSum / count;
          avg[outIdx+1] = gSum / count;
          avg[outIdx+2] = bSum / count;
        }
      }
    }
    return avg;
  }

  /* ================= 滤镜 ================= */
  function getFilterAlgo(){
    var radios = document.querySelectorAll('input[name="filterAlgo"]');
    for(var i = 0; i < radios.length; i++){
      if(radios[i].checked) return radios[i].value;
    }
    return 'none';
  }

  function applyFilter(data, filter){
    var n = data.length / 3;
    for(var i = 0; i < n; i++){
      var ri = i * 3;
      var r = data[ri], g = data[ri+1], b = data[ri+2];

      if(filter === 'none'){
        // no-op

      } else if(filter === 'grayscale'){
        var gray = 0.299*r + 0.587*g + 0.114*b;
        data[ri] = gray; data[ri+1] = gray; data[ri+2] = gray;

      } else if(filter === 'sepia'){
        data[ri]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
        data[ri+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
        data[ri+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);

      } else if(filter === 'invert'){
        data[ri] = 255-r; data[ri+1] = 255-g; data[ri+2] = 255-b;

      } else if(filter === 'warm'){
        data[ri]   = Math.min(255, r + 30);
        data[ri+1] = Math.min(255, g + 10);
        data[ri+2] = Math.max(0,   b - 20);

      } else if(filter === 'cool'){
        data[ri]   = Math.max(0,   r - 20);
        data[ri+1] = Math.min(255, g + 10);
        data[ri+2] = Math.min(255, b + 30);

      } else if(filter === 'vivid'){
        var gv = 0.299*r + 0.587*g + 0.114*b;
        data[ri]   = Math.min(255, Math.max(0, gv + (r - gv) * 1.6));
        data[ri+1] = Math.min(255, Math.max(0, gv + (g - gv) * 1.6));
        data[ri+2] = Math.min(255, Math.max(0, gv + (b - gv) * 1.6));

      } else if(filter === 'desaturate'){
        var gd = 0.299*r + 0.587*g + 0.114*b;
        data[ri]   = gd + (r - gd) * 0.35;
        data[ri+1] = gd + (g - gd) * 0.35;
        data[ri+2] = gd + (b - gd) * 0.35;

      } else if(filter === 'film'){
        data[ri]   = Math.min(255, r * 0.95 + 10);
        data[ri+1] = Math.min(255, g * 0.9  + 15);
        data[ri+2] = Math.min(255, b * 0.8  + 25);

      } else if(filter === 'sketch'){
        var gs = 0.299*r + 0.587*g + 0.114*b;
        var sk = Math.min(255, Math.max(0, (gs - 128) * 2.5 + 128));
        data[ri] = sk; data[ri+1] = sk; data[ri+2] = sk;

      } else if(filter === 'vintage'){
        data[ri]   = Math.min(255, r * 0.85 + 40);
        data[ri+1] = Math.min(255, g * 0.78 + 30);
        data[ri+2] = Math.min(255, b * 0.55 + 20);

      } else if(filter === 'highcontrast'){
        data[ri]   = Math.min(255, Math.max(0, (r - 128) * 2 + 128));
        data[ri+1] = Math.min(255, Math.max(0, (g - 128) * 2 + 128));
        data[ri+2] = Math.min(255, Math.max(0, (b - 128) * 2 + 128));
      }
    }
  }

  /* ================= 3. 像素化核心 ================= */
  function computeLabelGrid(img, sx, sy, ssize){
    var MAX_SAMPLE_SIZE = 600;
    var midSize = Math.min(ssize, MAX_SAMPLE_SIZE);

    var srcData = scaleImage(img, sx, sy, ssize, midSize);
    var w = midSize;

    var sampleAlgo = getSampleAlgo();
    var avg = sampleGrid(srcData, w, sampleAlgo);

    var filter = getFilterAlgo();
    applyFilter(avg, filter);

    var CONTRAST      = parseFloat(contrastSlider.value);
    var SHARPEN_AMOUNT = parseFloat(sharpenSlider.value);

    // 对比度增强
    for(var n = 0; n < GRID_SIZE * GRID_SIZE; n++){
      for(var ch = 0; ch < 3; ch++){
        var idx3 = n * 3 + ch;
        var v = (avg[idx3] - 128) * CONTRAST + 128;
        avg[idx3] = Math.max(0, Math.min(255, v));
      }
    }

    // 锐化 (unsharp mask on 24x24 grid)
    var blurred = new Float64Array(avg.length);
    for(var by = 0; by < GRID_SIZE; by++){
      for(var bx = 0; bx < GRID_SIZE; bx++){
        var sums = [0,0,0];
        for(var dy = -1; dy <= 1; dy++){
          for(var dx = -1; dx <= 1; dx++){
            var ny = Math.max(0, Math.min(GRID_SIZE-1, by+dy));
            var nx = Math.max(0, Math.min(GRID_SIZE-1, bx+dx));
            var nIdx = (ny * GRID_SIZE + nx) * 3;
            sums[0] += avg[nIdx];
            sums[1] += avg[nIdx+1];
            sums[2] += avg[nIdx+2];
          }
        }
        var bIdx = (by * GRID_SIZE + bx) * 3;
        blurred[bIdx]   = sums[0] / 9;
        blurred[bIdx+1] = sums[1] / 9;
        blurred[bIdx+2] = sums[2] / 9;
      }
    }

    var sharpened = new Uint8ClampedArray(avg.length);
    for(var m = 0; m < avg.length; m++){
      sharpened[m] = avg[m] + SHARPEN_AMOUNT * (avg[m] - blurred[m]);
    }

    // 量化
    var result = new Uint8Array(GRID_SIZE * GRID_SIZE);
    for(var p = 0; p < GRID_SIZE * GRID_SIZE; p++){
      var pIdx = p * 3;
      result[p] = nearestPaletteIndex(sharpened[pIdx], sharpened[pIdx+1], sharpened[pIdx+2]);
    }
    return result;
  }

  /* ================= 4. 渲染 ================= */
  function buildGridCanvas(squareSize, showLabels, showLegend){
    var border  = Math.round(squareSize * BORDER_RATIO);
    var core    = squareSize - border * 2;
    var cell    = core / GRID_SIZE;
    var legendW = showLegend ? Math.round(squareSize * LEGEND_RATIO) : 0;

    var canvas = document.createElement('canvas');
    canvas.width  = squareSize + legendW;
    canvas.height = squareSize;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for(var gy = 0; gy < GRID_SIZE; gy++){
      for(var gx = 0; gx < GRID_SIZE; gx++){
        var pIndex = labelGrid[gy * GRID_SIZE + gx];
        var col = PALETTE[pIndex];
        var cx = border + gx * cell;
        var cy = border + gy * cell;
        ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
        ctx.fillRect(cx, cy, Math.ceil(cell), Math.ceil(cell));

        if(showLabels){
          drawCellLabel(ctx, pIndex + 1, cx + cell/2, cy + cell/2, cell, col);
        }
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    for(var i = 0; i <= GRID_SIZE; i++){
      var pos = Math.round(border + i * cell) + 0.5;
      ctx.beginPath(); ctx.moveTo(pos, border);         ctx.lineTo(pos, border + core); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(border, pos);         ctx.lineTo(border + core, pos); ctx.stroke();
    }

    var centerPos = Math.round(border + (GRID_SIZE / 2) * cell) + 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(centerPos, 0);         ctx.lineTo(centerPos, squareSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, centerPos);         ctx.lineTo(squareSize, centerPos); ctx.stroke();

    if(showLegend) drawLegend(ctx, squareSize, 0, legendW, squareSize);

    return canvas;
  }

  function drawCellLabel(ctx, number, cx, cy, cell, bgColor){
    var lum = 0.299*bgColor[0] + 0.587*bgColor[1] + 0.114*bgColor[2];
    ctx.fillStyle = lum > 150 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
    ctx.font = Math.max(8, cell * 0.42) + 'px -apple-system,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), cx, cy + cell * 0.03);
  }

  function drawLegend(ctx, offsetX, offsetY, w, h){
    var cols = 4;
    var rows = Math.ceil(PALETTE.length / cols);
    var colW = w / cols;
    var rowH = h / rows;
    var pad  = Math.min(colW, rowH) * 0.12;

    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offsetX + 0.5, offsetY);
    ctx.lineTo(offsetX + 0.5, offsetY + h);
    ctx.stroke();

    for(var idx = 0; idx < PALETTE.length; idx++){
      var col  = idx % cols;
      var row  = Math.floor(idx / cols);
      var swX  = offsetX + col * colW + pad;
      var swY  = offsetY + row * rowH + pad;
      var swW  = colW - pad * 2;
      var swH  = rowH - pad * 2;
      var c    = PALETTE[idx];

      ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      ctx.fillRect(swX, swY, swW, swH);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(swX + 0.5, swY + 0.5, swW - 1, swH - 1);
      drawCellLabel(ctx, idx + 1, swX + swW/2, swY + swH/2, Math.min(swW, swH), c);
    }
  }

  function updatePreview(){
    var showLabels = labelToggle.checked;
    var built = buildGridCanvas(PREVIEW_SQUARE, showLabels, showLabels);
    resultCanvas.width  = built.width;
    resultCanvas.height = built.height;
    resultCanvas.getContext('2d').drawImage(built, 0, 0);
  }

  labelToggle.addEventListener('change', updatePreview);

  /* ================= 高级选项 ================= */
  function autoRegen(){
    if(!naturalImg || !lastSsize) return;
    setTimeout(function(){
      try{
        labelGrid = computeLabelGrid(naturalImg, lastSx, lastSy, lastSsize);
        updatePreview();
      } catch(err){ console.error('重新生成失败:', err); }
    }, 30);
  }

  advBtn.addEventListener('click', function(){
    advDrawerOverlay.hidden = false;
  });

  advCloseBtn.addEventListener('click', function(){
    advDrawerOverlay.hidden = true;
  });

  advDrawerOverlay.addEventListener('click', function(e){
    if(e.target === advDrawerOverlay) advDrawerOverlay.hidden = true;
  });

  contrastSlider.addEventListener('input', function(){
    contrastVal.textContent = parseFloat(this.value).toFixed(2);
  });
  contrastSlider.addEventListener('change', autoRegen);

  sharpenSlider.addEventListener('input', function(){
    sharpenVal.textContent = parseFloat(this.value).toFixed(2);
  });
  sharpenSlider.addEventListener('change', autoRegen);

  ['scaleAlgo','sampleAlgo','quantAlgo','filterAlgo'].forEach(function(name){
    document.querySelectorAll('input[name="'+name+'"]').forEach(function(radio){
      radio.addEventListener('change', autoRegen);
    });
  });

  /* ================= 下载 ================= */
  function downloadCanvas(canvas, filename){
    canvas.toBlob(function(blob){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  }

  function buildPixelBitmapCanvas(){
    var canvas = document.createElement('canvas');
    canvas.width  = GRID_SIZE;
    canvas.height = GRID_SIZE;
    var ctx = canvas.getContext('2d');
    for(var gy = 0; gy < GRID_SIZE; gy++){
      for(var gx = 0; gx < GRID_SIZE; gx++){
        var c = PALETTE[labelGrid[gy * GRID_SIZE + gx]];
        ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        ctx.fillRect(gx, gy, 1, 1);
      }
    }
    return canvas;
  }

  function getSelectedDlOption(){
    for(var i = 0; i < dlOptions.length; i++){
      if(dlOptions[i].checked) return dlOptions[i].value;
    }
    return null;
  }

  function updateModalPreview(){
    var val = getSelectedDlOption();
    if(!val) return;
    var built;
    if(val === 'normal'){
      built = buildGridCanvas(PREVIEW_SQUARE, false, false);
      modalPreviewCanvas.classList.remove('pixelated');
    } else if(val === 'labeled'){
      built = buildGridCanvas(PREVIEW_SQUARE, true, true);
      modalPreviewCanvas.classList.remove('pixelated');
    } else {
      built = buildPixelBitmapCanvas();
      modalPreviewCanvas.classList.add('pixelated');
    }
    modalPreviewCanvas.width  = built.width;
    modalPreviewCanvas.height = built.height;
    modalPreviewCanvas.getContext('2d').drawImage(built, 0, 0);
  }

  function openDownloadModal(){
    dlOptions.forEach(function(r){ r.checked = false; });
    modalPreviewCanvas.width  = 0;
    modalPreviewCanvas.height = 0;
    downloadModal.hidden = false;
  }

  function closeDownloadModal(){
    downloadModal.hidden = true;
  }

  downloadBtn.addEventListener('click', openDownloadModal);
  modalCloseBtn.addEventListener('click', closeDownloadModal);
  downloadModal.addEventListener('click', function(e){
    if(e.target === downloadModal) closeDownloadModal();
  });

  dlOptions.forEach(function(radio){
    radio.addEventListener('change', updateModalPreview);
  });

  modalDownloadBtn.addEventListener('click', function(){
    var val = getSelectedDlOption();
    if(!val){ alert('请先选择一个下载选项'); return; }
    if(val === 'normal'){
      downloadCanvas(buildGridCanvas(EXPORT_SQUARE, false, false), 'pixel-avatar-720x720.png');
    } else if(val === 'labeled'){
      downloadCanvas(buildGridCanvas(EXPORT_SQUARE, true, true), 'pixel-avatar-labeled-1280x720.png');
    } else {
      downloadCanvas(buildPixelBitmapCanvas(), 'pixel-avatar-24x24.png');
    }
    closeDownloadModal();
  });

  restartBtn.addEventListener('click', function(){
    naturalImg = null;
    labelGrid  = null;
    showStage(uploadStage);
  });

})();
