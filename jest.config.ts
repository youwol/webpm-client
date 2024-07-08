import { Config } from 'jest'

const t: Config = {
    preset: '@youwol/jest-preset',
    modulePathIgnorePatterns: ['src/tests/.packages-test'],
    testSequencer: './src/tests/test-sequencer.js',
    testPathIgnorePatterns: ['webpm-client-doc'],
}
export default t
