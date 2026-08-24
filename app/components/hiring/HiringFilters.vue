<script setup lang="ts">const emit = defineEmits<{ submit: [] }>();</script>
<template><form class="hiring-filters" @submit.prevent="emit('submit')"><slot /></form></template>
