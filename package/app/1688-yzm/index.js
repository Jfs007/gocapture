!function () {

    console.log('================ 你好，1688 ================');

    const detectObjectEdges = (input) => {
        return new Promise((resolve, reject) => {
            const processPixels = (pixels, width, height) => {
                const getPixel = (x, y) => {
                    const index = (y * width + x) * 4;
                    return {
                        r: pixels[index],
                        g: pixels[index + 1],
                        b: pixels[index + 2],
                        a: pixels[index + 3]
                    };
                };
                
                const isBackground = (pixel) => {
                    const brightness = (pixel.r + pixel.g + pixel.b) / 3;
                    return brightness > 200 && Math.abs(pixel.r - pixel.g) < 20 && Math.abs(pixel.g - pixel.b) < 20;
                };
                
                const visited = new Array(height).fill(null).map(() => new Array(width).fill(false));
                const objects = [];
                
                const floodFill = (startX, startY) => {
                    const queue = [[startX, startY]];
                    const objectPixels = [];
                    let minX = startX, maxX = startX;
                    
                    while (queue.length > 0) {
                        const [x, y] = queue.shift();
                        
                        if (x < 0 || x >= width || y < 0 || y >= height) continue;
                        if (visited[y][x]) continue;
                        
                        const pixel = getPixel(x, y);
                        if (isBackground(pixel)) continue;
                        
                        visited[y][x] = true;
                        objectPixels.push([x, y]);
                        
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        
                        queue.push([x + 1, y]);
                        queue.push([x - 1, y]);
                        queue.push([x, y + 1]);
                        queue.push([x, y - 1]);
                    }
                    
                    return objectPixels.length > 50 ? { minX, maxX, pixelCount: objectPixels.length } : null;
                };
                
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (!visited[y][x] && !isBackground(getPixel(x, y))) {
                            const obj = floodFill(x, y);
                            if (obj) {
                                objects.push(obj);
                            }
                        }
                    }
                }
                
                objects.sort((a, b) => a.minX - b.minX);
                
                resolve({
                    objects: objects,
                    imageWidth: width,
                    imageHeight: height
                });
            };
            
            if (typeof input === 'string') {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    processPixels(imageData.data, canvas.width, canvas.height);
                };
                img.onerror = reject;
                img.src = input;
            } else if (input.tagName === 'CANVAS') {
                const ctx = input.getContext('2d');
                const imageData = ctx.getImageData(0, 0, input.width, input.height);
                processPixels(imageData.data, input.width, input.height);
            } else {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = input.width || input.naturalWidth;
                canvas.height = input.height || input.naturalHeight;
                ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                processPixels(imageData.data, canvas.width, canvas.height);
            }
        });
    };

    setTimeout(async () => {
        const el = document.querySelector('#scratch-captcha-btn');
        if(!el) return;
        
        // 模拟鼠标按下
        el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 66 }));
        // 模拟滑动位置 370 用于调整
        // document.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 }));
        return;
        const captchaCanvas = document.querySelector('#captcha-answer');
        if (captchaCanvas) {
            const result = await detectObjectEdges(captchaCanvas);
            console.log('检测到的物品边界:', result);
            
            result.objects.forEach((obj, index) => {
                console.log(`物品 ${index + 1}: 左边界 x=${obj.minX}, 右边界 x=${obj.maxX}, 宽度=${obj.maxX - obj.minX}`);
            });
        }
    }, 2000);

}();