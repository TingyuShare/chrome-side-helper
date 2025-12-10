const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: path.resolve(__dirname, 'src', 'background.js'),
    options: path.resolve(__dirname, 'src', 'options.js'),
    popup: path.resolve(__dirname, 'src', 'popup.js'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/options.html', to: 'options.html' },
        { from: 'src/popup.html', to: 'popup.html' },
        { from: 'src/icon.png', to: 'icon.png' },
      ],
    }),
    new ZipPlugin({
      path: path.resolve(__dirname),
      filename: 'extension.zip',
    }),
  ],
};
