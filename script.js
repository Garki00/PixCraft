(function(){
  "use strict";

  /* ---------- 常量配置 ---------- */
  var GRID_SIZE     = 24;    // 24 x 24 像素网格
  var MAX_DISPLAY   = 460;   // 裁剪阶段图片最大显示边长
  var PREVIEW_SQUARE = 480;  // 页面预览方块边长
  var EXPORT_SQUARE  = 720;  // 导出方块边长（720x720 
  var LEGEND_RATIO   = 560 / 720; // 标号版右侧示意图宽度相对主图边长的比例
  var BORDER_RATIO   = 0.05; // 白边
  var CONTRAST       = 1.2;  // 对比度增强系数
  var SHARPEN_AMOUNT = 0.6;  // 锐化强度

  /* ---------- 40 色 ---------- */
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

  var cropContainer = document.getElementById('cropContainer');
  var cropImage     = document.getElementById('cropImage');
  var cropBox       = document.getElementById('cropBox');
  var cropHandle    = document.getElementById('cropHandle');
  var confirmCropBtn = document.getElementById('confirmCropBtn');
  var cancelCropBtn  = document.getElementById('cancelCropBtn');

  var resultCanvas       = document.getElementById('resultCanvas');
  var labelToggle        = document.getElementById('labelToggle');
  var downloadBtn        = document.getElementById('downloadBtn');
  var downloadLabeledBtn = document.getElementById('downloadLabeledBtn');
  var restartBtn         = document.getElementById('restartBtn');

  /* ---------- 状态 ---------- */
  var naturalImg = null;   // 原始 Image 对象
  var dispScale  = 1;      // 显示尺寸 -> 原图尺寸 的比例
  var labelGrid  = null;   // Uint8Array(576)，每格对应调色板下标(0-39)

  var box = { x: 0, y: 0, size: 0 };
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
  window.addEventListener('drop', function(e){ e.preventDefault(); });

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

    cropImage.style.width = dispW + 'px';
    cropImage.style.height = dispH + 'px';
    cropContainer.style.width = dispW + 'px';
    cropContainer.style.height = dispH + 'px';

    dispScale = nw / dispW;

    var initSize = Math.round(Math.min(dispW, dispH) * 0.8);
    box.size = initSize;
    box.x = Math.round((dispW - initSize) / 2);
    box.y = Math.round((dispH - initSize) / 2);

    applyBoxStyle();
  }

  function applyBoxStyle(){
    cropBox.style.left = box.x + 'px';
    cropBox.style.top = box.y + 'px';
    cropBox.style.width = box.size + 'px';
    cropBox.style.height = box.size + 'px';
  }

  function clampBox(){
    var dispW = cropContainer.clientWidth;
    var dispH = cropContainer.clientHeight;
    var maxSize = Math.min(dispW, dispH);

    if(box.size > maxSize) box.size = maxSize;
    if(box.size < 20) box.size = 20;

    if(box.x < 0) box.x = 0;
    if(box.y < 0) box.y = 0;
    if(box.x + box.size > dispW) box.x = dispW - box.size;
    if(box.y + box.size > dispH) box.y = dispH - box.size;
  }

  cropBox.addEventListener('pointerdown', function(e){
    if(e.target === cropHandle) return;
    e.preventDefault();
    drag = { mode: 'move', startX: e.clientX, startY: e.clientY, boxX: box.x, boxY: box.y, boxSize: box.size };
    cropBox.setPointerCapture(e.pointerId);
  });

  cropHandle.addEventListener('pointerdown', function(e){
    e.preventDefault();
    e.stopPropagation();
    drag = { mode: 'resize', startX: e.clientX, startY: e.clientY, boxX: box.x, boxY: box.y, boxSize: box.size };
    cropHandle.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointermove', function(e){
    if(!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;

    if(drag.mode === 'move'){
      box.x = drag.boxX + dx;
      box.y = drag.boxY + dy;
    } else if(drag.mode === 'resize'){
      var delta = Math.max(dx, dy);
      var newSize = drag.boxSize + delta;
      var dispW = cropContainer.clientWidth;
      var dispH = cropContainer.clientHeight;
      var maxSize = Math.min(dispW - drag.boxX, dispH - drag.boxY);
      newSize = Math.max(20, Math.min(newSize, maxSize));
      box.size = newSize;
    }
    clampBox();
    applyBoxStyle();
  });

  window.addEventListener('pointerup', function(){ drag = null; });
  window.addEventListener('pointercancel', function(){ drag = null; });

  cancelCropBtn.addEventListener('click', function(){
    naturalImg = null;
    showStage(uploadStage);
  });

  confirmCropBtn.addEventListener('click', function(){
    if(!naturalImg) return;

    confirmCropBtn.disabled = true;
    var originalLabel = confirmCropBtn.textContent;
    confirmCropBtn.textContent = '处理中…';

    setTimeout(function(){
      try{
        var sx = Math.round(box.x * dispScale);
        var sy = Math.round(box.y * dispScale);
        var ssize = Math.round(box.size * dispScale);

        sx = Math.max(0, Math.min(sx, naturalImg.naturalWidth - 1));
        sy = Math.max(0, Math.min(sy, naturalImg.naturalHeight - 1));
        ssize = Math.max(1, Math.min(ssize, naturalImg.naturalWidth - sx, naturalImg.naturalHeight - sy));

        labelGrid = computeLabelGrid(naturalImg, sx, sy, ssize);
        labelToggle.checked = false;
        updatePreview();
        showStage(resultStage);
      }catch(err){
        console.error('裁剪处理失败:', err);
        alert('图片处理失败，请重试或更换一张图片。');
      }finally{
        confirmCropBtn.disabled = false;
        confirmCropBtn.textContent = originalLabel;
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

  // 感知加权色差
  function colorDist(r1,g1,b1,r2,g2,b2){
    var rmean = (r1 + r2) / 2;
    var dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt((2 + rmean/256) * dr*dr + 4*dg*dg + (2 + (255-rmean)/256) * db*db);
  }

  function nearestPaletteIndex(r,g,b){
    var best = 0, bestDist = Infinity;
    for(var k = 0; k < PALETTE.length; k++){
      var p = PALETTE[k];
      var d = colorDist(r,g,b,p[0],p[1],p[2]);
      if(d < bestDist){ bestDist = d; best = k; }
    }
    return best;
  }

  /* ================= 3. 像素化 ================= */

  var SAMPLE_SIZE = GRID_SIZE * 20; 

  function computeLabelGrid(img, sx, sy, ssize){
    // 1) 缩放
    var midSize = ssize;
    var MAX_SAMPLE_SIZE = 600;
    if (ssize > MAX_SAMPLE_SIZE) {
        midSize = MAX_SAMPLE_SIZE;
    }
    
    var srcCanvas = document.createElement('canvas');
    srcCanvas.width = midSize;
    srcCanvas.height = midSize;
    var srcCtx = srcCanvas.getContext('2d');
    srcCtx.imageSmoothingEnabled = true;
    srcCtx.imageSmoothingQuality = 'high';
    srcCtx.drawImage(img, sx, sy, ssize, ssize, 0, 0, midSize, midSize);
    var srcData = srcCtx.getImageData(0, 0, midSize, midSize).data;
    
  
    var workingSize = midSize;

    // 2)平均
    var avg = new Float64Array(GRID_SIZE * GRID_SIZE * 3);
    for(var gy = 0; gy < GRID_SIZE; gy++){
        var y0 = Math.floor(gy * workingSize / GRID_SIZE);
        var y1 = Math.floor((gy + 1) * workingSize / GRID_SIZE);
        if(y1 <= y0) y1 = y0 + 1;

        for(var gx = 0; gx < GRID_SIZE; gx++){
            var x0 = Math.floor(gx * workingSize / GRID_SIZE);
            var x1 = Math.floor((gx + 1) * workingSize / GRID_SIZE);
            if(x1 <= x0) x1 = x0 + 1;

            var rSum = 0, gSum = 0, bSum = 0, count = 0;
            for(var py = y0; py < y1; py++){
                var rowStart = py * workingSize * 4;
                for(var px = x0; px < x1; px++){
                    var idx = rowStart + px * 4;
                    // 平均
                    rSum += srcData[idx];
                    gSum += srcData[idx + 1];
                    bSum += srcData[idx + 2];
                    count++;
                }
            }

            var outIdx = (gy * GRID_SIZE + gx) * 3;
            avg[outIdx] = rSum / count;
            avg[outIdx + 1] = gSum / count;
            avg[outIdx + 2] = bSum / count;
        }
    }

    // 3) 对比度增强
    for(var n = 0; n < GRID_SIZE * GRID_SIZE; n++){
        for(var ch = 0; ch < 3; ch++){
            var idx3 = n * 3 + ch;
            var v = (avg[idx3] - 128) * CONTRAST + 128;
            avg[idx3] = Math.max(0, Math.min(255, v));
        }
    }

    // 4) 锐化
    var blurred = new Float64Array(avg.length);
    for(var by = 0; by < GRID_SIZE; by++){
        for(var bx = 0; bx < GRID_SIZE; bx++){
            var sums = [0,0,0];
            for(var dy = -1; dy <= 1; dy++){
                for(var dx = -1; dx <= 1; dx++){
                    var ny = Math.max(0, Math.min(GRID_SIZE - 1, by + dy));
                    var nx = Math.max(0, Math.min(GRID_SIZE - 1, bx + dx));
                    var nIdx = (ny * GRID_SIZE + nx) * 3;
                    sums[0] += avg[nIdx];
                    sums[1] += avg[nIdx + 1];
                    sums[2] += avg[nIdx + 2];
                }
            }
            var bIdx = (by * GRID_SIZE + bx) * 3;
            blurred[bIdx]     = sums[0] / 9;
            blurred[bIdx + 1] = sums[1] / 9;
            blurred[bIdx + 2] = sums[2] / 9;
        }
    }

    var sharpened = new Uint8ClampedArray(avg.length);
    for(var m = 0; m < avg.length; m++){
        sharpened[m] = avg[m] + SHARPEN_AMOUNT * (avg[m] - blurred[m]);
    }

    // 5) 量化
    var result = new Uint8Array(GRID_SIZE * GRID_SIZE);
    for(var p = 0; p < GRID_SIZE * GRID_SIZE; p++){
        var pIdx = p * 3;
        result[p] = nearestPaletteIndex(
            sharpened[pIdx], 
            sharpened[pIdx+1], 
            sharpened[pIdx+2]
        );
    }
    return result;
}

  /* ================= 4. 渲染 ================= */

  function buildGridCanvas(squareSize, showLabels, showLegend){
    var border = Math.round(squareSize * BORDER_RATIO);
    var core = squareSize - border * 2;
    var cell = core / GRID_SIZE;
    var legendW = showLegend ? Math.round(squareSize * LEGEND_RATIO) : 0;

    var canvas = document.createElement('canvas');
    canvas.width = squareSize + legendW;
    canvas.height = squareSize;
    var ctx = canvas.getContext('2d');

    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 像素格
    for(var gy = 0; gy < GRID_SIZE; gy++){
      for(var gx = 0; gx < GRID_SIZE; gx++){
        var pIndex = labelGrid[gy * GRID_SIZE + gx];
        var c = PALETTE[pIndex];
        var cx = border + gx * cell;
        var cy = border + gy * cell;
        ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        ctx.fillRect(cx, cy, Math.ceil(cell) , Math.ceil(cell));

        if(showLabels){
          drawCellLabel(ctx, pIndex + 1, cx + cell/2, cy + cell/2, cell, c);
        }
      }
    }

    // 网格线
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    for(var i = 0; i <= GRID_SIZE; i++){
      var pos = Math.round(border + i * cell) + 0.5;

      ctx.beginPath();
      ctx.moveTo(pos, border);
      ctx.lineTo(pos, border + core);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(border, pos);
      ctx.lineTo(border + core, pos);
      ctx.stroke();
    }

    // 十字线
    var centerPos = Math.round(border + (GRID_SIZE / 2) * cell) + 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(centerPos, 0);
    ctx.lineTo(centerPos, squareSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, centerPos);
    ctx.lineTo(squareSize, centerPos);
    ctx.stroke();

    
    if(showLegend){
      drawLegend(ctx, squareSize, 0, legendW, squareSize);
    }

    return canvas;
  }

  function drawCellLabel(ctx, number, cx, cy, cell, bgColor){
    var lum = 0.299*bgColor[0] + 0.587*bgColor[1] + 0.114*bgColor[2];
    ctx.fillStyle = lum > 150 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
    ctx.font = Math.max(8, cell * 0.42) + 'px -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), cx, cy + cell * 0.03);
  }

  function drawLegend(ctx, offsetX, offsetY, w, h){
    var cols = 4;
    var rows = Math.ceil(PALETTE.length / cols);
    var colW = w / cols;
    var rowH = h / rows;
    var pad = Math.min(colW, rowH) * 0.12;

    // 分隔线
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offsetX + 0.5, offsetY);
    ctx.lineTo(offsetX + 0.5, offsetY + h);
    ctx.stroke();

    for(var idx = 0; idx < PALETTE.length; idx++){
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      var swX = offsetX + col * colW + pad;
      var swY = offsetY + row * rowH + pad;
      var swW = colW - pad * 2;
      var swH = rowH - pad * 2;

      var c = PALETTE[idx];
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
    resultCanvas.width = built.width;
    resultCanvas.height = built.height;
    resultCanvas.getContext('2d').drawImage(built, 0, 0);
  }

  labelToggle.addEventListener('change', updatePreview);

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

  downloadBtn.addEventListener('click', function(){
    var canvas = buildGridCanvas(EXPORT_SQUARE, false, false); // 720x720，不带标号
    downloadCanvas(canvas, 'pixel-avatar-720x720.png');
  });

  downloadLabeledBtn.addEventListener('click', function(){
    var canvas = buildGridCanvas(EXPORT_SQUARE, true, true); // 1280x720，带标号+示意图
    downloadCanvas(canvas, 'pixel-avatar-labeled-1280x720.png');
  });

  restartBtn.addEventListener('click', function(){
    naturalImg = null;
    labelGrid = null;
    showStage(uploadStage);
  });

})();
