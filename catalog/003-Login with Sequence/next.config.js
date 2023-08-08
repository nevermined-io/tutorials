/** @type {import('next').NextConfig} */
const path = require('path')
const { version } = require('./package.json')

const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  // output: 'standalone',
  compiler: {
    emotion: true,
  },
  transpilePackages: [
    '@nevermined-io/catalog',
    '@nevermined-io/providers',
    'react-hook-form',
  ],
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule) => rule.test && rule.test.test('.svg'))

    fileLoaderRule.exclude = /\.svg$/

    config.module.rules.push(
      {
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: /url/, // *.svg?url
      },
      {
        test: /.svg$/,
        loader: require.resolve('@svgr/webpack'),
        resourceQuery: { not: [/url/] }, // exclude react component if *.svg?url
        options: {
          ref: true,
          svgoConfig: {
            plugins: [
              {
                name: 'preset-default',
                params: {
                  overrides: {
                    removeViewBox: false,
                    cleanupIDs: false,
                  },
                },
              },
            ],
          },
        },
      },
    )

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      constants: require.resolve('constants-browserify'),
      url: require.resolve('url'),
      assert: require.resolve('assert'),
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify'),
      crypto: require.resolve('crypto-browserify'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      stream: require.resolve('stream-browserify'),
      // os: require.resolve('os-browserify/browser'),
      buffer: require.resolve('buffer/'),
    }

    return config
  },
  publicRuntimeConfig: {
    version,
  },
}

module.exports = nextConfig
