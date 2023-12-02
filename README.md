# Online Image Tools

- [Launch now](https://nerry.jp/image-viewer/)
- [Repository](https://github.com/neri/image-viewer)

## Features

- This application manipulates images online.

### Supported Image Format

| Format | Load | Save | |
| - | - | - | - |
| [QOI](https://qoiformat.org/) | ✅ | ✅ | Alpha channel support |
| [MPIC](https://github.com/neri/mpic) | ✅ | ✅ | |
| PNG | ✅ | ✅ | Load via IMG tag, save via wasm |
| other | ✅ | | Any image format that can be displayed with the IMG tag |

## Requirements

### Runtime Environments

- Web browsers that can use WebAssembly

### Build Environments

- npm (webpack, TypeScript)
- Rust

## License

MIT License

Copyright (c) 2022 Nerry
