/// Online Image Tools
///
/// Copyright (c) 2022 Nerry, ALL RIGHTS RESERVED
///
/// https://github.com/neri/image-viewer
///
const APP_NAME = "Online Image Tools";
const COPYRIGHT = "Copyright (c) 2022 Nerry, ALL RIGHTS RESERVED.";
const REPOSITORY_URL = "https://github.com/neri/image-viewer";
const VERSION_STRING = "0.1.0";

import './style.css';
import * as libimage from '../lib/libimage';
import { HASH } from "./hash";
import { Dialog } from './dialog';

const $ = (x: string) => document.querySelector(x);

const alert = (x: string) => new AlertDialog(x).show();

class App {

    private currentTitle = '';
    private baseName = 'download';

    onload() {
        const html = $('html') as HTMLElement;

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

        html.addEventListener('drop', (e) => {
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

        document.title = APP_NAME;
        document.querySelectorAll('.app_name').forEach((element, _key, _parent) => {
            const appNameTextNode = document.createTextNode(APP_NAME);
            element.parentElement?.replaceChild(appNameTextNode, element);
        });
        document.querySelectorAll('.copyright').forEach((element, _key, _parent) => {
            const appNameTextNode = document.createTextNode(COPYRIGHT);
            element.parentElement?.replaceChild(appNameTextNode, element);
        });
        document.querySelectorAll('.repository_button').forEach((element, _key, _parent) => {
            const repositoryButton = document.createElement('a');
            repositoryButton.className = 'button';
            repositoryButton.href = REPOSITORY_URL;
            repositoryButton.target = "_blank";
            repositoryButton.appendChild(app.makeIcon('ic_launch'));
            repositoryButton.appendChild(document.createTextNode(' Open in GitHub'));
            element.parentElement?.replaceChild(repositoryButton, element);
        });
        document.querySelectorAll('.app_version').forEach((element, _key, _parent) => {
            const appVerTag = document.createElement('div');
            appVerTag.className = 'app_version';
            const appVerText = document.createTextNode(`Version: ${VERSION_STRING} Hash: ${HASH}`);
            appVerTag.appendChild(appVerText);
            element.parentElement?.replaceChild(appVerTag, element);
        });

        ($('#menuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            new MainMenu().show();
        });

        ($('#titleText') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.beginEditMode();
        });

        ($('#titleInput') as HTMLButtonElement | null)?.addEventListener('keypress', (e) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    this.endEditMode();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.cancelEditMode();
                    break;
            }
        });

        ($('#aboutMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            new AboutDialog().show();
        });

        ($('#exportMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                Dialog.dismissAll();
                new ExportDialog().show();
            }
        });

        ($('#cropMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.snapshotSave();
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
                this.snapshotSave();
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
                const width = parseInt(($('#scaleWidth') as HTMLInputElement).value);
                const height = parseInt(($('#scaleHeight') as HTMLInputElement).value);
                const scaleMode = parseInt(($('#scaleMode') as HTMLSelectElement).value);
                this.performScale(width, height, scaleMode);
            }
        });

        ($('#scaleResetButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.snapshotRestore();
        });

        for (const numerator of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16]) {
            for (const denominator of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16]) {
                ($(`#scalePreset_${numerator}_${denominator}`) as HTMLButtonElement | null)?.addEventListener('click', () => {
                    ScaleDialog.setRational(numerator, denominator);
                });
            }
        }

        ($('#reduceMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.snapshotSave();
                Dialog.dismissAll();
                new ReduceDialog().show();
            }
        });

        ($('#grayAverageButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.performGrayscale(libimage.GrayScaleMode.Average);
            }
        });

        ($('#grayBrightnessButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.performGrayscale(libimage.GrayScaleMode.Brightness);
            }
        });

        ($('#grayLuminanceButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.performGrayscale(libimage.GrayScaleMode.Luminance);
            }
        });

        ($('#posterizeWscButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                const fsd = (($('#posterizeMode') as HTMLSelectElement | null)?.value ?? 0) != 0;
                this.performPosterize(fsd, 6, 6, 6);
            }
        });

        ($('#posterizeRgb565Button') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                const fsd = (($('#posterizeMode') as HTMLSelectElement | null)?.value ?? 0) != 0;
                this.performPosterize(fsd, 32, 64, 32);
            }
        });

        ($('#posterizeRgb555Button') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                const fsd = (($('#posterizeMode') as HTMLSelectElement | null)?.value ?? 0) != 0;
                this.performPosterize(fsd, 32, 32, 32);
            }
        });

        ($('#posterizeButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                const fsd = (($('#posterizeMode') as HTMLSelectElement | null)?.value ?? 0) != 0;
                const bits = parseInt(($('#posterizeBpc') as HTMLInputElement | null)?.value ?? "") ?? 0;
                const level = 1 << bits;
                this.performPosterize(fsd, level, level, level);
            }
        });

        ($('#makeOpaqueButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.makeOpaque();
            }
        });

        ($('#reduceResetButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            this.snapshotRestore();
        });

        ($('#pixelMenuButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.snapshotSave();
                Dialog.dismissAll();
                new PixelDialog().show();
            }
        });

        ($('#pixelPsdExecButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                const max_color_diff = parseInt(($('#pixelMaxError') as HTMLInputElement).value);
                this.performPixelScaleDetect(max_color_diff);
            }
        });

        ($('#pixelPsdApplyButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                const inputElement = $('#pixelScale') as HTMLInputElement;
                const scale = parseInt(inputElement.value);
                if (scale > 0) {
                    const info = this.getInfo();
                    const max_color_diff = parseInt(($('#pixelMaxError') as HTMLInputElement).value);
                    const scale_mode = (max_color_diff > 0) ? libimage.ScaleMode.Bilinear : libimage.ScaleMode.Nearest;
                    this.performScale(info.width / scale, info.height / scale, scale_mode);
                    inputElement.value = '0';
                }
            }
        });

        ($('#pixelResetButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                PixelDialog.reset();
            }
        });

        ($('#savePngButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            const canvas = this.validCanvas();
            if (canvas !== null) {
                // this.exportImage(canvas);
                this.exportEncoded(libimage.ImageType.Png);
            }
        });

        ($('#saveQoiButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.exportEncoded(libimage.ImageType.Qoi);
            }
        });

        ($('#saveMpicButton') as HTMLButtonElement | null)?.addEventListener('click', () => {
            if (this.validCanvas() !== null) {
                this.exportEncoded(libimage.ImageType.Mpic);
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
        const titleText = $('#titleText') as HTMLElement | null;
        if (titleText === null) {
            return;
        }
        const startText = $('#startText') as HTMLElement | null;
        if (startText === null) {
            return;
        }
        let baseName = name.split('/').pop() ?? '';
        if (baseName.lastIndexOf(".") != -1) {
            baseName = baseName.substring(0, baseName.lastIndexOf("."));
        }
        this.baseName = baseName;
        if (width > 0 && height > 0) {
            const titleInput = $('#titleInput') as HTMLInputElement;
            titleInput.hidden = true;
            titleInput.style.minWidth = '10em';
            titleInput.style.maxWidth = '50%';
            titleInput.style.width = `${baseName.length}em`;

            const title = `${baseName} (${width} x ${height})`;
            titleText.childNodes.forEach((node, key, parent) => {
                titleText.removeChild(node)
            });
            titleText.appendChild(document.createTextNode(title));
            titleText.style.visibility = 'visible';
            document.title = title;
            this.currentTitle = title;
        }
        startText.style.display = 'none';

        const menu2 = ($('#menu2') as HTMLElement | null);
        if (menu2 !== null) {
            menu2.style.display = 'block';
        }

        CropDialog.update();
        ScaleDialog.update();
    }

    beginEditMode() {
        if (this.currentTitle === '') {
            return;
        }
        const titleText = $('#titleText') as HTMLElement | null;
        if (titleText === null) {
            return;
        }
        titleText.style.visibility = 'collapse';

        const titleInput = $('#titleInput') as HTMLInputElement;
        titleInput.value = this.baseName;
        titleInput.hidden = false;
    }

    cancelEditMode() {
        const titleInput = $('#titleInput') as HTMLInputElement;
        titleInput.hidden = true;

        const titleText = $('#titleText') as HTMLElement | null;
        if (titleText === null) {
            return;
        }
        titleText.style.visibility = 'visible';
    }

    endEditMode() {
        const titleInput = $('#titleInput') as HTMLInputElement;
        const baseName = titleInput.value.trim();
        titleInput.hidden = true;
        if (baseName === '') {
            return this.cancelEditMode();
        }

        const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
        if (canvas === null) {
            return;
        }

        this.updateInfo(baseName, canvas.width, canvas.height);
    }


    loadImage(name: string, canvas: HTMLCanvasElement, blob: ArrayBuffer) {
        if (libimage.decode(new Uint8Array(blob))) {
            const width = libimage.image_width();
            const height = libimage.image_height();
            console.log(`Loaded ${name} via WASM (${width} x ${height}) has_alpha: ${libimage.image_has_alpha()}`);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx !== null) {
                libimage.draw_to_canvas(ctx);
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

    exportEncoded(type: libimage.ImageType) {
        const waitDialog = new AlertDialog("Please wait...", "Encoding...", true, false);
        waitDialog.show();

        setTimeout(() => {
            const data = libimage.encode(type);
            waitDialog.dismiss();

            if (!(data instanceof Uint8Array)) {
                alert("ENCODE ERROR");
                console.log('encode error');
                return;
            }

            const blob = new Blob([data], { type: "application/octet-stream" });
            const dataUrl = URL.createObjectURL(blob);
            const tag = document.createElement('a') as HTMLAnchorElement;
            tag.href = dataUrl;
            tag.download = `${this.baseName}.${libimage.image_type_to_string(type)}`;
            tag.click();
        }, 100);
    }

    // exportImage(canvas: HTMLCanvasElement) {
    //     const dataUrl = canvas.toDataURL('image/png');
    //     const tag = document.createElement('a') as HTMLAnchorElement;
    //     tag.href = dataUrl;
    //     tag.download = `${this.baseName}.png`;
    //     tag.click();
    // }

    validCanvas(): HTMLCanvasElement | null {
        const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
        if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
            return canvas;
        } else {
            return null;
        }
    }

    reflectCanvasToLib(canvas: HTMLCanvasElement) {
        const { width, height } = canvas;
        const ctx = canvas.getContext('2d');
        if (ctx === null) {
            return;
        }
        const imgData = ctx.getImageData(0, 0, width, height);
        libimage.set_image_buffer(new Uint8Array(imgData.data), width, height);
    }

    reflectLibToCanvas() {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        const width = libimage.image_width();
        const height = libimage.image_height();
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx !== null) {
            libimage.draw_to_canvas(ctx);
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
        if (libimage.crop(x, y, width, height)) {
            this.reflectLibToCanvas();
        } else {
            alert('Crop failed');
        }
    }

    performScale(width: number, height: number, scaleMode: libimage.ScaleMode) {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        const info = this.getInfo();
        if (width > 0 && height > 0) { } else {
            alert('Invalid size');
            return;
        }
        if (libimage.scale(width, height, scaleMode)) {
            this.reflectLibToCanvas();
        } else {
            alert('Scale failed');
        }
    }

    performGrayscale(mode: libimage.GrayScaleMode) {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        libimage.grayscale(mode);
        this.reflectLibToCanvas();
    }

    performPosterize(fsd: boolean, red: number, green: number, blue: number) {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        libimage.posterize(fsd, red, green, blue);
        this.reflectLibToCanvas();
    }

    makeOpaque() {
        const canvas = this.validCanvas();
        if (canvas === null) {
            return;
        }
        libimage.makeOpaque();
        this.reflectLibToCanvas();
    }

    performPixelScaleDetect(max_color_diff: number) {
        const canvas = this.validCanvas();
        if (canvas === null) { return; }
        const scale = libimage.get_pixel_scale(max_color_diff);
        if (scale > 1) {
            ($('#pixelScale') as HTMLInputElement).value = scale.toString();
            PixelDialog.updateHandle();
        } else {
            alert('Failed to detect scale');
        }
    }

    snapshotSave() {
        libimage.snapshot_save();
    }
    snapshotRestore() {
        libimage.snapshot_restore();
        this.reflectLibToCanvas();
    }

    makeIcon(icon_id: string): HTMLElement {
        const iconElement = document.createElement('span');
        iconElement.className = icon_id;
        iconElement.appendChild(document.createTextNode("\u00a0"));
        return iconElement;
    }
}

const app = new App();

class AlertDialog extends Dialog {
    constructor(
        message: string,
        title: string | null = null,
        isModal: boolean = true,
        closeButton: boolean = true
    ) {
        super('dialogAlert', title ?? "", isModal, closeButton);

        const alertMessage = ($('#alertMessage') as HTMLElement | null);
        if (alertMessage !== null) {
            alertMessage.innerText = message;
        }
    }

    static dismiss() {
        new AlertDialog("").dismiss()
    }
}

class MainMenu extends Dialog {
    constructor() {
        super('dialogMainMenu', "", false);
    }
    onResetStyle(): void {
        this.frameElement.style.transform = 'translate(-100%, 0)';
    }
    onShow(): void {
        setTimeout(() => {
            this.frameElement.style.transform = 'translate(0, 0)';
        }, 50);
    }
}

class ExportDialog extends Dialog {
    constructor() {
        super('dialogExport', "Export as...", false);
    }
}

class AboutDialog extends Dialog {
    constructor() {
        super('dialogAbout', "", false);
    }
}

class CropDialog extends Dialog {
    private static inShow = false;
    private static isDark = false;
    constructor() {
        super('dialogCrop', "Resize (Crop)");
    }
    onShow(): void {
        super.onShow();
        CropDialog.inShow = true;
        CropDialog.isDark = libimage.image_is_dark(0xFF, 0x40, 64);
        CropDialog.update();
    }
    onClose(): void {
        super.onClose();
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
        if (CropDialog.inShow) {
            ctx.fillStyle = "rgba(0.5, 0.5, 0.5, 0.5)";
            ctx.fillRect(0, 0, handleCanvas.width, handleCanvas.height);

            if (CropDialog.isDark) {
                ctx.strokeStyle = "white";
            } else {
                ctx.strokeStyle = "black";
            }
            ctx.lineWidth = 1;
            ctx.strokeRect(frame.x, frame.y, frame.width + 2, frame.height + 2);
            ctx.clearRect(frame.x + 1, frame.y + 1, frame.width, frame.height);
        } else {
            ctx.clearRect(0, 0, handleCanvas.width, handleCanvas.height);
        }
    }
    static setRatio(numerator: number, denominator: number) {
        const { width, height } = app.getInfo();

        let newDims = [width, height];
        const h1 = roundToEven(width * denominator / numerator);
        if (h1 <= height) {
            newDims = [width, h1];
        } else {
            const w1 = roundToEven(height * numerator / denominator);
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
        super('dialogScale', "Resize (Scale)");
    }
    onShow(): void {
        super.onShow();
        ScaleDialog.inShow = true;
        ScaleDialog.update();
    }
    onClose(): void {
        super.onClose();
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
        const w = roundToEven(width * numerator / denominator);
        const h = roundToEven(height * numerator / denominator);
        ($('#scaleWidth') as HTMLInputElement).value = String(w);
        ($('#scaleHeight') as HTMLInputElement).value = String(h);
    }
    static setWidth() {
        const { width, height } = app.getInfo();
        const w = parseInt(($('#scaleWidth') as HTMLInputElement).value);
        const h = roundToEven(w * height / width);
        ($('#scaleHeight') as HTMLInputElement).value = String(h);
        const percent = Math.ceil(1000 * w / width) / 10;
        ($('#scalePercent') as HTMLInputElement).value = percent.toString();
    }
    static setHeight() {
        const { width, height } = app.getInfo();
        const h = parseInt(($('#scaleHeight') as HTMLInputElement).value);
        const w = roundToEven(h * width / height);
        ($('#scaleWidth') as HTMLInputElement).value = String(w);
        const percent = Math.ceil(1000 * h / height) / 10;
        ($('#scalePercent') as HTMLInputElement).value = percent.toString();
    }

}

class ReduceDialog extends Dialog {
    private static inShow = false;
    constructor() {
        super('dialogReduce', "Reduce Color");
    }
    onShow(): void {
        super.onShow();
        ReduceDialog.inShow = true;
        ReduceDialog.update();
    }
    onClose(): void {
        super.onClose();
        ReduceDialog.inShow = false;
    }
    static update() {
    }
}

class PixelDialog extends Dialog {
    private static inShow = false;
    constructor() {
        super('dialogPixel', "Pixel Scale Detection");
    }
    onShow(): void {
        super.onShow();
        PixelDialog.inShow = true;
        PixelDialog.update();
    }
    onClose(): void {
        super.onClose();
        PixelDialog.inShow = false;
        PixelDialog.updateHandle();
    }
    static update() {
        this.reset();
    }
    static reset() {
        ($('#pixelScale') as HTMLInputElement).value = '0';
        app.snapshotRestore();
        PixelDialog.updateHandle();
    }
    static updateHandle() {
        const scale = parseInt(($('#pixelScale') as HTMLInputElement).value);
        const handleCanvas = $('#handleCanvas') as HTMLCanvasElement | null;
        if (handleCanvas === null) {
            return;
        }
        const info = app.getInfo();
        handleCanvas.width = info.width + 2;
        handleCanvas.height = info.height + 2;
        const ctx = handleCanvas.getContext('2d');
        if (ctx === null) {
            return
        }
        if (PixelDialog.inShow && scale > 1) {
            ctx.clearRect(0, 0, handleCanvas.width, handleCanvas.height);

            ctx.fillStyle = "rgba(0.5, 0.5, 0.5, 0.25)";
            for (let y = 0; y <= info.height; y += scale) {
                ctx.fillRect(0, y, info.width + 1, 1);
            }
            for (let x = 0; x <= info.width; x += scale) {
                ctx.fillRect(x, 0, 1, info.height + 1);
            }
        } else {
            ctx.clearRect(0, 0, handleCanvas.width, handleCanvas.height);
        }
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

const roundToEven = (v: number): number => {
    if (!Number.isFinite(v)) {
        return NaN;
    }
    const ipart = Math.floor(v);
    const fpart = v - ipart;
    if (fpart < 0.5) {
        return ipart;
    } else if (fpart > 0.5) {
        return Math.ceil(v);
    } else {
        if ((ipart & 1) == 0) {
            return ipart;
        } else {
            return Math.ceil(v);
        }
    }
}
