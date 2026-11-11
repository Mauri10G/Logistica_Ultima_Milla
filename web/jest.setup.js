import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'

// react-router-dom los usa y jsdom no los trae.
Object.assign(globalThis, { TextEncoder, TextDecoder })
