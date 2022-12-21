import { Config } from 'jest'

const t: Config = {
    preset: '@youwol/jest-preset',
    modulePathIgnorePatterns: ['src/tests/.packages-test'],
}
export default t
