export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('error', (err) => {
        console.error('[NITRO_ERROR]', err);
    })
})
