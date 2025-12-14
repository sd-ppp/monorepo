// 导出新的统一 i18n 架构
export * from './i18n'

// 导出 react-i18next 组件和实例，避免其他包直接依赖
export { I18nextProvider } from 'react-i18next'
export { default as i18n } from './i18n/react'

export { sdpppSDK } from './sdk/sdppp-ps-sdk'

export * from './schemas/schemas'
