import * as wasm from '../../rs/lib/libimage';

export enum ImageType {
    Qoi = "qoi",
    Mpic = "mpic",
}

/**
 * Wasm Image Library Wrapper
 */
export class ImageLib {
    cleanup(): void {
        wasm.cleanup();
    }
    decode(buffer: ArrayBuffer): boolean {
        const bytes = new Uint8Array(buffer);
        const base = wasm.input_buffer_resize(bytes.length);
        const memory = new Uint8Array(wasm.memory.buffer);
        memory.set(bytes, base);
        return wasm.decode();
    }
    set_image_buffer(buffer: ArrayBuffer, width: number, height: number): boolean {
        const bytes = new Uint8Array(buffer);
        const base = wasm.image_buffer_resize(bytes.length);
        const memory = new Uint8Array(wasm.memory.buffer);
        memory.set(bytes, base);
        return wasm.set_image_info(width, height);
    }
    encode(type: ImageType): ArrayBuffer | undefined {
        switch (type) {
            case ImageType.Qoi:
                if (wasm.encode_qoi()) {
                    return this.output_buffer.buffer
                }
                break;
            case ImageType.Mpic:
                if (wasm.encode_mpic()) {
                    return this.output_buffer.buffer
                }
                break;
            default:
                break;
        }
        return undefined;
    }
    get width(): number {
        return wasm.image_width();
    }
    get height(): number {
        return wasm.image_height();
    }
    get image_has_alpha(): boolean {
        return wasm.image_has_alpha();
    }
    set image_has_alpha(value: boolean) {
        wasm.set_image_has_alpha(value);
    }
    get image_buffer(): Uint8Array {
        const base = wasm.image_buffer_get_base();
        const memory = new Uint8Array(wasm.memory.buffer);
        return memory.slice(
            base,
            base + wasm.image_buffer_get_size()
        );
    }
    set image_buffer(array: Uint8Array) {
        const base = wasm.image_buffer_get_base();
        const memory = new Uint8Array(wasm.memory.buffer);
        wasm.image_buffer_resize(array.byteLength);
        memory.set(array, base);
    }
    get output_buffer(): Uint8Array {
        const base = wasm.output_buffer_get_base();
        const memory = new Uint8Array(wasm.memory.buffer);
        return memory.slice(
            base,
            base + wasm.output_buffer_get_size()
        );
    }
}

