import { CdnEvent, CdnMessageEvent } from './events.models'
import { addScriptElements } from './utils'
import { PyodideInstaller } from './inputs.models'
import { StateImplementation } from './state'

export type PythonIndexes = {
    urlPyodide: string
    urlPypi: string
}
export async function installPython(
    pyodideInstaller: PyodideInstaller & {
        onEvent?: (cdnEvent: CdnEvent) => void
    } & PythonIndexes,
) {
    const modulesRequired = pyodideInstaller.modules.filter(
        (module) => !StateImplementation.importedPyModules.includes(module),
    )
    if (modulesRequired.length === 0) {
        return Promise.resolve()
    }

    const onEvent =
        pyodideInstaller.onEvent ||
        (() => {
            /*no op*/
        })
    onEvent(
        new CdnMessageEvent(
            `pyodide runtime`,
            `Installing python runtime...`,
            'Pending',
        ),
    )
    if (!globalThis['pyodide']) {
        const indexURL = pyodideInstaller.urlPyodide.replace(
            '$VERSION',
            pyodideInstaller.version,
        )

        const content = await fetch(`${indexURL}/pyodide.js`).then((resp) =>
            resp.text(),
        )
        await addScriptElements([
            {
                name: 'pyodide',
                version: pyodideInstaller.version,
                assetId: '',
                url: `${indexURL}/pyodide.js`,
                content,
                progressEvent: undefined,
            },
        ])
        globalThis['pyodide'] = await globalThis['loadPyodide']({ indexURL })
    }

    const pyodide = globalThis['pyodide']
    onEvent(
        new CdnMessageEvent(
            `pyodide runtime`,
            `Python runtime installed`,
            'Succeeded',
        ),
    )
    onEvent(
        new CdnMessageEvent(
            'loadDependencies',
            'Loading Python dependencies...',
            'Pending',
        ),
    )
    await pyodide.loadPackage('micropip')

    modulesRequired.forEach((module) => {
        onEvent(
            new CdnMessageEvent(
                `${module}`,
                `${module} installing ...`,
                'Pending',
            ),
        )
    })

    await Promise.all(
        modulesRequired.map((module) => {
            const parameters = pyodideInstaller.urlPypi.includes('https')
                ? ''
                : `, index_urls='${pyodideInstaller.urlPypi}'`
            return pyodide
                .runPythonAsync(
                    `
import micropip
await micropip.install(requirements='${module}'${parameters})`,
                )
                .then(() => {
                    StateImplementation.registerImportedPyModules([module])
                    onEvent(
                        new CdnMessageEvent(
                            `${module}`,
                            `${module} loaded`,
                            'Succeeded',
                        ),
                    )
                })
        }),
    )

    onEvent(
        new CdnMessageEvent(
            'loadDependencies',
            'Python dependencies loaded',
            'Succeeded',
        ),
    )

    const lock = await pyodide.runPythonAsync(
        'import micropip\nmicropip.freeze()',
    )
    return { pyodide, loadingGraph: lock }
}
