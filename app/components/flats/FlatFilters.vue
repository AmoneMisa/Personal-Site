<script setup lang="ts">const emit = defineEmits<{ submit: [] }>();</script>
<template><form class="flat-filters" @submit.prevent="emit('submit')"><slot /></form></template>
