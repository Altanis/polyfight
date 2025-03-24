require("dotenv").config();

const webpack = require("webpack");
var WebpackObfuscator = require('webpack-obfuscator');
const path = require("path");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

const is_production = process.env.PROD === "true";

module.exports =
{
    entry:
    {
        client: path.join(__dirname, "views", "ts", "index.ts")
    },
    output:
    {
        path: path.join(__dirname, "views", "public"),
        filename: "[name].js"
    },
    module:
    {
        rules:
        [
            {
                test: /\.ts?$/,
                loader: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    resolve:
    {
        extensions: [".ts"]
    },
    plugins: [],
    optimization:
    {
        minimize: false
    },
    plugins: is_production ? [
        new WebpackObfuscator({
            rotateStringArray: true,
            stringArray: false,
            // stringArrayThreshold: 0.01,
            // controlFlowFlattening: true,
            // deadCodeInjection: true,
            // debugProtection: true,
            // disableConsoleOutput: true,
            identifierNamesGenerator: "mangled-shuffled",
            numbersToExpressions: false
        })
    ] : [],
    optimization:
    {
        minimizer: [new UglifyJsPlugin({
            uglifyOptions: {
                warnings: false,
                parse: {},
                compress: {},
                mangle: true,
                output: null,
                toplevel: true,
                nameCache: null,
                ie8: false,
                keep_fnames: false,
              },
        })],
        minimize: true
    },
    mode: is_production ? "production" : "development"
};