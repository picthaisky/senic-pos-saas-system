/// <reference types="@testing-library/jest-dom/vitest" />
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import '@/i18n'

// Use the vitest globals (expect, afterEach, vi, ...) instead of importing from 'vitest'.
// On Windows, when the terminal's working directory has a lowercase drive letter (d:\ instead
// of D:\), an explicit import resolves to a second copy of vitest and the run fails with
// "Vitest failed to find the runner" / "Invalid Chai property".
expect.extend(matchers)

afterEach(() => cleanup())

// Browser APIs that jsdom does not implement.

// Recharts' ResponsiveContainer needs it; charts simply render empty in tests.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// <dialog> modal methods, used by the Modal component.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
