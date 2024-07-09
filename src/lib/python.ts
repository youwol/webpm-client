import { CdnEvent, CdnMessageEvent } from './events.models'
import { addScriptElements } from './utils'
import { StateImplementation } from './state'
import { PyodideInputs } from './inputs.models'

export type PythonIndexes = {
    urlPyodide: string
    urlPypi: string
}
export async function installPython(
    pyodideInputs: PyodideInputs & {
        onEvent?: (cdnEvent: CdnEvent) => void
    } & PythonIndexes,
) {
    const modulesRequired = pyodideInputs.modules.filter(
        (module) => !StateImplementation.importedPyModules.includes(module),
    )
    if (modulesRequired.length === 0) {
        return Promise.resolve()
    }

    const onEvent =
        pyodideInputs.onEvent ||
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
        let pyodideVersion = pyodideInputs.version
        if (!pyodideVersion) {
            const latest = await fetch(
                'https://api.github.com/repos/pyodide/pyodide/releases/latest',
            ).then((resp) => resp.json())
            pyodideVersion = latest['tag_name']
        }
        const indexURL = pyodideInputs.urlPyodide.replace(
            '$VERSION',
            pyodideVersion,
        )

        const content = await fetch(`${indexURL}/pyodide.js`).then((resp) =>
            resp.text(),
        )
        await addScriptElements([
            {
                name: 'pyodide',
                version: pyodideVersion,
                assetId: '',
                url: `${indexURL}/pyodide.js`,
                content,
                progressEvent: undefined,
            },
        ])
        globalThis['pyodide'] = await globalThis['loadPyodide']({ indexURL })
    }
    if (pyodideInputs.pyodideAlias) {
        globalThis[pyodideInputs.pyodideAlias] = globalThis['pyodide']
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
            const parameters = pyodideInputs.urlPypi.includes('https')
                ? ''
                : `, index_urls='${pyodideInputs.urlPypi}'`
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
