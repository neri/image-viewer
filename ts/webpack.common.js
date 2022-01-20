const webpack = require("webpack")
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    module: {
        rules: [
            { test: /\.ts$/, loader: 'ts-loader' },
            { test: /\.html$/, loader: 'html-loader' },
            { test: /\.wasm$/, type: 'webassembly/async' },
            {
                test: /\.css/,
                use: ["style-loader", "css-loader",]
            },
            {
                test: /\.png$/,
                type: 'asset/inline',
            }
        ]
    },
    output: {
        clean: true,
    },
    experiments: {
        asyncWebAssembly: true,
    },
    resolve: {
        extensions: ['.ts', '.js', '.wasm'],
    },
    plugins: [
        new webpack.LoaderOptionsPlugin({
            options: {
                exprimnet: {
                    asyncWebAssembly: true
                }
            }
        }),
        new HtmlWebpackPlugin({
            template: "./src/index.html"
        }),
    ],
}
