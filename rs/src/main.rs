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
fn image_info<'a>() -> &'a mut ImageInfo {
    unsafe { IMAGE_INFO.get_mut() }
}

#[inline]
fn image_buffer<'a>() -> &'a mut Vec<u8> {
    unsafe { IMAGE_BUFFER.get_mut() }
}

#[inline]
fn output_buffer<'a>() -> &'a mut Vec<u8> {
    unsafe { OUTPUT_BUFFER.get_mut() }
}

#[inline]
fn input_buffer<'a>() -> &'a mut Vec<u8> {
    unsafe { INPUT_BUFFER.get_mut() }
}

#[no_mangle]
pub fn cleanup() {
    let buffer = input_buffer();
    buffer.clear();
    buffer.shrink_to_fit();

    let buffer = image_buffer();
    buffer.clear();
    buffer.shrink_to_fit();

    output_buffer_cleanup();

    *image_info() = ImageInfo::default();
}

#[no_mangle]
pub fn input_buffer_resize(new_len: usize) -> usize {
    let ib = input_buffer();
    ib.clear();
    ib.resize(new_len, 0);

    ib.as_ptr() as usize
}

#[no_mangle]
pub fn output_buffer_cleanup() {
    let buffer = output_buffer();
    buffer.clear();
    buffer.shrink_to_fit();
}

#[no_mangle]
pub fn image_buffer_get_base() -> usize {
    let ob = image_buffer();
    if ob.len() > 0 {
        ob.as_ptr() as usize
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
        ob.as_ptr() as usize
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
    let ib = image_buffer();
    ib.clear();
    ib.resize(new_len, 0);

    ib.as_ptr() as usize
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
    image_info().transparency = (value != 0).into();
}

#[no_mangle]
pub fn decode() -> bool {
    let input_buffer = input_buffer().as_slice();

    match Qoi::decode_alloc(input_buffer) {
        Ok((qoi, buffer)) => {
            let has_alpha = qoi.colors.has_alpha();
            *image_info() =
                ImageInfo::new(qoi.width as isize, qoi.height as isize, has_alpha.into());

            let ob = image_buffer();
            ob.clear();
            if has_alpha {
                ob.extend_from_slice(buffer.as_slice());
            } else {
                for rgb in buffer.chunks(3) {
                    ob.extend_from_slice(rgb);
                    ob.push(u8::MAX);
                }
            }

            return true;
        }
        Err(_) => (),
    }

    if let Some(decoder) = mpic::Decoder::<()>::new(input_buffer) {
        let mpic_info = decoder.info();

        *image_info() = ImageInfo::new(
            mpic_info.width() as isize,
            mpic_info.height() as isize,
            Transparency::Opaque,
        );

        match decoder.decode_rgba() {
            Ok(vec) => {
                let ob = image_buffer();
                ob.clear();
                ob.extend_from_slice(vec.as_slice());
                return true;
            }
            Err(_) => (),
        }
    }

    false
}

#[no_mangle]
pub fn set_image_info(width: isize, height: isize) -> bool {
    let mut info = ImageInfo::new(width, height, Transparency::Opaque);
    let ib = image_buffer();

    if ib.len() < info.image_size() {
        return false;
    }

    for rgba in ib.chunks(4) {
        let p = rgba[3];
        if p != u8::MAX {
            info.transparency = Transparency::Translucent;
            break;
        }
    }

    *image_info() = info;
    true
}

#[no_mangle]
pub fn encode_qoi() -> bool {
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
        for rgba in ib.chunks(4) {
            vec.push(rgba[0]);
            vec.push(rgba[1]);
            vec.push(rgba[2]);
        }
        qoi.encode_alloc(vec.as_slice())
    };
    match result {
        Ok(vec) => {
            *output_buffer() = vec;
            true
        }
        Err(_) => false,
    }
}

#[no_mangle]
pub fn encode_mpic() -> bool {
    let ib = image_buffer();
    let info = image_info();

    let buffer_size = info.number_of_pixels() * 3;
    let mut vec = Vec::with_capacity(buffer_size);
    for rgba in ib.chunks(4) {
        vec.push(rgba[0]);
        vec.push(rgba[1]);
        vec.push(rgba[2]);
    }

    match mpic::Encoder::encode(vec.as_slice(), info.width as u32, info.height as u32) {
        Ok(vec) => {
            *output_buffer() = vec;
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
