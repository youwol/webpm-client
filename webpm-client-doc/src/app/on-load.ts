import { render, AnyVirtualDOM } from '@youwol/rx-vdom'
import { navigation } from './navigation'
import { Router, Views } from '@youwol/mkdocs-ts'
import { setup } from '../auto-generated'
export const router = new Router({
    navigation,
})

export const logo: AnyVirtualDOM = {
    tag: 'div',
    class: 'd-flex align-items-center',
    children: [
        {
            tag: 'div',
            innerText: '<',
            style: {
                color: 'white',
                fontWeight: 'bolder',
                fontSize: 'x-large',
            },
        },
        {
            tag: 'img',
            class: 'mx-1',
            style: {
                width: '30px',
                height: '30px',
            },
            src: '../assets/logo.svg',
        },
        {
            tag: 'div',
            innerText: '>',
            style: {
                color: 'white',
                fontWeight: 'bolder',
                fontSize: 'x-large',
            },
        },
    ],
}
document.getElementById('content').appendChild(
    render(
        new Views.DefaultLayoutView({
            router,
            name: 'WebPM',
            topBanner: (params) =>
                new Views.TopBannerClassicView({
                    ...params,
                    logo,
                    badge: new Views.SourcesLink({
                        href: 'https://github.com/youwol/webpm-client/',
                        version: setup.version,
                        name: '@youwol/webpm-client',
                    }),
                }),
        }),
    ),
)
