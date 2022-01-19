/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function cleanup(): void;
export function input_buffer_resize(new_len: number): number;
export function image_buffer_get_base(): number;
export function image_buffer_get_size(): number;
export function image_buffer_resize(new_len: number): number;
export function decode(): number;
export function encode(): number;
export function image_width(): number;
export function image_height(): number;
export function image_has_alpha(): number;
export function set_image_info(width: number, height: number): number;
export function set_image_has_alpha(value: number): void;
export function output_buffer_get_base(): number;
export function output_buffer_get_size(): number;
export function output_buffer_cleanup(): void;
