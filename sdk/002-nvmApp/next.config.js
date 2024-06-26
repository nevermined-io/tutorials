/** @type {import('next').NextConfig} */
const path = require('path')
const { version } = require('./package.json')

const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  experimental: {
    webpackBuildWorker: true,
  },
  // output: 'standalone',
  compiler: {
    emotion: true,
  },
  transpilePackages: [
    'react-hook-form',
    'react-syntax-highlighter',
    'swagger-client',
    'swagger-ui-react',
    'streamlit-component-lib',
  ],
  images: {
    unoptimized: true,
    deviceSizes: [375, 768, 1280, 1440, 1920],
    imageSizes: [64, 128, 192],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.goerli.nevermined.one',
      },
    ],
  },
  // i18n: {
  //   locales: ['default', 'en', 'es'],
  //   defaultLocale: 'default',
  // },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.('.svg'))

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

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
module.exports = withBundleAnalyzer(nextConfig)
