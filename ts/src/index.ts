
import { ImageLib } from './lib';

const $ = (x: string) => document.querySelector(x);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

function main() {
    document.write("<html><head><title>Online Image Viewer</title></head><body>(Drag and Drop file to load image)<br><canvas id='mainCanvas'></canvas></body></html>");

    const html = $('html') as HTMLElement | null;
    if (html !== null) {

        html.addEventListener('dragover', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // if (!this.nowDragging) {
            //     this.nowDragging = true;
            //     this.dimWindow(1);
            // }
        }, false);

        html.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // if (this.nowDragging) {
            //     this.nowDragging = false;
            //     this.dimWindow(-1);
            // }
        }, false);

        html.addEventListener('drop', (_e) => {
            const e = _e as DragEvent;
            e.stopPropagation();
            e.preventDefault();
            // if (this.nowDragging) {
            //     this.nowDragging = false;
            //     this.dimWindow(-1);
            // }
            const reader = new FileReader();
            reader.addEventListener('load', (e) => {
                const result = e.target?.result ?? '';
                if (typeof result !== 'string') {
                    const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
                    if (canvas !== null) {
                        loadImage(canvas, result);
                    }
                } else {
                    console.log('error1');
                }
            });
            const file = e.dataTransfer?.files[0];
            if (file !== undefined) {
                reader.readAsArrayBuffer(file);
            } else {
                console.log('error2');
            }
        }, false);
    }
}

const loadImage = (canvas: HTMLCanvasElement, blob: ArrayBuffer) => {
    const lib = new ImageLib();
    if (lib.decode(blob)) {
        const width = lib.decoded_width();
        const height = lib.decoded_height();
        console.log(`LOADED VIA WASM width: ${width} height: ${height} has_alpha: ${lib.decoded_image_has_alpha()}`);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx !== null) {
            const imageData = ctx.getImageData(0, 0, width, height);
            imageData.data.set(lib.decoded_buffer());
            ctx.putImageData(imageData, 0, 0);
        }
    } else {
        const img = new Image();
        const imageType = 'image/png';
        img.src = "data:" + imageType + ";base64," + arrayBufferToBase64(blob);
        img.decode().then(() => {
            const { width, height } = img;
            console.log(`LOADED VIA IMG width: ${width} height: ${height}`);
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
        }).catch((reason) => {
            console.log('DECODE ERROR', reason);
        });
    }
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let array = [];
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        array.push(String.fromCharCode(bytes[i]));
    }
    return btoa(array.join(''));
}
