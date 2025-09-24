import path from 'path'

/** 导入 webpack 配置类型 */
import { Configuration, DefinePlugin } from 'webpack'

import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CopyPlugin from 'copy-webpack-plugin'

/** 根据环境变量判断是否为开发模式 */
const isDev = process.env.NODE_ENV === 'development'

/** 
 * Webpack公共配置
 * 包含主进程、预加载脚本和渲染进程共用的配置项
 */
const common: Configuration = {
    /** 构建模式：开发模式或生产模式 */
    mode: isDev ? 'development' : 'production',
    
    /** 模块解析配置 */
    resolve: {
        /** 自动解析的文件扩展名 */
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
        /** 
         * 模块解析缓存
         * 提升构建性能
         */
        cache: !isDev,
    },
    
    /**
     * 外部依赖配置
     * fsevents是macOS特有的文件系统事件库，需要排除以避免构建问题
     * osx-temperature-sensor是macOS特有的温度传感器库，Windows下不存在
     * utf-8-validate和bufferutil是ws库的可选依赖，用于性能优化，在Electron中可以忽略
     * ws库在Electron主进程中需要作为外部依赖处理，避免Webpack打包问题
     * 参考：https://github.com/yan-foto/electron-reload/issues/71
     */
    externals: {
        'fsevents': 'commonjs fsevents',
        'osx-temperature-sensor': 'commonjs osx-temperature-sensor', 
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
        'ws': 'commonjs ws'
    },
    
    /** 输出配置 */
    output: {
        /** 输出文件目录 */
        path: path.resolve(__dirname, 'build'),
        /** 
         * 公共路径设置
         * Webpack 5 + Electron 需要设置为相对路径
         */
        publicPath: './',
        /** 输出文件名格式 */
        filename: '[name].js',
        /** 资源文件名格式 */
        assetModuleFilename: 'assets/[name][ext]',
    },
    /** 模块处理规则 */
    module: {
        rules: [
            {
                /** 
                 * TypeScript文件处理规则
                 * 使用ts-loader处理.ts和.tsx文件，排除node_modules目录
                 */
                test: /\.tsx?$/,
                exclude: /node_modules/,
                loader: 'ts-loader',
            },
            {
                /** CSS文件处理规则 */
                test: /\.css$/,
                use: [
                    /** 使用MiniCssExtractPlugin提取CSS到单独文件，而不是内联到JS中 */
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            /** 开发模式下启用source map */
                            sourceMap: isDev,
                        },
                    },
                ],
            },
            {
                /** 
                 * 静态资源文件处理规则
                 * 包括图片、字体等文件
                 */
                test: /\.(ico|png|jpe?g|svg|eot|woff?2?)$/,
                /**
                 * 使用Webpack 5的asset/resource类型
                 * 不再需要file-loader或url-loader
                 */
                type: 'asset/resource',
            },
        ],
    },
    
    /** 开发模式下启用文件监听 */
    watch: isDev,
    
    /**
     * Source Map配置
     * 开发模式下启用内联source map以便调试
     * 注意：渲染进程中可能会出现'Uncaught EvalError'警告
     */
    devtool: isDev ? 'inline-source-map' : undefined,
    
    /** 
     * 性能优化配置
     * 生产环境下启用代码压缩
     */
    optimization: isDev ? undefined : {
        /** 启用代码压缩 */
        minimize: true,
    },
}

// 主进程 配置
const main: Configuration = {
    // 加载公共配置
    ...common,
    target: 'electron-main',
    // 入口文件 main.ts
    entry: {
        main: './src/main/main.ts',
    },
    plugins: [
        new DefinePlugin({
            'process.env.ENV_NAME': JSON.stringify(process.env.ENV_NAME),
            'process.env.LOGIN_URL': JSON.stringify(process.env.LOGIN_URL),
        }),
    ],
}

// 预加载脚本 配置
const preload: Configuration = {
    ...common,
    target: 'electron-preload',
    entry: {
        browserPreload: './src/main/preload/browserPreload.ts',
        preload: './src/main/preload/preload.ts',
        viewPreload: './src/main/preload/viewPreload.ts',
        framePreload: './src/main/preload/framePreload.ts',
        viewFinishLoad: './src/main/preload/ViewFinishLoad.ts',
    },
}

/**
 * 渲染进程入口点配置
 * 定义所有渲染进程页面的入口文件
 */
const rendererEntries = {
    app: './src/renderer/app.tsx',
    login: './src/renderer/login/login.tsx',
    updateTip: './src/renderer/updateTip/updateTip.tsx',
    loading: './src/renderer/loading/loading.tsx',
    notifier: './src/renderer/notifier/notifier.tsx',
    setting: './src/renderer/setting/setting.tsx',
    // 通用提示组件
    alert: './src/renderer/alert/alert.tsx',
    alertClose: './src/renderer/alertClose/alertClose.tsx',
    alertEDA: './src/renderer/alertEDA/alertEDA.tsx',
    messageAlert: './src/renderer/messageAlert/MessageAlert.tsx',
    messageMgr: './src/renderer/messageMgr/MessageMgr.tsx',
    launcher: './src/renderer/launcher/launcher.tsx',
    // 重载组件
    loginReload: './src/renderer/reload/LoginReload.tsx',
    commonReload: './src/renderer/reload/CommonReload.tsx',
    // 其他页面
    site: './src/renderer/site/site.tsx',
}

/**
 * 生成HTML模板插件
 * 根据入口点自动生成对应的HTML文件
 * @param entries 入口点配置对象
 * @returns HtmlWebpackPlugin实例数组
 */
function generateHtmlPlugins(entries: Record<string, string>): HtmlWebpackPlugin[] {
    return Object.keys(entries).map(entryName => {
        const filename = entryName === 'app' ? 'index.html' : `${entryName}.html`
        
        return new HtmlWebpackPlugin({
            template: './src/index.html',
            filename,
            chunks: [entryName],
        })
    })
}

/** 渲染进程配置 */
const renderer: Configuration = {
    ...common,
    target: 'electron-renderer',
    entry: rendererEntries,
    plugins: [
        /** CSS提取插件 */
        new MiniCssExtractPlugin(),
        /** 自动生成HTML模板 */
        ...generateHtmlPlugins(rendererEntries),
    ],
}

/**
 * 根据环境添加资源复制插件
 */
function addCopyPlugin(): void {
    const basePatterns = [
        {
            from: path.join(__dirname, 'src/res/'),
            to: path.join(__dirname, 'build/res'),
        },
    ]
    
    renderer.plugins!.push(
        new CopyPlugin({
            patterns: basePatterns,
        })
    )
}

// 添加资源复制插件
addCopyPlugin()

// 导出所有配置：主进程、预加载脚本和渲染进程
const config = [main, preload, renderer]
export default config
