import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      brand: {
        50: '#eef4ff',
        100: '#dbe6ff',
        500: '#4f8cff',
        600: '#3d76f0',
        700: '#2f5fd0'
      }
    }
  },
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    'text-ellipsis': 'overflow-hidden whitespace-nowrap text-ellipsis'
  }
})
