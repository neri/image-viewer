# Online Image Viewer

- [Launch now](https://nerry.jp/image-viewer/)
- [Repository](https://github.com/neri/image-viewer)

## Features

- This application can display and save image files using a WebAssembly decoder.

### Supported Image Format

| Format                               | Load | Save |                                                  |
| ------------------------------------ | ---- | ---- | ------------------------------------------------ |
| [QOI](https://qoiformat.org/)        | ✅    | ✅    | Alpha channel support                            |
| [MPIC](https://github.com/neri/mpic) | ✅    | ✅    |                                                  |
| PNG                                  | ✅    | ✅    | Via the IMG tag                                  |
| other                                | ✅    |      | Other formats supported by the browser's IMG tag |

## Requirements

### Runtime Environments

- Web browsers that can use WebAssembly

### Build Environments

- npm (webpack, TypeScript)
- Rust

## License

MIT License

Copyright (c) 2022 Nerry
