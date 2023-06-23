/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function cleanup(): void;
export function decode(): boolean;
export function encode_qoi(): boolean;
export function encode_mpic(): boolean;
export function image_buffer_get_base(): number;
export function image_buffer_get_size(): number;
export function image_buffer_resize(new_len: number): number;
export function image_has_alpha(): boolean;
export function image_height(): number;
export function image_width(): number;
export function input_buffer_resize(new_len: number): number;
export function output_buffer_cleanup(): void;
export function output_buffer_get_base(): number;
export function output_buffer_get_size(): number;
export function set_image_has_alpha(value: boolean): void;
export function set_image_info(width: number, height: number): boolean;
export function crop(x: number, y: number, width: number, height: number): boolean;
