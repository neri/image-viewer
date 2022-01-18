/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function buffer_reset(): void;
export function input_buffer_resize(new_len: number): number;
export function output_buffer_get_base(): number;
export function output_buffer_get_size(): number;
export function decode(): number;
export function decode_header(): number;
export function decoded_width(): number;
export function decoded_height(): number;
export function decoded_image_has_alpha(): number;
