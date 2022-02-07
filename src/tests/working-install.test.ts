/** @format */

// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import './mock-requests'

import { installPackages$ } from './common'
import { getLoadingGraph, getUrlBase, install } from '../lib/loader'

beforeAll((done) => {
    installPackages$().subscribe(() => {
        done()
    })
})

test('install root', async () => {
    await install({
        modules: ['root'],
    })
    expect(document.scripts).toHaveLength(1)
    const s0 = document.scripts.item(0)
    const target = getUrlBase('root', '1.0.0') + '/root.js'
    expect(s0.id).toBe(target)
    expect(window['root'].name).toBe('root')
})

test('loading graph a', async () => {
    const resp = await getLoadingGraph({
        libraries: { a: 'latest' },
    })
    expect(resp).toEqual({
        graphType: 'sequential-v1',
        lock: [
            {
                name: 'a',
                version: '1.0.0',
                id: 'YQ==',
                namespace: '',
                type: 'library',
            },
            {
                name: 'root',
                version: '1.0.0',
                id: 'cm9vdA==',
                namespace: '',
                type: 'library',
            },
        ],
        definition: [
            [['cm9vdA==', 'cm9vdA==/1.0.0/root.js']],
            [['YQ==', 'YQ==/1.0.0/a.js']],
        ],
    })
})

test('install a', async () => {
    await install({
        modules: ['a'],
    })
    expect(document.scripts).toHaveLength(2)
    expect(window['a']).toEqual({
        name: 'a',
        rootName: 'root',
        addOn: [],
    })
})

test('install a with add-on', async () => {
    await install({
        modules: ['a'],
        scripts: ['a#1.0.0~folder/add-on.js'],
    })
    expect(document.scripts).toHaveLength(3)
    expect(window['a']).toEqual({
        name: 'a',
        rootName: 'root',
        addOn: ['add-on'],
    })
})

// eslint-disable-next-line jest/no-commented-out-tests -- want to keep it
// test('install a with add-on & css', async () => {
//     await install({
//         modules: ['a'],
//         scripts: ['a#1.0.0~folder/add-on.js'],
//         css: ['a#1.0.0~style.css'],
//     })
//     expect(document.scripts).toHaveLength(3)
//     expect(window['a']).toEqual({
//         name: 'a',
//         rootName: 'root',
//         addOn: ['add-on'],
//     })
//     const div = document.createElement('div')
//     div.classList.add('package-a')
//     document.body.appendChild(div)
//     const style = window.getComputedStyle(div)
//     expect(style.getPropertyValue('background-color')).toBe('blue')
// })
