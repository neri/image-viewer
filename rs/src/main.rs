#![no_std]
#![no_main]
#![deny(unsafe_op_in_unsafe_fn)]

use alloc::vec::Vec;
use core::{
    cell::{RefCell, UnsafeCell},
    ops::DerefMut,
};
use rapid_qoi::{Colors, Qoi};

extern crate alloc;

static mut INPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut OUTPUT_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut IMAGE_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());
static mut IMAGE_INFO: UnsafeCell<ImageInfo> = UnsafeCell::new(ImageInfo::empty());

static mut SNAPSHOT_INFO: RefCell<Option<ImageInfo>> = RefCell::new(None);
static mut SNAPSHOT_IMAGE: RefCell<Vec<u8>> = RefCell::new(Vec::new());

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

#[inline]
fn snapshot_info<'a>() -> impl DerefMut<Target = Option<ImageInfo>> + 'a {
    unsafe { SNAPSHOT_INFO.borrow_mut() }
}

#[inline]
fn snapshot_image_buffer<'a>() -> impl DerefMut<Target = Vec<u8>> + 'a {
    unsafe { SNAPSHOT_IMAGE.borrow_mut() }
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
    snapshot_clear();
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
pub fn image_width() -> u32 {
    image_info().width
}

#[no_mangle]
pub fn image_height() -> u32 {
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
            *image_info() = ImageInfo::new(qoi.width, qoi.height, has_alpha.into());
            snapshot_clear();

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
        *image_info() = ImageInfo::new(mpic_info.width(), mpic_info.height(), Transparency::Opaque);
        snapshot_clear();

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
pub fn set_image_info(width: u32, height: u32) -> bool {
    snapshot_clear();
    _update_image_info(width, height)
}

fn _update_image_info(width: u32, height: u32) -> bool {
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

/// Crop an image
#[no_mangle]
pub fn crop(x: u32, y: u32, width: u32, height: u32) -> bool {
    let old_info = image_info();
    if x >= old_info.width
        || width < 1
        || x.saturating_add(width) > old_info.width
        || y >= old_info.height
        || height < 1
        || y.saturating_add(height) > old_info.height
    {
        return false;
    }

    let magic_number = 4;
    let mut ob = Vec::new();
    if ob
        .try_reserve(width as usize * height as usize * magic_number)
        .is_err()
    {
        return false;
    }
    let offset = (old_info.width as usize * y as usize) * magic_number;
    let line_offset = x as usize * magic_number;
    let line_range = line_offset..line_offset + width as usize * magic_number;
    let Some(ib) = image_buffer().get(offset..) else { return false; };
    for (line, _) in ib
        .chunks(old_info.width as usize * magic_number)
        .zip(0..height)
    {
        let Some(line) = line.get(line_range.clone()) else { return false; };
        ob.extend_from_slice(line);
    }

    let ib = image_buffer();
    ib.clear();
    ib.extend_from_slice(ob.as_slice());
    ib.shrink_to_fit();
    _update_image_info(width, height)
}

fn _get_pixel(x: u32, y: u32) -> [u8; 4] {
    let info = image_info();
    let offset = (x as usize).wrapping_add((y as usize).wrapping_mul(info.width as usize)) << 2;
    image_buffer()
        .get(offset..offset.wrapping_add(4))
        .and_then(|v| v.try_into().map(|v: &[u8; 4]| *v).ok())
        .unwrap_or([0, 0, 0, 0])
}

/// Resize a image using nearest neighbor interpolation
#[no_mangle]
pub fn scale_nn(width: u32, height: u32) -> bool {
    let old_info = image_info();
    if old_info.width == width && old_info.height == height {
        return true;
    }
    if width < 1 || height < 1 {
        return false;
    }

    let magic_number = 4;
    let mut ob = Vec::new();
    if ob
        .try_reserve(width as usize * height as usize * magic_number)
        .is_err()
    {
        return false;
    }

    let sw = old_info.width as f64;
    let sh = old_info.height as f64;
    let dw = width as f64;
    let dh = height as f64;

    for y in 0..height {
        let vy = y as f64 * sh / dh;
        for x in 0..width {
            let vx = x as f64 * sw / dw;
            let new_pixel = _get_pixel(vx.floor() as u32, vy.floor() as u32);
            ob.extend_from_slice(&new_pixel);
        }
    }

    let ib = image_buffer();
    ib.clear();
    ib.extend_from_slice(ob.as_slice());
    ib.shrink_to_fit();
    _update_image_info(width, height)
}

/// Resize a image using bilinear interpolation
#[no_mangle]
pub fn scale_linear(width: u32, height: u32) -> bool {
    scale_main(width, height, |vx, vy, sw, sh| {
        let vx = (vx - 0.5).max(0.0);
        let vy = (vy - 0.5).max(0.0);

        let lx = vx.floor();
        let ly = vy.floor();
        let x_frac = vx - lx;
        let y_frac = vy - ly;

        let hx = (lx + 1.0).floor().min(sw - 1.0);
        let hy = (ly + 1.0).floor().min(sh - 1.0);

        let vll = _get_pixel(lx as u32, ly as u32);
        let vlh = _get_pixel(lx as u32, hy as u32);
        let vhl = _get_pixel(hx as u32, ly as u32);
        let vhh = _get_pixel(hx as u32, hy as u32);

        let mut result = [0u8; 4];
        for i in 0..4 {
            let a = vll[i] as f64;
            let b = vhl[i] as f64;
            let c = vlh[i] as f64;
            let d = vhh[i] as f64;

            let q = a * (1.0 - x_frac) * (1.0 - y_frac)
                + b * (x_frac) * (1.0 - y_frac)
                + c * (y_frac) * (1.0 - x_frac)
                + d * (x_frac * y_frac);

            result[i] = q.clamp(0.0, 255.0) as u8;
        }

        result
    })
}

/// Resize a image using bicubic interpolation
#[no_mangle]
pub fn scale_cubic(width: u32, height: u32) -> bool {
    scale_main(width, height, |vx, vy, sw, sh| {
        let vx = vx - 0.5;
        let vy = vy - 0.5;

        let lx = vx.floor();
        let ly = vy.floor();
        let x_frac = vx - lx;
        let y_frac = vy - ly;

        let lxm1 = (lx - 1.0).clamp(0.0, sw - 1.0) as u32;
        let lx_0 = (lx).clamp(0.0, sw - 1.0) as u32;
        let lxp1 = (lx + 1.0).clamp(0.0, sw - 1.0) as u32;
        let lxp2 = (lx + 2.0).clamp(0.0, sw - 1.0) as u32;

        let lym1 = (ly - 1.0).clamp(0.0, sh - 1.0) as u32;
        let ly_0 = (ly).clamp(0.0, sh - 1.0) as u32;
        let lyp1 = (ly + 1.0).clamp(0.0, sh - 1.0) as u32;
        let lyp2 = (ly + 2.0).clamp(0.0, sh - 1.0) as u32;

        let p00 = _get_pixel(lxm1, lym1);
        let p10 = _get_pixel(lx_0, lym1);
        let p20 = _get_pixel(lxp1, lym1);
        let p30 = _get_pixel(lxp2, lym1);

        let p01 = _get_pixel(lxm1, ly_0);
        let p11 = _get_pixel(lx_0, ly_0);
        let p21 = _get_pixel(lxp1, ly_0);
        let p31 = _get_pixel(lxp2, ly_0);

        let p02 = _get_pixel(lxm1, lyp1);
        let p12 = _get_pixel(lx_0, lyp1);
        let p22 = _get_pixel(lxp1, lyp1);
        let p32 = _get_pixel(lxp2, lyp1);

        let p03 = _get_pixel(lxm1, lyp2);
        let p13 = _get_pixel(lx_0, lyp2);
        let p23 = _get_pixel(lxp1, lyp2);
        let p33 = _get_pixel(lxp2, lyp2);

        let mut result = [0u8; 4];
        #[inline]
        fn cubic_hermite(a: f64, b: f64, c: f64, d: f64, t: f64) -> f64 {
            let c0 = -a / 2.0 + (3.0 * b) / 2.0 - (3.0 * c) / 2.0 + d / 2.0;
            let c1 = a - (5.0 * b) / 2.0 + 2.0 * c - d / 2.0;
            let c2 = -a / 2.0 + c / 2.0;

            c0 * t * t * t + c1 * t * t + c2 * t + b
        }
        for i in 0..4 {
            let c0 = cubic_hermite(
                p00[i] as f64,
                p10[i] as f64,
                p20[i] as f64,
                p30[i] as f64,
                x_frac,
            );
            let c1 = cubic_hermite(
                p01[i] as f64,
                p11[i] as f64,
                p21[i] as f64,
                p31[i] as f64,
                x_frac,
            );
            let c2 = cubic_hermite(
                p02[i] as f64,
                p12[i] as f64,
                p22[i] as f64,
                p32[i] as f64,
                x_frac,
            );
            let c3 = cubic_hermite(
                p03[i] as f64,
                p13[i] as f64,
                p23[i] as f64,
                p33[i] as f64,
                x_frac,
            );
            let q = cubic_hermite(c0, c1, c2, c3, y_frac);

            result[i] = q.clamp(0.0, 255.0) as u8;
        }

        result
    })
}

#[inline]
fn scale_main<F>(width: u32, height: u32, kernel: F) -> bool
where
    F: Fn(f64, f64, f64, f64) -> [u8; 4],
{
    let old_info = image_info();
    if old_info.width == width && old_info.height == height {
        return true;
    }
    if width < 1 || height < 1 {
        return false;
    }

    let magic_number = 4;
    let mut ob = Vec::new();
    if ob
        .try_reserve(width as usize * height as usize * magic_number)
        .is_err()
    {
        return false;
    }

    let sw = old_info.width as f64;
    let sh = old_info.height as f64;
    let dw = width as f64 - 1.0;
    let dh = height as f64 - 1.0;

    for y in 0..height {
        let vy = y as f64 * sh / dh;
        for x in 0..width {
            let vx = x as f64 * sw / dw;
            let new_pixel = kernel(vx, vy, sw, sh);
            ob.extend_from_slice(&new_pixel);
        }
    }

    let ib = image_buffer();
    ib.clear();
    ib.extend_from_slice(ob.as_slice());
    ib.shrink_to_fit();
    _update_image_info(width, height)
}

#[no_mangle]
pub fn snapshot_clear() {
    snapshot_info().take();

    let mut sib = snapshot_image_buffer();
    sib.clear();
    sib.shrink_to_fit();
}

#[no_mangle]
pub fn snapshot_save() {
    let info = image_info();
    snapshot_info().replace(*info);

    let ib = image_buffer();
    let mut sib = snapshot_image_buffer();
    sib.clear();
    sib.extend_from_slice(ib.as_slice());
}

#[no_mangle]
pub fn snapshot_restore() -> bool {
    let Some(info) = *snapshot_info() else {
        return false;
    };
    *image_info() = info;

    let ib = image_buffer();
    let sib = snapshot_image_buffer();
    ib.clear();
    ib.extend_from_slice(sib.as_slice());

    true
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct ImageInfo {
    width: u32,
    height: u32,
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
    pub const fn new(width: u32, height: u32, transparency: Transparency) -> Self {
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
