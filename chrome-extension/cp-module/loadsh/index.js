

!function () {
    function simulateInput(selector, value) {
        const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!input) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function base64ToFile(base64, fileName) {
        const arr = base64.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], fileName, { type: mime });
    }

    function simulateUpload(uploader, opts = []) {
        const dt = new DataTransfer();
        opts.map(opt => {
            const { name, blob } = opt;
            const file = new File([blob], name, { type: blob.type });
            dt.items.add(file);
        });
        // 你的 base64 字符串
        uploader.files = dt.files;
        uploader.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function imageToBlob(url) {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous' // 关键点
            img.src = url
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(blob)
                    } else {
                        reject(new Error('Canvas toBlob failed'))
                    }
                }, 'image/jpeg')
            }
            img.onerror = (error) => {

                reject(new Error('Image load error'))
            }
        })
    }

    function getProperty(obj, name) {
        name = Array.isArray(name) ? [...name] : (name + '').split(".");
        for (var i = 0; i < name.length - 1; i++) {
            obj = obj[name[i]];
            if (typeof obj !== "object" || !obj) return;
        }
        return obj[name.pop()];
    }
    function showToast(options = {}, callback = () => { }) {
        let { message, duration, position } = options;
        duration = duration || 1500;
        const existing = document.getElementById('lddui-top-tip-toast');
        if (existing) existing.remove(); // 移除旧的提示
        const tip = document.createElement('div');
        tip.id = 'lddui-top-tip-toast';
        tip.innerText = message;
        // 样式设置
        Object.assign(tip.style, {
            position: 'fixed',
            top: position ? position.top : '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            zIndex: 999999999,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            transition: 'opacity 0.3s ease',
            opacity: '1'
        });
        document.body.appendChild(tip);
        if (duration == -1) return;
        // 自动移除
        setTimeout(() => {
            tip.style.opacity = '0';
            setTimeout(() => {
                tip.remove();
                callback && callback()
            }, 300); // 等待动画结束后移除
        }, duration);
    }
    _exports.module['mdLoadsh'] = {
        showToast,
        getProperty,
        simulateInput,
        base64ToFile,
        simulateUpload,
        imageToBlob
    }
}()