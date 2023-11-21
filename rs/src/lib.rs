#![no_main]
#![deny(unsafe_op_in_unsafe_fn)]

extern crate alloc;

use alloc::vec::Vec;
use core::{
    cell::{RefCell, UnsafeCell},
    ops::DerefMut,
};
use mpic;
use rapid_qoi::{Colors, Qoi};
use wasm_bindgen::{prelude::*, Clamped};
use web_sys::{CanvasRenderingContext2d, ImageData};

static mut IMAGE_INFO: UnsafeCell<ImageInfo> = UnsafeCell::new(ImageInfo::empty());
static mut IMAGE_BUFFER: UnsafeCell<Vec<u8>> = UnsafeCell::new(Vec::new());

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
fn snapshot_info<'a>() -> impl DerefMut<Target = Option<ImageInfo>> + 'a {
    unsafe { SNAPSHOT_INFO.borrow_mut() }
}

#[inline]
fn snapshot_image_buffer<'a>() -> impl DerefMut<Target = Vec<u8>> + 'a {
    unsafe { SNAPSHOT_IMAGE.borrow_mut() }
}

#[wasm_bindgen]
pub fn image_width() -> u32 {
    image_info().width
}

#[wasm_bindgen]
pub fn image_height() -> u32 {
    image_info().height
}

#[wasm_bindgen]
pub fn image_has_alpha() -> bool {
    image_info().transparency.into()
}

#[wasm_bindgen]
pub fn set_image_has_alpha(value: bool) {
    image_info().transparency = value.into();
}

#[wasm_bindgen]
pub fn image_is_grayscale() -> bool {
    image_info().is_grayscale
}

#[wasm_bindgen]
pub fn set_image_buffer(buffer: &[u8], width: u32, height: u32) -> bool {
    snapshot_clear();
    _set_image_buffer(buffer, width, height)
}

fn _set_image_buffer(buffer: &[u8], width: u32, height: u32) -> bool {
    let ib = image_buffer();
    ib.clear();
    ib.extend_from_slice(buffer);
    ib.shrink_to_fit();

    let mut info = ImageInfo::new(width, height, Transparency::Opaque);
    let ib = image_buffer();

    if ib.len() < info.image_size() {
        return false;
    }

    for rgba in ib.chunks_exact(4) {
        let p = rgba[3];
        if p != u8::MAX {
            info.transparency = Transparency::Translucent;
            break;
        }
    }

    *image_info() = info;
    true
}

#[wasm_bindgen]
pub fn draw_to_canvas(context: &CanvasRenderingContext2d) -> bool {
    ImageData::new_with_u8_clamped_array_and_sh(
        Clamped(image_buffer()),
        image_width(),
        image_height(),
    )
    .and_then(|image_data| context.put_image_data(&image_data, 0.0, 0.0))
    .is_ok()
}

#[wasm_bindgen]
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ImageType {
    Qoi,
    Mpic,
    Png,
}

#[wasm_bindgen]
pub fn image_type_to_string(val: ImageType) -> String {
    match val {
        ImageType::Qoi => "qoi".to_owned(),
        ImageType::Mpic => "mpic".to_owned(),
        ImageType::Png => "png".to_owned(),
    }
}

#[wasm_bindgen]
pub fn decode(buffer: &[u8]) -> bool {
    match Qoi::decode_alloc(buffer) {
        Ok((qoi, buffer)) => {
            snapshot_clear();
            let has_alpha = qoi.colors.has_alpha();
            *image_info() = ImageInfo::new(qoi.width, qoi.height, has_alpha.into());

            let ob = image_buffer();
            ob.clear();
            if has_alpha {
                ob.extend_from_slice(buffer.as_slice());
            } else {
                for rgb in buffer.chunks_exact(3) {
                    ob.extend_from_slice(rgb);
                    ob.push(u8::MAX);
                }
            }

            return true;
        }
        Err(_) => (),
    }

    if let Some(decoder) = mpic::Decoder::<()>::new(buffer) {
        snapshot_clear();
        let mpic_info = decoder.info();
        *image_info() = ImageInfo::new(mpic_info.width(), mpic_info.height(), Transparency::Opaque);

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

#[wasm_bindgen]
pub fn encode(image_type: ImageType) -> Option<Vec<u8>> {
    match image_type {
        ImageType::Qoi => {
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
            if qoi.colors.has_alpha() {
                qoi.encode_alloc(ib.as_slice())
            } else {
                let buffer_size = info.number_of_pixels() * 3;
                let mut vec = Vec::with_capacity(buffer_size);
                for rgba in ib.chunks_exact(4) {
                    vec.push(rgba[0]);
                    vec.push(rgba[1]);
                    vec.push(rgba[2]);
                }
                qoi.encode_alloc(vec.as_slice())
            }
            .ok()
        }
        ImageType::Mpic => {
            let ib = image_buffer();
            let info = image_info();

            let buffer_size = info.number_of_pixels() * 3;
            let mut vec = Vec::with_capacity(buffer_size);
            for rgba in ib.chunks_exact(4) {
                vec.push(rgba[0]);
                vec.push(rgba[1]);
                vec.push(rgba[2]);
            }

            mpic::Encoder::encode(vec.as_slice(), info.width as u32, info.height as u32).ok()
        }
        ImageType::Png => {
            let ib = image_buffer();
            let info = image_info();
            let mut buffer = Vec::new();

            let (color_type, ib) = match (info.is_grayscale, info.is_translucent()) {
                (false, false) => {
                    for rgba in ib.chunks_exact(4) {
                        buffer.push(rgba[0]);
                        buffer.push(rgba[1]);
                        buffer.push(rgba[2]);
                    }
                    (png::ColorType::Rgb, &buffer)
                }
                (false, true) => (png::ColorType::Rgba, &*ib),
                (true, false) => {
                    for rgba in ib.chunks_exact(4) {
                        buffer.push(rgba[0]);
                    }
                    (png::ColorType::Grayscale, &buffer)
                }
                (true, true) => {
                    for rgba in ib.chunks_exact(4) {
                        buffer.push(rgba[0]);
                        buffer.push(rgba[3]);
                    }
                    (png::ColorType::GrayscaleAlpha, &buffer)
                }
            };

            let mut ob = Vec::new();
            let mut encoder = png::Encoder::new(&mut ob, info.width, info.height);
            encoder.set_depth(png::BitDepth::Eight);
            encoder.set_color(color_type);
            encoder.set_compression(png::Compression::Best);
            let mut writer = encoder.write_header().ok()?;
            writer.write_image_data(&ib).ok()?;
            writer.finish().ok()?;

            Some(ob)
        }
    }
}

/// Crop an image
#[wasm_bindgen]
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

    const MAGIC_NUMBER: usize = 4;
    let mut ob = Vec::new();
    if ob
        .try_reserve(width as usize * height as usize * MAGIC_NUMBER)
        .is_err()
    {
        return false;
    }
    let offset = (old_info.width as usize * y as usize) * MAGIC_NUMBER;
    let line_offset = x as usize * MAGIC_NUMBER;
    let line_range = line_offset..line_offset + width as usize * MAGIC_NUMBER;
    let Some(ib) = image_buffer().get(offset..) else {
        return false;
    };
    for (line, _) in ib
        .chunks_exact(old_info.width as usize * MAGIC_NUMBER)
        .zip(0..height)
    {
        let Some(line) = line.get(line_range.clone()) else {
            return false;
        };
        ob.extend_from_slice(line);
    }

    _set_image_buffer(ob.as_slice(), width, height)
}

fn _get_pixel(x: u32, y: u32) -> [u8; 4] {
    let info = image_info();
    let offset = (x as usize).wrapping_add((y as usize).wrapping_mul(info.width as usize)) << 2;
    image_buffer()
        .get(offset..offset.wrapping_add(4))
        .and_then(|v| v.try_into().map(|v: &[u8; 4]| *v).ok())
        .unwrap_or([0, 0, 0, 0])
}

#[non_exhaustive]
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ScaleMode {
    NearstNeighbor,
    Bilinear,
    Bicubic,
}

/// Resize a image
#[wasm_bindgen]
pub fn scale(width: u32, height: u32, mode: ScaleMode) -> bool {
    let old_info = image_info();
    if old_info.width == width && old_info.height == height {
        return true;
    }
    if width < 1 || height < 1 {
        return false;
    }

    const MAGIC_NUMBER: usize = 4;
    let mut ob = Vec::new();
    if ob
        .try_reserve(width as usize * height as usize * MAGIC_NUMBER)
        .is_err()
    {
        return false;
    }

    match mode {
        ScaleMode::NearstNeighbor => scale_nn(&mut ob, width, height),
        ScaleMode::Bilinear => {
            if old_info.width > width && old_info.height > height {
                scale_reduction(&mut ob, width, height)
            } else {
                scale_linear(&mut ob, width, height)
            }
        }
        ScaleMode::Bicubic => {
            if old_info.width > width && old_info.height > height {
                scale_reduction(&mut ob, width, height)
            } else {
                scale_cubic(&mut ob, width, height)
            }
        }
    }

    _set_image_buffer(ob.as_slice(), width, height)
}

/// Resize a image using nearest neighbor interpolation
pub fn scale_nn(ob: &mut Vec<u8>, width: u32, height: u32) {
    let old_info = image_info();

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
}

#[inline(always)]
fn scale_main<F>(ob: &mut Vec<u8>, width: u32, height: u32, kernel: F)
where
    F: Fn(f64, f64, f64, f64) -> [u8; 4],
{
    let old_info = image_info();

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
}

/// Resize a image using bilinear interpolation
pub fn scale_linear(ob: &mut Vec<u8>, width: u32, height: u32) {
    scale_main(ob, width, height, |vx, vy, sw, sh| {
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
pub fn scale_cubic(ob: &mut Vec<u8>, width: u32, height: u32) {
    scale_main(ob, width, height, |vx, vy, sw, sh| {
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

/// Image resizing process for reduction only
pub fn scale_reduction(ob: &mut Vec<u8>, width: u32, height: u32) {
    let old_info = image_info();

    let sw = old_info.width as f64;
    let sh = old_info.height as f64;
    let dw = width as f64;
    let dh = height as f64;

    #[inline(always)]
    fn kernel(x: u32, y: u32, sw: f64, sh: f64, dw: f64, dh: f64) -> [u8; 4] {
        let vx = x as f64 * sw / dw;
        let vy = y as f64 * sh / dh;

        let lx = vx.floor() as u32;
        let ly = vy.floor() as u32;
        let hx = (vx + sw / dw).ceil().min(sw - 1.0) as u32;
        let hy = (vy + sh / dh).ceil().min(sh - 1.0) as u32;

        let mut acc = [0.0; 4];
        for y in ly..hy {
            for x in lx..hx {
                let p = _get_pixel(x, y);
                for ch in 0..4 {
                    acc[ch] += p[ch] as f64;
                }
            }
        }

        let mut result = [0; 4];
        let count = (hy as f64 - ly as f64) * (hx as f64 - lx as f64);
        for i in 0..4 {
            result[i] = (acc[i] / count).clamp(0.0, 255.0) as u8
        }
        result
    }

    for y in 0..height {
        for x in 0..width {
            let new_pixel = kernel(x, y, sw, sh, dw, dh);
            ob.extend_from_slice(&new_pixel);
        }
    }
}

#[wasm_bindgen]
pub fn grayscale(mode: GrayScaleMode) -> bool {
    let info = image_info();
    if !info.is_grayscale {
        info.is_grayscale = true;
        match mode {
            GrayScaleMode::Average => {
                let ib = image_buffer();
                for pixel in ib.chunks_exact_mut(4) {
                    let r = pixel[0] as usize;
                    let g = pixel[1] as usize;
                    let b = pixel[2] as usize;
                    let gray = ((r + g + b) / 3) as u8;
                    pixel[0] = gray;
                    pixel[1] = gray;
                    pixel[2] = gray;
                }
                return true;
            }
            GrayScaleMode::Brightness => {
                let ib = image_buffer();
                for pixel in ib.chunks_exact_mut(4) {
                    let r = pixel[0];
                    let g = pixel[1];
                    let b = pixel[2];
                    let gray = r.max(g).max(b);
                    pixel[0] = gray;
                    pixel[1] = gray;
                    pixel[2] = gray;
                }
                return true;
            }
            GrayScaleMode::Luminance => {
                let ib = image_buffer();
                for pixel in ib.chunks_exact_mut(4) {
                    let r = pixel[0] as u32;
                    let g = pixel[1] as u32;
                    let b = pixel[2] as u32;
                    let gray = ((r * 77 + g * 150 + b * 29) / 256) as u8;
                    pixel[0] = gray;
                    pixel[1] = gray;
                    pixel[2] = gray;
                }
                return true;
            }
        }
    }
    false
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum GrayScaleMode {
    Average,
    Brightness,
    Luminance,
}

#[wasm_bindgen]
pub fn snapshot_clear() {
    snapshot_info().take();

    let mut sib = snapshot_image_buffer();
    sib.clear();
    sib.shrink_to_fit();
}

#[wasm_bindgen]
pub fn snapshot_save() {
    let info = image_info();
    snapshot_info().replace(*info);

    let ib = image_buffer();
    let mut sib = snapshot_image_buffer();
    sib.clear();
    sib.extend_from_slice(ib.as_slice());
}

#[wasm_bindgen]
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
    is_grayscale: bool,
    transparency: Transparency,
}

impl ImageInfo {
    #[inline]
    pub const fn empty() -> Self {
        Self {
            width: 0,
            height: 0,
            is_grayscale: false,
            transparency: Transparency::Opaque,
        }
    }

    #[inline]
    pub const fn new(width: u32, height: u32, transparency: Transparency) -> Self {
        Self {
            width,
            height,
            is_grayscale: false,
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

    #[inline]
    pub fn is_translucent(&self) -> bool {
        matches!(self.transparency, Transparency::Translucent)
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
