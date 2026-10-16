import { createElement } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { MotionConfig } from 'motion/react'

// Markup assertions do not have a layout engine; client interactions are tested separately.
export const renderToStaticMarkup = element => render(createElement(MotionConfig, { isStatic: true }, element))
