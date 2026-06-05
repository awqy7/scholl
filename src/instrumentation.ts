export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { aquecerModelosIA } = await import("@/lib/ia-client")
    aquecerModelosIA()
  }
}