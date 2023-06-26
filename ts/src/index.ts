
import './style.css';
import { ImageLib, ImageType, Interpolation } from './libimage';

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

        ($('#cropMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                Dialog.dismissAll();
                new CropDialog().show();
            }
        });

        ($('#cropExecButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.performCrop();
            }
        });

        ($('#cropResetButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.snapshotRestore();
        });

        ($('#cropCenterButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = this.validCanvas();
            if (canvas !== null) {
                CropDialog.setCenter();
            }
        });

        for (const selector of '#cropX #cropY #cropWidth #cropHeight'.split(' ')) {
            ($(selector) as HTMLInputElement | null)?.addEventListener('input', (e) => {
                CropDialog.updateHandle();
            });
        }

        for (const rational of [[1, 1], [2, 1], [3, 2], [4, 3], [16, 9], [1, 2], [2, 3], [3, 4], [9, 16]]) {
            const numerator = rational[0];
            const denominator = rational[1];
            ($(`#cropPreset_${numerator}_${denominator}`) as HTMLButtonElement | null)?.addEventListener('click', () => {
                CropDialog.setRatio(numerator, denominator)
            });
        }

        ($('#scaleMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                Dialog.dismissAll();
                new ScaleDialog().show();
            }
        });

        ($('#scaleWidth') as HTMLInputElement | null)?.addEventListener('input', () => {
            ScaleDialog.setWidth();
        });

        ($('#scaleHeight') as HTMLInputElement | null)?.addEventListener('input', () => {
            ScaleDialog.setHeight();
        });

        ($('#scalePercent') as HTMLInputElement | null)?.addEventListener('input', () => {
            ScaleDialog.updatePercent();
        });

        ($('#scaleExecButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.performScale();
            }
        });

        ($('#scaleResetButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.snapshotRestore();
        });

        for (const numerator of [1, 2, 4, 8, 16]) {
            for (const denominator of [1, 2, 4, 8, 16]) {
                ($(`#scalePreset_${numerator}_${denominator}`) as HTMLButtonElement | null)?.addEventListener('click', () => {
                    ScaleDialog.setRational(numerator, denominator);
                });
            }
        }

        ($('#savePngButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = this.validCanvas();
            if (canvas !== null) {
                this.exportImage(canvas);
            }
        });

        ($('#saveQoiButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.exportEncoded(ImageType.Qoi);
            }
        });

        ($('#saveMpicButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.exportEncoded(ImageType.Mpic);
            }
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
                        this.loadImage(name, canvas, result);
                    }
                });
                reader.readAsArrayBuffer(file);
            }
        });

        ($('body') as HTMLBodyElement).style.display = 'block';

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

    getInfo(): { width: number, height: number } {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return { width: 0, height: 0 }
        }
        const { width, height } = canvas;
        return { width, height }
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
        CropDialog.update();
        ScaleDialog.update();
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
            Dialog.dismissAll();
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
                Dialog.dismissAll();
                this.reflectCanvasToLib(canvas);
            }).catch((reason) => {
                alert("Unsupported file type");
                console.log('Decode error', reason);
            });
        }
    }

    exportEncoded(type: ImageType) {
        const lib = this.imgLib;

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

    validCanvas(): HTMLCanvasElement | null {
        const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
        if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
            return canvas;
        } else {
            return null;
        }
    }

    reflectCanvasToLib(canvas: HTMLCanvasElement) {
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

    reflectLibToCanvas() {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        const lib = this.imgLib;
        const { width, height } = lib;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx !== null) {
            const imageData = ctx.createImageData(width, height);
            imageData.data.set(lib.image_buffer);
            ctx.putImageData(imageData, 0, 0);
        }
        this.updateInfo(this.baseName, width, height);
    }

    performCrop() {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        const { x, y, width, height } = CropDialog.rect();
        const info = this.getInfo();
        if (x >= 0 && y >= 0 && width > 0 && height > 0) { } else {
            alert('Invalid coordinates');
            return;
        }
        if (x >= info.width || x + width > info.width || y >= info.width || y + height > info.height) {
            alert('Out of Bounds');
            return;
        }
        if (this.imgLib.crop(x, y, width, height)) {
            this.reflectLibToCanvas();
        } else {
            alert('Crop failed');
        }
    }

    performScale() {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        const width = parseInt(($('#scaleWidth') as HTMLInputElement).value);
        const height = parseInt(($('#scaleHeight') as HTMLInputElement).value);
        const info = this.getInfo();
        if (width > 0 && height > 0) { } else {
            alert('Invalid size');
            return;
        }
        const interpolation = parseInt(($('#scaleInterpolation') as HTMLSelectElement).value);
        if (this.imgLib.scale(width, height, interpolation)) {
            this.reflectLibToCanvas();
        } else {
            alert('Scale failed');
        }
    }

    snapshotSave() {
        this.imgLib.snapshotSave();
    }
    snapshotRestore() {
        this.imgLib.snapshotRestore();
        this.reflectLibToCanvas();
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
    constructor(message: string) {
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

class CropDialog extends Dialog {
    private static inShow = false;
    constructor() {
        super('#dialogCrop');
    }
    onShow(): void {
        app.snapshotSave();
        CropDialog.inShow = true;
        CropDialog.update();
    }
    onClose(): void {
        CropDialog.inShow = false;
        CropDialog.updateHandle();
    }
    static setInputElement(selector: string, value: number, max: number, min: number = 0) {
        const element = $(selector) as HTMLInputElement | null;
        if (element === null) {
            return
        }
        element.value = String(value);
        element.step = '1';
        element.min = String(min);
        element.max = String(max);
    }
    static update() {
        const { width, height } = app.getInfo();
        this.setInputElement('#cropX', 0, width);
        this.setInputElement('#cropY', 0, height);
        this.setInputElement('#cropWidth', width, width, 1);
        this.setInputElement('#cropHeight', height, height, 1);

        this.updateHandle();
    }
    static updateHandle() {
        const handleCanvas = $('#handleCanvas') as HTMLCanvasElement | null;
        if (handleCanvas === null) {
            return;
        }
        const info = app.getInfo();
        const frame = this.rect();
        handleCanvas.width = info.width + 2;
        handleCanvas.height = info.height + 2;
        const ctx = handleCanvas.getContext('2d');
        if (ctx === null) {
            return
        }
        ctx.clearRect(0, 0, handleCanvas.width, handleCanvas.height);
        if (CropDialog.inShow) {
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            ctx.strokeRect(frame.x, frame.y, frame.width + 2, frame.height + 2);
        }
    }
    static setRatio(numerator: number, denominator: number) {
        const { width, height } = app.getInfo();

        let newDims = [width, height];
        const h1 = Math.floor(width * denominator / numerator);
        if (h1 <= height) {
            newDims = [width, h1];
        } else {
            const w1 = Math.floor(height * numerator / denominator);
            newDims = [w1, height];
        }

        ($('#cropWidth') as HTMLInputElement).value = newDims[0].toString();
        ($('#cropHeight') as HTMLInputElement).value = newDims[1].toString();
        CropDialog.setCenter();
    }
    static setCenter() {
        const info = app.getInfo();
        const { x, y, width, height } = CropDialog.rect();
        ($('#cropX') as HTMLInputElement).value = ((info.width - width) >> 1).toString();
        ($('#cropY') as HTMLInputElement).value = ((info.height - height) >> 1).toString();
        CropDialog.updateHandle();
    }

    static rect(): { x: number, y: number, width: number, height: number } {
        const x = parseInt(($('#cropX') as HTMLInputElement).value) ?? 0;
        const y = parseInt(($('#cropY') as HTMLInputElement).value) ?? 0;
        const width = parseInt(($('#cropWidth') as HTMLInputElement).value) ?? 0;
        const height = parseInt(($('#cropHeight') as HTMLInputElement).value) ?? 0;
        return { x, y, width, height }
    }
}

class ScaleDialog extends Dialog {
    private static inShow = false;
    constructor() {
        super('#dialogScale');
    }
    onShow(): void {
        app.snapshotSave();
        ScaleDialog.inShow = true;
        ScaleDialog.update();
    }
    onClose(): void {
        ScaleDialog.inShow = false;
    }
    static setInputElement(selector: string, value: number, max: number, min: number = 0) {
        const element = $(selector) as HTMLInputElement | null;
        if (element === null) {
            return
        }
        element.value = String(value);
        element.step = '1';
        element.min = String(min);
        element.max = String(max);
    }
    static update() {
        const { width, height } = app.getInfo();
        this.setInputElement('#scaleWidth', width, width * 100, 1);
        this.setInputElement('#scaleHeight', height, height * 100, 1);
        ($('#scalePercent') as HTMLInputElement).value = '100';
    }
    static setRational(numerator: number, denominator: number) {
        const percent = Math.round(numerator * 10000 / denominator) / 100;
        ($('#scalePercent') as HTMLInputElement).value = percent.toString();
        this.setScale(numerator, denominator);
    }
    static updatePercent() {
        const percent = Math.round(100 * Number(($('#scalePercent') as HTMLInputElement).value));
        this.setScale(percent, 10000);
    }
    static setScale(numerator: number, denominator: number) {
        const { width, height } = app.getInfo();
        const w = Math.ceil(width * numerator / denominator);
        const h = Math.ceil(height * numerator / denominator);
        ($('#scaleWidth') as HTMLInputElement).value = String(w);
        ($('#scaleHeight') as HTMLInputElement).value = String(h);
    }
    static setWidth() {
        const { width, height } = app.getInfo();
        const w = parseInt(($('#scaleWidth') as HTMLInputElement).value);
        const h = Math.ceil(w * height / width);
        ($('#scaleHeight') as HTMLInputElement).value = String(h);
        const percent = Math.ceil(1000 * w / width) / 10;
        ($('#scalePercent') as HTMLInputElement).value = percent.toString();
    }
    static setHeight() {
        const { width, height } = app.getInfo();
        const h = parseInt(($('#scaleHeight') as HTMLInputElement).value);
        const w = Math.ceil(h * width / height);
        ($('#scaleWidth') as HTMLInputElement).value = String(w);
        const percent = Math.ceil(1000 * h / height) / 10;
        ($('#scalePercent') as HTMLInputElement).value = percent.toString();
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

