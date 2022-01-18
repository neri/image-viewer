#![no_std]
#![no_main]

use alloc::vec::Vec;
use core::cell::UnsafeCell;
use rapid_qoi::Qoi;

extern crate alloc;

static mut INPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut IMAGE_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut DECODED_INFO: UnsafeCell<ImageInfo> = UnsafeCell::new(ImageInfo::new());

#[inline]
fn decoded_info<'a>() -> &'a ImageInfo {
    unsafe { &*DECODED_INFO.get() }
}

#[inline]
fn image_buffer<'a>() -> &'a Vec<u8> {
    unsafe { &*IMAGE_BUFFER.get() }
}

#[no_mangle]
pub fn cleanup() {
    unsafe {
        let ib = INPUT_BUFFER.get_mut();
        ib.set_len(0);
        ib.shrink_to_fit();

        let ob = IMAGE_BUFFER.get_mut();
        ob.set_len(0);
        ob.shrink_to_fit();

        let di = DECODED_INFO.get_mut();
        *di = ImageInfo::default();
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
pub fn image_buffer_get_base() -> usize {
    let ob = image_buffer();
    if ob.len() > 0 {
        unsafe { ob.get_unchecked(0) as *const _ as usize }
    } else {
        usize::MAX
    }
}

#[no_mangle]
pub fn image_buffer_get_size() -> usize {
    image_buffer().len()
}

#[no_mangle]
pub fn image_buffer_resize(new_len: usize) -> usize {
    unsafe {
        let ib = IMAGE_BUFFER.get_mut();
        ib.resize(0, 0);
        ib.reserve(new_len);
        ib.set_len(new_len);

        ib.get_unchecked(0) as *const _ as usize
    }
}

#[no_mangle]
pub fn decode_header() -> bool {
    let input_buffer = unsafe { INPUT_BUFFER.get_mut().as_slice() };
    match Qoi::decode_header(input_buffer) {
        Ok(qoi) => {
            let di = unsafe { DECODED_INFO.get_mut() };
            di.width = qoi.width as isize;
            di.height = qoi.height as isize;
            di.has_slpha = qoi.colors.has_alpha();

            true
        }
        Err(_) => false,
    }
}

#[no_mangle]
pub fn image_width() -> isize {
    decoded_info().width
}

#[no_mangle]
pub fn image_height() -> isize {
    decoded_info().height
}

#[no_mangle]
pub fn image_has_alpha() -> isize {
    decoded_info().has_slpha as isize
}

#[no_mangle]
pub fn decode() -> bool {
    let input_buffer = unsafe { INPUT_BUFFER.get_mut().as_slice() };
    match Qoi::decode_alloc(input_buffer) {
        Ok((qoi, buffer)) => {
            let di = unsafe { DECODED_INFO.get_mut() };
            di.width = qoi.width as isize;
            di.height = qoi.height as isize;
            di.has_slpha = qoi.colors.has_alpha();

            let ob = unsafe { IMAGE_BUFFER.get_mut() };
            ob.resize(0, 0);
            if di.has_slpha {
                ob.extend_from_slice(buffer.as_slice());
            } else {
                let new_len = di.image_size() * 4;
                if ob.capacity() < new_len {
                    ob.reserve(new_len.wrapping_sub(ob.capacity()));
                }
                unsafe {
                    ob.set_len(new_len);
                    for i in 0..di.image_size() {
                        *ob.get_unchecked_mut(i * 4) = *buffer.get_unchecked(i * 3);
                        *ob.get_unchecked_mut(i * 4 + 1) = *buffer.get_unchecked(i * 3 + 1);
                        *ob.get_unchecked_mut(i * 4 + 2) = *buffer.get_unchecked(i * 3 + 2);
                        *ob.get_unchecked_mut(i * 4 + 3) = u8::MAX;
                    }
                }
            }

            true
        }
        Err(_) => false,
    }
}

#[no_mangle]
pub fn encode(width: isize, height: isize, has_alpha: usize) -> usize {
    let di = unsafe { DECODED_INFO.get_mut() };
    di.width = width;
    di.height = height;
    di.has_slpha = has_alpha != 0;

    0
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
struct ImageInfo {
    width: isize,
    height: isize,
    has_slpha: bool,
}

impl ImageInfo {
    #[inline]
    pub const fn new() -> Self {
        Self {
            width: 0,
            height: 0,
            has_slpha: false,
        }
    }

    #[inline]
    pub const fn image_size(&self) -> usize {
        self.width as usize * self.height as usize
    }
}
