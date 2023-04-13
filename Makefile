.PHONY: love all clean test
.SUFFIXED: .wasm .js .rs .ts

TS_ROOT	= ts/
TS_SRC	= $(TS_ROOT)src/
TS_DIST	= $(TS_ROOT)dist/
TS_MAIN	= $(TS_DIST)main.js
RS_SRC	= rs/
LIB_QOI	= rs/lib/libimage.wasm
TOOLS	= tools/
WASM_STRIP	= $(TOOLS)wasm-strip/

all: $(LIB_QOI) $(TS_MAIN)

clean:
	-rm $(LIB_QOI) $(TS_MAIN)
	-rm -rf ./target $(TS_DIST)

$(LIB_QOI): $(RS_SRC)src/*.rs
	(cd $(RS_SRC); cargo build --release)
	cargo run --manifest-path $(WASM_STRIP)Cargo.toml -- target/wasm32-unknown-unknown/release/libimage.wasm $(LIB_QOI)

$(TS_MAIN): $(LIB_QOI) $(TS_SRC)*.ts
	(cd $(TS_ROOT); npm i; npm run build)
