import { Mode } from './loader.view'

export class ScreenView {
    static fadingTimeout = 500
    public readonly container: HTMLElement
    public readonly wrapperDiv: HTMLDivElement
    public readonly mode: Mode

    public contentDiv: HTMLDivElement

    constructor(params: { container: HTMLElement; id: string; logo: string }) {
        Object.assign(this, params)
        this.wrapperDiv = document.createElement('div')
        this.wrapperDiv.innerHTML = `
        <div id='${params.id}' style='display: flex;justify-content: space-around; background-color: darkgrey;
        color: green; font-family: monospace;font-size:small; width:100vw; height:100vh; position:absolute; top:0; opacity:1;
        transition: opacity 1s'>
            <div style='margin-top: auto;margin-bottom: auto; padding:40px;
            background-color: black; border-radius: 25px;min-width: 50%; max-height:75vh; overflow: auto;
            display: flex;'
            >
                <div  style='display: flex;justify-content: space-around;' >
                    <div id='logo' style='white-space: pre-wrap; margin-top: auto; margin-bottom: auto; /*animation: spin 3s linear infinite*/'> 
                        ${params.logo}
                    </div>   
                </div> 
                <div  style='width: 50px; '>
    
                </div>
                <div  id='screen-content' style='margin-top: auto;margin-bottom: auto; '>
    
                </div>
                <div  id='content-error'>
    
                </div>
            </div>
        </div>
        `
    }

    render() {
        this.container.appendChild(this.wrapperDiv)
        this.contentDiv = document.getElementById(
            'screen-content',
        ) as HTMLDivElement
    }

    done() {
        this.wrapperDiv.style.setProperty(
            'transition',
            `opacity ${ScreenView.fadingTimeout}ms`,
        )
        this.wrapperDiv.style.setProperty('opacity', '0')
        setTimeout(() => this.wrapperDiv.remove(), ScreenView.fadingTimeout)
    }
}
