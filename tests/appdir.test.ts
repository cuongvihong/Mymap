import { describe, expect, it } from 'vitest'
import { computeAppDir } from '../src/shared/appdir'

describe('computeAppDir', () => {
  it('Windows unpacked build: parent of the folder that holds the exe', () => {
    expect(computeAppDir({}, 'E:\\Kho\\app\\win\\MapApp.exe', false)).toBe('E:\\Kho\\app')
  })

  it('Windows path written with forward slashes', () => {
    expect(computeAppDir({}, 'E:/Kho/app/win/MapApp.exe', false)).toBe('E:/Kho/app')
  })

  it('AppImage with APPIMAGE_ORIG_DIR: uses the launcher folder, ignores the mount point', () => {
    const env = {
      APPIMAGE: '/media/usb/Kho/app/linux/MapApp.AppImage',
      APPIMAGE_ORIG_DIR: '/media/usb/Kho/app/linux'
    }
    expect(computeAppDir(env, '/tmp/.mount_MapApprXyZ/mapapp', false)).toBe('/media/usb/Kho/app')
  })

  it('AppImage with APPIMAGE_ORIG_DIR that ends with a slash', () => {
    const env = { APPIMAGE_ORIG_DIR: '/media/usb/Kho/app/linux/' }
    expect(computeAppDir(env, '/tmp/.mount_MapApprXyZ/mapapp', false)).toBe('/media/usb/Kho/app')
  })

  it('AppImage without APPIMAGE_ORIG_DIR: falls back to the APPIMAGE path', () => {
    const env = { APPIMAGE: '/media/usb/Kho/app/linux/MapApp.AppImage' }
    expect(computeAppDir(env, '/tmp/.mount_MapApprXyZ/mapapp', false)).toBe('/media/usb/Kho/app')
  })

  it('empty APPIMAGE variables are ignored', () => {
    const env = { APPIMAGE: '  ', APPIMAGE_ORIG_DIR: '' }
    expect(computeAppDir(env, '/media/usb/Kho/app/linux/MapApp', false)).toBe('/media/usb/Kho/app')
  })

  it('unpacked Linux build without AppImage variables', () => {
    expect(computeAppDir({}, '/home/me/Kho/app/linux/mapapp', false)).toBe('/home/me/Kho/app')
  })

  it('dev: .dev-app under the working directory, AppImage variables ignored', () => {
    const env = { APPIMAGE: '/x/app/linux/MapApp.AppImage' }
    expect(
      computeAppDir(env, '/p/node_modules/electron/dist/electron', true, '/home/me/mapapp')
    ).toBe('/home/me/mapapp/.dev-app')
  })

  it('dev on Windows', () => {
    expect(
      computeAppDir({}, 'D:\\mymap\\node_modules\\electron\\dist\\electron.exe', true, 'D:\\mymap')
    ).toBe('D:\\mymap\\.dev-app')
  })
})
