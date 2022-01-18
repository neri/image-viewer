const webpack = require("webpack")
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    module: {
        rules: [
            { test: /\.ts$/, loader: 'ts-loader' },
            {
                test: /\.wasm$/,
                type: "webassembly/async"
            }]
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
        new HtmlWebpackPlugin()],
}
