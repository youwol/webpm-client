import {
    CircularDependencies,
    IndirectPackagesNotFound,
    LoadingGraphError,
    PackagesNotFound,
} from './models'
import { ScreenView } from './utils.view'

export class LoadingGraphErrorScreen extends ScreenView {
    public readonly container: HTMLElement
    public readonly loadingDiv: HTMLDivElement
    public readonly error: LoadingGraphError

    public contentDiv: HTMLDivElement

    constructor({
        container,
        error,
    }: {
        container: HTMLElement
        error: LoadingGraphError
    }) {
        super({
            container,
            id: 'error-screen',
            logo: LoadingGraphErrorScreen.logo(),
        })
        this.error = error
    }

    render() {
        super.render()
        this.contentDiv.style.setProperty('font-size', 'larger')
        this.contentDiv.style.setProperty('color', 'orange')
        if (this.error instanceof PackagesNotFound) {
            this.contentDiv.appendChild(packagesNotFoundView(this.error))
        }
        if (this.error instanceof IndirectPackagesNotFound) {
            this.contentDiv.appendChild(
                indirectPackagesNotFoundView(this.error),
            )
        }
        if (this.error instanceof CircularDependencies) {
            this.contentDiv.appendChild(circularDependenciesView(this.error))
        }
    }

    static logo() {
        return `
    <pre style='color: darkorange'>
        ,__                   __
    '~~****Nm_    _mZ*****~~
            _8@mm@K_
           W~@\`  '@~W
          ][][    ][][
    gz    'W'W.  ,W\`W\`    es
  ,Wf    gZ****MA****Ns    VW.
 gA\`   ,Wf     ][     VW.   'Ms
Wf    ,@\`      ][      '@.    VW
M.    W\`  _mm_ ][ _mm_  'W    ,A
'W   ][  i@@@@i][i@@@@i  ][   W\`
 !b  @   !@@@@!][!@@@@!   @  d!
  VWmP    ~**~ ][ ~**~    YmWf
    ][         ][         ][
  ,mW[         ][         ]Wm.
 ,A\` @  ,gms.  ][  ,gms.  @ 'M.
 W\`  Yi W@@@W  ][  W@@@W iP  'W
d!   'W M@@@A  ][  M@@@A W\`   !b
@.    !b'V*f\`  ][  'V*f\`d!    ,@
'Ms    VW.     ][     ,Wf    gA\`
  VW.   'Ms.   ][   ,gA\`   ,Wf
   'Ms    'V*mmWWmm*f\`    gA\`
</pre>`
    }
}

function listView(list: string[]) {
    return list.map((path) => {
        return `<li> ${path}</li>`
    })
}

export function indirectPackagesNotFoundView(error: IndirectPackagesNotFound) {
    const errorDiv = document.createElement('div')
    const innerHTML = Object.entries(error.detail.paths).map(
        ([name, paths]) => {
            return `
        <li> <b>${name}</b>: requested by 
        <ul>
        ${listView(paths)}
        </ul>
        </li>
        `
        },
    )
    errorDiv.innerHTML = `
    There was an error loading the libraries of the application: some indirect dependencies do not exist in the CDN
    ${innerHTML}
    `
    return errorDiv
}

export function circularDependenciesView(error: CircularDependencies) {
    const errorDiv = document.createElement('div')
    const innerHTML = Object.entries(error.detail.packages).map(
        ([name, paths]) => {
            return `
        <li> <b>${name}</b>: problem with following dependencies 
        <ul>
        ${listView(paths)}
        </ul>
        </li>
        `
        },
    )
    errorDiv.innerHTML = `
    There was an error loading the libraries of the application: circular dependencies found
    ${innerHTML}
    `
    return errorDiv
}

export function packagesNotFoundView(error: PackagesNotFound) {
    const errorDiv = document.createElement('div')
    const innerHTML = error.detail.packages.map(
        (name) => `<li> <b>${name}</b></li>`,
    )
    errorDiv.innerHTML = `
    There was an error loading the libraries of the application: some dependencies do not exist in the CDN
    ${innerHTML}
    `
    return errorDiv
}
