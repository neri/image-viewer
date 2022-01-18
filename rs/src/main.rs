#![no_main]

use alloc::vec::Vec;
use core::cell::UnsafeCell;
use rapid_qoi::{Colors, Qoi};

extern crate alloc;

static mut INPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut OUTPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut DECODED_HEADER: UnsafeCell<Qoi> = UnsafeCell::new(Qoi {
    width: 0,
    height: 0,
    colors: Colors::Srgb,
});

#[no_mangle]
pub fn cleanup() {
    unsafe {
        let ib = INPUT_BUFFER.get_mut();
        ib.resize(0, 0);
        ib.shrink_to_fit();
        let ob = OUTPUT_BUFFER.get_mut();
        ob.resize(0, 0);
        ob.shrink_to_fit();
    }
}

#[no_mangle]
pub fn input_buffer_resize(new_len: usize) -> usize {
    unsafe {
        let ib = INPUT_BUFFER.get_mut();
        ib.resize(0, 0);
        ib.reserve(new_len);
        ib.set_len(new_len);

        ib.get_unchecked(0) as *const _ as usize
    }
}

#[no_mangle]
pub fn output_buffer_get_base() -> usize {
    unsafe {
        let ob = OUTPUT_BUFFER.get_mut();
        if ob.len() > 0 {
            ob.get_unchecked(0) as *const _ as usize
        } else {
            usize::MAX
        }
    }
}

#[no_mangle]
pub fn output_buffer_get_size() -> usize {
    unsafe {
        let ob = OUTPUT_BUFFER.get_mut();
        ob.len()
    }
}

#[no_mangle]
pub fn decode_header() -> bool {
    let input_buffer = unsafe { INPUT_BUFFER.get_mut().as_slice() };
    match Qoi::decode_header(input_buffer) {
        Ok(qoi) => unsafe {
            let dh = DECODED_HEADER.get_mut();
            dh.width = qoi.width;
            dh.height = qoi.height;
            dh.colors = qoi.colors;

            true
        },
        Err(_) => false,
    }
}

#[no_mangle]
pub fn decoded_width() -> u32 {
    unsafe { DECODED_HEADER.get_mut().width }
}

#[no_mangle]
pub fn decoded_height() -> u32 {
    unsafe { DECODED_HEADER.get_mut().height }
}

#[no_mangle]
pub fn decoded_image_has_alpha() -> u32 {
    unsafe { DECODED_HEADER.get_mut().colors.has_alpha() as u32 }
}

#[no_mangle]
pub fn decode() -> bool {
    let input_buffer = unsafe { INPUT_BUFFER.get_mut().as_slice() };
    match Qoi::decode_alloc(input_buffer) {
        Ok((qoi, buffer)) => unsafe {
            let dh = DECODED_HEADER.get_mut();
            dh.width = qoi.width;
            dh.height = qoi.height;
            dh.colors = qoi.colors;
            let count = qoi.width as usize * qoi.height as usize;

            let ob = OUTPUT_BUFFER.get_mut();
            ob.resize(0, 0);
            if dh.colors.has_alpha() {
                ob.extend_from_slice(buffer.as_slice());
            } else {
                for i in 0..count {
                    ob.push(buffer[i * 3]);
                    ob.push(buffer[i * 3 + 1]);
                    ob.push(buffer[i * 3 + 2]);
                    ob.push(u8::MAX);
                }
            }

            true
        },
        Err(_) => false,
    }
}
