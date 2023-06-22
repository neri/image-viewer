
import './style.css';
import { ImageLib, ImageType } from './libimage';

const $ = (x: string) => document.querySelector(x);

const alert = (x: string) => new AlertDialog(x).show();

class App {

    private baseName = 'download';
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

            new MainMenu().dismiss();

            const file = e.dataTransfer?.files[0];
            if (file === undefined) {
                return;
            }
            const name = file.name;
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
                this.loadImage(name, canvas, result);
            });
            reader.readAsArrayBuffer(file);
        }, false);

        ($('#menuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            new MainMenu().show();
        });

        ($('#savePngButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
            if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
                this.exportImage(canvas);
            } else {
                alert("Load the image first.");
            }
        });

        ($('#saveQoiButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.exportEncoded(ImageType.Qoi);
        });

        ($('#saveMpicButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.exportEncoded(ImageType.Mpic);
        });

        ($('#fileLocal') as HTMLInputElement | null)?.addEventListener('change', (e) => {
            const file = ((e.target as HTMLInputElement)?.files ?? [])[0];
            if (file !== null) {
                const name = file.name;
                const reader = new FileReader();
                reader.addEventListener('load', (e) => {
                    const result = e.target?.result;
                    if (result instanceof ArrayBuffer) {
                        const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
                        if (canvas === null) {
                            return;
                        }
                        new MainMenu().dismiss();
                        this.loadImage(name, canvas, result);
                    }
                });
                reader.readAsArrayBuffer(file);
            }
        });

        new MainMenu().show();
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

    updateInfo(name: string, width: number, height: number) {
        const titleText = $('#titleText');
        if (titleText === null) {
            return;
        }
        const startText = $('#startText') as HTMLDivElement;
        if (startText === null) {
            return;
        }
        let baseName = name.split('/').pop() ?? '';
        if (baseName.lastIndexOf(".") != -1) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        }
        this.baseName = baseName;
        if (width > 0 && height > 0) {
            const title = `${baseName} (${width} x ${height})`;
            titleText.innerHTML = title;
            document.title = title;
        }
        startText.style.display = 'none';
    }

    loadImage(name: string, canvas: HTMLCanvasElement, blob: ArrayBuffer) {
        const lib = this.imgLib;
        if (lib.decode(blob)) {
            const { width, height } = lib;
            console.log(`Loaded ${name} via WASM (${width} x ${height}) has_alpha: ${lib.image_has_alpha}`);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx !== null) {
                const imageData = ctx.createImageData(width, height);
                imageData.data.set(lib.image_buffer);
                ctx.putImageData(imageData, 0, 0);
            }
            this.updateInfo(name, width, height);
        } else {
            const img = new Image();
            const imageType = 'image/png';
            img.src = "data:" + imageType + ";base64," + arrayBufferToBase64(blob);
            img.decode().then(() => {
                const { width, height } = img;
                console.log(`Loaded ${name} via IMG (${width} x ${height})`);
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d')?.drawImage(img, 0, 0);
                this.updateInfo(name, width, height);
            }).catch((reason) => {
                alert("Unsupported file type");
                console.log('Decode error', reason);
            });
        }
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

    exportEncoded(type: ImageType) {
        const lib = this.imgLib;
        const { width, height } = lib;
        if (width <= 0 || height <= 0) {
            alert("Load the image first.");
            return;
        }

        const checkSaveAlpha = $('#checkSaveAlpha') as HTMLInputElement | null;
        if (checkSaveAlpha !== null) {
            lib.image_has_alpha = checkSaveAlpha.checked;
        }

        const data = lib.encode(type);
        if (!(data instanceof ArrayBuffer)) {
            alert("ENCODE ERROR");
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
        tag.download = `${this.baseName}.${type.toString()}`;
        tag.click();
    }

    exportImage(canvas: HTMLCanvasElement) {
        const dataUrl = canvas.toDataURL('image/png');
        const tag = document.createElement('a') as HTMLAnchorElement | null;
        if (tag === null) {
            return;
        }
        tag.href = dataUrl;
        tag.download = `${this.baseName}.png`;
        tag.click();
    }
}

const app = new App();

class Dialog {

    private static _lastIndex = 0;
    private static _stack: Dialog[] = [];

    isModal: boolean;
    selector: string;
    outerElement: HTMLElement;
    innerElement: HTMLElement;

    constructor(selector: string, isModal: boolean = true) {
        const outerElement = $(selector) as HTMLElement | null;
        if (outerElement === null) {
            throw new Error(`selector (${selector}) is not found`);
        }
        const innerElement = $(`${selector} .dialogInner`) as HTMLElement | null;
        if (innerElement === null) {
            throw new Error(`selector (${selector} .dialogInner) is not found`);
        }
        this.selector = selector;
        this.outerElement = outerElement;
        this.innerElement = innerElement;
        this.isModal = isModal;

        this.onResetStyle();

        if (this.childElement('.dialogCloseButton') === null) {
            const close = document.createElement('a');
            close.classList.add('button', 'dialogCloseButton');
            close.appendChild(document.createTextNode('\u{2715}'))
            close.addEventListener('click', () => {
                Dialog.dismissTop()
            })
            innerElement.insertBefore(close, innerElement.firstElementChild as HTMLElement);
        }
    }

    onResetStyle() {
        this.innerElement.style.transform = 'translate(-50%, -50%)';
    }

    onShow() { }

    onClose() { }

    show() {
        Dialog.show(this)
    }
    static show(dialog: Dialog) {
        if (dialog.outerElement.style.display === 'block') return;

        if (Dialog._stack.length == 0) {
            Dialog._lastIndex = 100;
        }
        Dialog._stack.push(dialog)
        dialog.outerElement.style.zIndex = "" + (++Dialog._lastIndex)
        dialog.outerElement.style.display = 'block';
        dialog.onShow();
        setTimeout(() => {
            dialog.outerElement.style.backgroundColor = "rgba(0, 0, 0, 0.25)";
        }, 10);
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
    private static _close(dialog: Dialog) {
        dialog.onClose();
        dialog.outerElement.style.backgroundColor = "transparent";
        dialog.onResetStyle();
        setTimeout(() => {
            dialog.outerElement.style.display = 'none';
        }, 300);
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

    childElement(selector: string): HTMLElement | null {
        return $(`${this.selector} ${selector}`) as HTMLElement | null
    }
}

class MainMenu extends Dialog {
    constructor() {
        super('#dialogMainMenu')

        const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
        if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
            app.prepareToExportImage(canvas);
        }
    }
    onResetStyle(): void {
        this.innerElement.style.transform = 'translate(-100%, 0)';
    }
    onShow(): void {
        setTimeout(() => {
            this.innerElement.style.transform = 'translate(0, 0)';
        }, 50);
    }
}

class AlertDialog extends Dialog {
    constructor(message: string, /* options: undefined = undefined */) {
        super('#dialogAlert');

        const alertMessage = ($('#alertMessage') as HTMLElement | null);
        if (alertMessage !== null) {
            alertMessage.innerText = message;
        }
    }
    onResetStyle(): void {
        this.innerElement.style.opacity = '0.0';
        this.innerElement.style.transform = 'translate(-50%, -50%) scale(1.25)';
    }
    onShow(): void {
        setTimeout(() => {
            this.innerElement.style.opacity = '1.0';
            this.innerElement.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }, 50);
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

