
import './style.css';
import { ImageLib } from './lib';

const $ = (x: string) => document.querySelector(x);

class App {

    private imgLib: ImageLib;

    constructor() {
        this.imgLib = new ImageLib();
    }

    onload() {
        const html = $('html') as HTMLElement | null;
        if (html === null) {
            return;
        }

        html.addEventListener('dragover', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!this.isDraging) {
                this.isDraging = true;
                this.dim();
            }
        }, false);

        html.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this.isDraging) {
                this.isDraging = false;
                this.dim(-1);
            }
        }, false);

        html.addEventListener('drop', (_e) => {
            const e = _e as DragEvent;
            e.stopPropagation();
            e.preventDefault();
            if (this.isDraging) {
                this.isDraging = false;
                this.dim(-1);
            }

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

        ($('#quickExportButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
            if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
                this.quickExport(canvas);
            }
        });

        document.querySelectorAll('.dialogCloseButton').forEach(button => {
            button.addEventListener('click', () => {
                Dialog.dismissTop()
            })
        });

        ($('#menuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
            if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
                this.prepareToExportImage(canvas);
                new SaveAsDialog().show();
            }
        });

        ($('#savePngButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
            if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
                this.exportImage(canvas);
            }
        });

        ($('#saveQoiButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.exportEncoded();
        });
    }

    private isDraging = false;

    private dimCount = 0;
    dim(x = 1) {
        const tag = $('#main') as HTMLDivElement | null;
        if (tag === null) { return; }

        this.dimCount += x;

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
            infoText.innerHTML = `${width} x ${height}`;
        } else {
            infoText.innerHTML = '#ERROR';
        }
        startText.style.display = 'none';
    }

    loadImage(canvas: HTMLCanvasElement, blob: ArrayBuffer) {
        const lib = this.imgLib;
        if (lib.decode(blob)) {
            const { width, height } = lib;
            console.log(`LOADED VIA WASM width: ${width} height: ${height} has_alpha: ${lib.image_has_alpha}`);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx !== null) {
                const imageData = ctx.getImageData(0, 0, width, height);
                imageData.data.set(lib.image_buffer);
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

    quickExport(canvas: HTMLCanvasElement) {
        this.prepareToExportImage(canvas);
        this.exportEncoded();
    }

    prepareToExportImage(canvas: HTMLCanvasElement) {
        const lib = this.imgLib;
        const { width, height } = canvas;
        const ctx = canvas.getContext('2d');
        if (ctx === null) {
            return;
        }
        const imgData = ctx.getImageData(0, 0, width, height);
        lib.set_image_buffer(imgData.data, width, height);

        const checkSaveAlpha = $('#checkSaveAlpha') as HTMLInputElement | null;
        if (checkSaveAlpha !== null) {
            checkSaveAlpha.checked = lib.image_has_alpha;
        }
    }

    exportEncoded() {
        const lib = this.imgLib;
        const data = lib.encode();
        if (data === null) {
            console.log('encode error');
            return;
        }

        const blob = new Blob([data], { type: "application/octet-stream" });
        const dataUrl = URL.createObjectURL(blob);
        const tag = document.createElement('a') as HTMLAnchorElement | null;
        if (tag === null) {
            return;
        }
        tag.href = dataUrl;
        tag.download = 'download.qoi';
        tag.click();
    }

    exportImage(canvas: HTMLCanvasElement) {
        const dataUrl = canvas.toDataURL('image/png');
        const tag = document.createElement('a') as HTMLAnchorElement | null;
        if (tag === null) {
            return;
        }
        tag.href = dataUrl;
        tag.download = 'download.png';
        tag.click();
    }
}

const app = new App();



class Dialog {

    selector: string;
    element: HTMLElement;

    constructor(selector: string) {
        const element = $(selector) as HTMLElement | null;
        if (element === null) {
            throw new Error(`selector ${selector} is not found`);
        }
        this.selector = selector;
        this.element = element;
    }

    private static _lastIndex = 0;
    private static _stack: Dialog[] = [];

    onclose() { }

    show() {
        Dialog.show(this)
    }
    static show(dialog: Dialog) {
        if (dialog.element.style.display === 'block') return;
        app.dim(1);

        if (Dialog._stack.length == 0) {
            Dialog._lastIndex = 100;
        }
        Dialog._stack.push(dialog)
        dialog.element.style.zIndex = "" + (++Dialog._lastIndex)
        dialog.element.style.display = 'block';
    }
    dismiss() {
        Dialog.dismiss(this)
    }
    static dismiss(dialog: Dialog) {
        Dialog._stack = Dialog._stack.filter(value => {
            if (value.selector === dialog.selector) {
                this._close(value)
                return false;
            } else {
                return true;
            }
        })
    }
    static _close(dialog: Dialog) {
        app.dim(-1);
        dialog.element.style.display = 'none';
        dialog.onclose()
    }
    static dismissAll() {
        while (Dialog._stack.length > 0) {
            this.dismissTop()
        }
    }
    static dismissTop() {
        const top = Dialog._stack.pop();
        if (top !== undefined) {
            this._close(top);
        }
    }
}

class SaveAsDialog extends Dialog {
    constructor() {
        super('#dialogSaveAs')
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.onload);
} else {
    app.onload();
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
