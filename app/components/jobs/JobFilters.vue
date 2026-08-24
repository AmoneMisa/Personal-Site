<script setup lang="ts">const emit = defineEmits<{ submit: [] }>();</script>
<template><form class="job-filters" @submit.prevent="emit('submit')"><slot /></form></template>
