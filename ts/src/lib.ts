import * as wasm from '../../rs/lib/libqoi';

/**
 * Wasm Image Library Wrapper
 */
export class ImageLib {
    decode(buffer: ArrayBuffer): boolean {
        const bytes = new Uint8Array(buffer);
        const base = wasm.input_buffer_resize(bytes.length);
        const memory = new Uint8Array(wasm.memory.buffer);
        memory.set(bytes, base);
        return wasm.decode() != 0;
    }
    decoded_width(): number {
        return wasm.decoded_width();
    }
    decoded_height(): number {
        return wasm.decoded_height();
    }
    decoded_image_has_alpha(): boolean {
        return wasm.decoded_image_has_alpha() != 0;
    }
    decoded_buffer(): Uint8Array {
        const base = wasm.output_buffer_get_base();
        const memory = new Uint8Array(wasm.memory.buffer);
        return memory.slice(
            base,
            base + wasm.output_buffer_get_size()
        );
    }
}
