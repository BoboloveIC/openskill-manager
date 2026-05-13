const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/electron/main.js',
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist/electron'),
    filename: 'main.js',
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  // 排除原生模块，让 Electron 运行时自行解析
  externals: {
    fsevents: 'fsevents',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  devtool: 'source-map',
};
