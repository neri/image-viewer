#![no_std]
#![no_main]

use alloc::vec::Vec;
use core::cell::UnsafeCell;
use rapid_qoi::{Colors, Qoi};

extern crate alloc;

static mut INPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut OUTPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut IMAGE_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut IMAGE_INFO: UnsafeCell<ImageInfo> = UnsafeCell::new(ImageInfo::empty());

#[inline]
fn image_info<'a>() -> &'a ImageInfo {
    unsafe { &*IMAGE_INFO.get() }
}

#[inline]
fn image_buffer<'a>() -> &'a Vec<u8> {
    unsafe { &*IMAGE_BUFFER.get() }
}

#[inline]
fn output_buffer<'a>() -> &'a Vec<u8> {
    unsafe { &*OUTPUT_BUFFER.get() }
}

#[no_mangle]
pub fn cleanup() {
    unsafe {
        let buffer = INPUT_BUFFER.get_mut();
        buffer.set_len(0);
        buffer.shrink_to_fit();

        let buffer = IMAGE_BUFFER.get_mut();
        buffer.set_len(0);
        buffer.shrink_to_fit();

        output_buffer_cleanup();

        *IMAGE_INFO.get_mut() = ImageInfo::default();
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
pub fn output_buffer_cleanup() {
    unsafe {
        let buffer = OUTPUT_BUFFER.get_mut();
        buffer.set_len(0);
        buffer.shrink_to_fit();
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
pub fn output_buffer_get_base() -> usize {
    let ob = output_buffer();
    if ob.len() > 0 {
        unsafe { ob.get_unchecked(0) as *const _ as usize }
    } else {
        usize::MAX
    }
}

#[no_mangle]
pub fn output_buffer_get_size() -> usize {
    output_buffer().len()
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
pub fn image_width() -> isize {
    image_info().width
}

#[no_mangle]
pub fn image_height() -> isize {
    image_info().height
}

#[no_mangle]
pub fn image_has_alpha() -> bool {
    image_info().transparency.into()
}

#[no_mangle]
pub fn set_image_has_alpha(value: usize) {
    unsafe { IMAGE_INFO.get_mut() }.transparency = (value != 0).into();
}

#[no_mangle]
pub fn decode() -> bool {
    let input_buffer = unsafe { INPUT_BUFFER.get_mut().as_slice() };
    match Qoi::decode_alloc(input_buffer) {
        Ok((qoi, buffer)) => {
            let info = unsafe { IMAGE_INFO.get_mut() };

            let has_alpha = qoi.colors.has_alpha();
            *info = ImageInfo::new(qoi.width as isize, qoi.height as isize, has_alpha.into());

            let ob = unsafe { IMAGE_BUFFER.get_mut() };
            if has_alpha {
                *ob = buffer;
                // ob.extend_from_slice(buffer.as_slice());
            } else {
                image_buffer_resize(info.image_size());
                unsafe {
                    for i in 0..info.number_of_pixels() {
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
pub fn set_image_info(width: isize, height: isize) -> bool {
    let mut info = ImageInfo::new(width, height, Transparency::Opaque);
    let ib = image_buffer();

    if ib.len() < info.image_size() {
        return false;
    }

    for i in 0..info.number_of_pixels() {
        let p = unsafe { *ib.get_unchecked(i * 4 + 3) };
        if p != u8::MAX {
            info.transparency = Transparency::Translucent;
            break;
        }
    }

    *unsafe { IMAGE_INFO.get_mut() } = info;
    true
}

#[no_mangle]
pub fn encode() -> bool {
    let ib = image_buffer();
    let info = image_info();

    let qoi = Qoi {
        width: info.width as u32,
        height: info.height as u32,
        colors: match info.transparency {
            Transparency::Opaque => Colors::Rgb,
            Transparency::Translucent => Colors::Rgba,
        },
    };
    let result = if qoi.colors.has_alpha() {
        qoi.encode_alloc(ib.as_slice())
    } else {
        let buffer_size = info.number_of_pixels() * 3;
        let mut vec = Vec::with_capacity(buffer_size);
        unsafe {
            vec.set_len(buffer_size);
            for i in 0..info.number_of_pixels() {
                *vec.get_unchecked_mut(i * 3) = *ib.get_unchecked(i * 4);
                *vec.get_unchecked_mut(i * 3 + 1) = *ib.get_unchecked(i * 4 + 1);
                *vec.get_unchecked_mut(i * 3 + 2) = *ib.get_unchecked(i * 4 + 2);
            }
        }
        qoi.encode_alloc(vec.as_slice())
    };
    match result {
        Ok(vec) => {
            let ob = unsafe { OUTPUT_BUFFER.get_mut() };
            *ob = vec;
            true
        }
        Err(_) => false,
    }
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct ImageInfo {
    width: isize,
    height: isize,
    transparency: Transparency,
}

impl ImageInfo {
    #[inline]
    pub const fn empty() -> Self {
        Self {
            width: 0,
            height: 0,
            transparency: Transparency::Opaque,
        }
    }

    #[inline]
    pub const fn new(width: isize, height: isize, transparency: Transparency) -> Self {
        Self {
            width,
            height,
            transparency,
        }
    }

    #[inline]
    pub const fn number_of_pixels(&self) -> usize {
        self.width as usize * self.height as usize
    }

    #[inline]
    pub const fn image_size(&self) -> usize {
        self.number_of_pixels() * 4
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Transparency {
    Opaque,
    Translucent,
}

impl Default for Transparency {
    fn default() -> Self {
        Self::Opaque
    }
}

impl From<bool> for Transparency {
    fn from(val: bool) -> Self {
        if val {
            Self::Translucent
        } else {
            Self::Opaque
        }
    }
}

impl From<Transparency> for bool {
    fn from(val: Transparency) -> Self {
        match val {
            Transparency::Opaque => false,
            Transparency::Translucent => true,
        }
    }
}
