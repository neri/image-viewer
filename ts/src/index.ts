
import { ImageLib } from './lib';

const $ = (x: string) => document.querySelector(x);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

function main() {
    document.write("<html><head><title>Online Image Viewer</title></head><body>Online Image Viewer (Drag and Drop Image file to load)<br><canvas id='mainCanvas'></canvas></body></html>");

    const html = $('html') as HTMLElement | null;
    if (html !== null) {

        // html.style.width = "100%";
        // html.style.height = "100%";
        // html.style.background = "gray";

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
                    const lib = new ImageLib();
                    console.log('load result:', lib.decode(result));

                    const width = lib.decoded_width();
                    const height = lib.decoded_height();
                    console.log(`width: ${width} height: ${height} has_alpha: ${lib.decoded_image_has_alpha()}`);
                    const canvas = $('#mainCanvas') as HTMLCanvasElement | null;
                    if (canvas !== null) {
                        const ctx = canvas.getContext('2d');
                        if (ctx !== null) {
                            canvas.width = width;
                            canvas.height = height;
                            const imageData = ctx.getImageData(0, 0, width, height);
                            imageData.data.set(lib.decoded_buffer());
                            ctx.putImageData(imageData, 0, 0);
                        }
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
