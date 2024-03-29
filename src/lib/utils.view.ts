import {
    BackendErrorEvent,
    CdnEvent,
    CdnLoadingGraphErrorEvent,
    ParseErrorEvent,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
    UnauthorizedEvent,
} from './events.models'
import { CircularDependencies, DependenciesError } from './errors.models'

export function sanitizeCssId(id: string) {
    return (
        'cdn-client_' + id.replace('/', '-').replace('.', '-').replace('@', '')
    )
}

function setErrorCssProperties(div: HTMLDivElement) {
    div.style.setProperty('font-size', 'larger')
    div.style.setProperty('color', 'orange')
}

export function insertLoadingGraphError(
    contentDiv: HTMLDivElement,
    event: CdnLoadingGraphErrorEvent,
) {
    setErrorCssProperties(contentDiv)

    if (event.error instanceof DependenciesError) {
        contentDiv.appendChild(dependenciesErrorView(event.error))
    }
    if (event.error instanceof CircularDependencies) {
        contentDiv.appendChild(circularDependenciesView(event.error))
    }
}

export function dependenciesErrorView(error: DependenciesError) {
    const errorDiv = document.createElement('div')
    const innerHTML = error.detail.errors.map(({ query, fromPackage }) => {
        return `
        <li> <b>${query}</b>: requested by ${fromPackage.name} with version ${fromPackage.version}</li>
        `
    })
    errorDiv.innerHTML = `Some dependencies do not exist in the CDN
    ${innerHTML}
    `
    return errorDiv
}

export function circularDependenciesView(error: CircularDependencies) {
    const errorDiv = document.createElement('div')
    const innerHTML = Object.entries(error.detail.packages).map(
        ([name, dependenciesError]) => {
            return `
        <li> <b>${name}</b>: problem with following dependencies 
        <ul>
        ${listView(dependenciesError.map((d) => `${d.name}#${d.version}`))}
        </ul>
        </li>
        `
        },
    )
    errorDiv.innerHTML = `Circular dependencies found
    ${innerHTML}
    `
    return errorDiv
}

export function updateLibStatusView(
    libraryName: string,
    divLib: HTMLDivElement,
    event: CdnEvent,
) {
    if (event instanceof StartEvent) {
        divLib.style.setProperty('color', 'lightgray')
        divLib.textContent = `> ${libraryName} ... loading: 0 kB`
    }
    if (event instanceof SourceLoadingEvent) {
        divLib.style.setProperty('color', 'lightgray')
        divLib.textContent = `> ${libraryName} ... loading: ${
            event.progress.loaded / 1000
        } kB`
    }
    if (event instanceof SourceLoadedEvent) {
        divLib.style.setProperty('color', 'green')
        divLib.textContent = `> ${libraryName} ${
            event.progress.loaded / 1000
        } kB`
    }
    if (event instanceof UnauthorizedEvent) {
        setErrorCssProperties(divLib)
        divLib.textContent = `> ${libraryName} : You don't have permission to access this resource.`
    }
    if (event instanceof ParseErrorEvent) {
        setErrorCssProperties(divLib)
        divLib.textContent = `> ${libraryName} : an error occurred while parsing the source`
    }
    if (event instanceof BackendErrorEvent) {
        setErrorCssProperties(divLib)
        divLib.textContent = `> ${libraryName} : ${event.detail}`
    }
}

function listView(list: string[]) {
    return list.map((path) => {
        return `<li> ${path}</li>`
    })
}

/**
 * The default svg Youwol logo.
 *
 * @category Loading screen
 */
export function youwolSvgLogo() {
    return `<svg id='logo2bis' xmlns='http://www.w3.org/2000/svg' style='transform:translate(0px,-12px);margin: auto' viewBox='0 0 109.58 121.1' width='109px' height='121px'>
        <defs><style>.cls-1{fill:#008000;}</style></defs>
        <title>logo_YouWol_white</title>
        <polygon class='cls-1' points='109.58 94.68 109.58 84.14 91.39 73.64 109.58 63.14 109.58 42.06 63.95 68.41 63.94 68.41 63.94 121.1 82.2 110.56 82.2 89.41 100.52 99.99 109.58 94.76 109.58 94.68'/>
        <polygon class='cls-1' points='54.8 52.69 9.17 26.35 27.42 15.81 45.61 26.31 45.61 5.31 54.73 0.04 54.8 0 63.86 5.23 63.86 26.39 82.18 15.81 100.43 26.35 54.8 52.7 54.8 52.69'/>
        <polygon class='cls-1' points='0.07 94.72 9.2 99.99 27.38 89.49 27.38 110.56 45.64 121.1 45.64 68.41 45.64 68.41 0.01 42.06 0.01 63.14 18.33 73.64 0 84.22 0 94.68 0.07 94.72'/>
        </svg>
        `
}
