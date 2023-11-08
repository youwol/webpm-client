import { StateImplementation } from '../lib/state'
import { getApiKey, getExpectedFullExportedSymbol } from '../lib/utils'

function fakeInstalledModule(name, version) {
    StateImplementation.exportedSymbolsDict[`${name}#${version}`] = {
        symbol: name,
        apiKey: getApiKey(version),
        aliases: [],
    }
    StateImplementation.registerImportedModules(
        [
            {
                name,
                version,
            },
        ],
        window,
    )
    const symbol = getExpectedFullExportedSymbol(name, version)
    window[symbol] = {
        setup: { name, version, apiVersion: getApiKey(version) },
    }
}

test('StateImplementation.isCompatibleVersionInstalled', () => {
    fakeInstalledModule('@youwol/webpm-client', '1.2.0')
    const tests = {
        '1.1.0': true,
        '1.3.0': false,
        '0.10.0': false,
        '0.0.10': false,
    }
    Object.entries(tests).map(([version, expected]) => {
        const r = StateImplementation.isCompatibleVersionInstalled(
            '@youwol/webpm-client',
            version,
        )
        expect(r).toBe(expected)
    })
})
