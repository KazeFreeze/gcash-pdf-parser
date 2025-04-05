const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/browser.ts",
  output: {
    path: path.resolve(__dirname, "dist/browser"),
    filename: "gcash-pdf-parser.min.js",
    library: "GCashPDFParser",
    libraryTarget: "umd",
    globalObject: "this",
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"],
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
    // Remove or modify the splitChunks configuration that's causing issues
    splitChunks: false,
  },
  performance: {
    hints: "warning",
    maxEntrypointSize: 500000,
    maxAssetSize: 500000,
  },
};
