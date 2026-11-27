/// <reference types="@testing-library/jest-dom/vitest" />
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup, configure } from '@testing-library/react'
import 'fake-indexeddb/auto' // jsdom has no IndexedDB; the offline catalog and order queue use it
import '@/i18n'

// Use the vitest globals (expect, afterEach, vi, ...) instead of importing from 'vitest'.
// On Windows, when the terminal's working directory has a lowercase drive letter (d:\ instead
// of D:\), an explicit import resolves to a second copy of vitest and the run fails with
// "Vitest failed to find the runner" / "Invalid Chai property".
expect.extend(matchers)

afterEach(() => cleanup())

// The first render of a lazily loaded page imports its whole chunk (the dashboard pulls in the
// chart library), which can take longer than the default 1s wait on a busy machine or CI
// runner. Waiting longer costs nothing when the element appears quickly.
configure({ asyncUtilTimeout: 5000 })

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
