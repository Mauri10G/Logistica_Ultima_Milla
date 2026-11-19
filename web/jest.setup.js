import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'node:util'

// react-router-dom los usa y jsdom no los trae.
Object.assign(globalThis, { TextEncoder, TextDecoder })

// En Jenkins la PC esta cargada: damos 5 s a las esperas en vez de 1 s.
configure({ asyncUtilTimeout: 5000 })