import { defineConfig, loadEnv } from 'vite';
import { join } from 'path';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const {
    VUE_APP_HIVE_API_BASE_URL,
    VUE_APP_HIVE_API_TOKEN
  } = env;
  const newEnv = {
    VUE_APP_HIVE_API_BASE_URL,
    VUE_APP_HIVE_API_TOKEN,
  };
  return {
    define: {
      'process.env': newEnv
    },
    plugins: [vue()],
    server: {
      port: 3002,
    },
    build: {
      chunkSizeWarningLimit: 600, // 设置警告阈值为600KiB
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id
                .toString()
                .split('node_modules/')[1]
                .split('/')[0]
                .toString();
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
  };
});
