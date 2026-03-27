import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist/widgets",
    rollupOptions: {
      input: {
        "payment-history": "widgets/payment-history/index.html",
        "services-table": "widgets/services-table/index.html",
        "revenue-dashboard": "widgets/revenue-dashboard/index.html",
      },
    },
  },
})
