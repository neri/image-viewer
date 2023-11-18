.PHONY: all clean test server
.SUFFIXED: .wasm .js .rs .ts

TS_ROOT	= ts/
TS_SRC	= $(TS_ROOT)src/
TS_DIST	= $(TS_ROOT)dist/
TS_MAIN	= $(TS_DIST)main.js
RS_SRC	= rs/
RS_LIB	= ts/lib/libtsc_bg.wasm
TOOLS	= tools/

all: $(RS_LIB) $(TS_MAIN)

clean:
	(cd $(RS_SRC); cargo clean)
	-rm $(RS_LIB) $(TS_MAIN)
	-rm -rf $(TS_DIST)

debug:
	(cd $(RS_SRC); cargo build)
	cp target/wasm32-unknown-unknown/debug/libimage.wasm $(RS_LIB)

$(RS_LIB): $(RS_SRC)src/*.rs
	(cd $(RS_SRC); cargo build --release)
	wasm-bindgen target/wasm32-unknown-unknown/release/libimage.wasm --out-dir ts/lib

$(TS_MAIN): $(RS_LIB) $(TS_SRC)*.ts
	(cd $(TS_ROOT); npm i; npm run build)

server:
	(cd ts; npm run start)
