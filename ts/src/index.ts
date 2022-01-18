
import './style.css';
import { ImageLib } from './lib';

const $ = (x: string) => document.querySelector(x);

class App {

    constructor() {
        console.log('Hello, world')
    }

    onload() {
        const html = $('html') as HTMLElement | null;
        if (html === null) {
            return;
        }

        html.addEventListener('dragover', (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, false);

        html.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, false);

        html.addEventListener('drop', (_e) => {
            const e = _e as DragEvent;
            e.stopPropagation();
            e.preventDefault();

            const reader = new FileReader();
            reader.addEventListener('load', (e) => {
                const result = e.target?.result ?? '';
                if (typeof result === 'string') {
                    return;
                }
                const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
                if (canvas === null) {
                    return;
                }
                this.loadImage(canvas, result);
            });
            const file = e.dataTransfer?.files[0];
            if (file === undefined) {
                return;
            }
            reader.readAsArrayBuffer(file);
        }, false);

        const exportButton = $('#exportButton') as HTMLButtonElement | null;
        if (exportButton !== null) {
            exportButton.addEventListener('click', () => {
                this.dim();

                const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
                if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
                    const dataUrl = canvas.toDataURL('image/png');
                    console.log('SAVE', canvas.width, canvas.height);
                    // const a = document.createElement('a') as HTMLAnchorElement | null;
                    // if (a !== null) {
                    //     a.href = dataUrl;
                    //     a.download = 'download.png';
                    //     a.click();
                    // }
                }
            });
        }
    }

    private dimCount = 0;
    dim(x = 1) {
        const tag = $('#main') as HTMLDivElement | null;
        if (tag === null) { return; }

        // this.dimCount += x;
        this.dimCount = 1 - this.dimCount;

        if (this.dimCount > 0) {
            tag.classList.add('blur');
        } else {
            tag.classList.remove('blur');
        }
    }

    updateInfo(canvas: HTMLCanvasElement) {
        const infoText = $('#infoText');
        if (infoText === null) {
            return;
        }
        const startText = $('#startText') as HTMLDivElement;
        if (startText === null) {
            return;
        }
        const { width, height } = canvas;
        if (width > 0 && height > 0) {
            infoText.innerHTML = `Dim ${width} x ${height}`;
        } else {
            infoText.innerHTML = '#ERROR';
        }
        startText.style.display = 'none';
    }

    loadImage(canvas: HTMLCanvasElement, blob: ArrayBuffer) {
        const lib = new ImageLib();
        if (lib.decode(blob)) {
            const width = lib.image_width();
            const height = lib.image_height();
            console.log(`LOADED VIA WASM width: ${width} height: ${height} has_alpha: ${lib.image_has_alpha()}`);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx !== null) {
                const imageData = ctx.getImageData(0, 0, width, height);
                imageData.data.set(lib.image_buffer());
                ctx.putImageData(imageData, 0, 0);
            }
            this.updateInfo(canvas);
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
                this.updateInfo(canvas);
            }).catch((reason) => {
                canvas.width = 0;
                canvas.height = 0;
                console.log('DECODE ERROR', reason);
                this.updateInfo(canvas);
            });
        }
    }
}

const app = new App();

function main() {
    app.onload();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
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
